---
name: convex-best-practices
description: Guide for writing Convex backend code following best practices for TypeScript, database queries, security, and performance. Use when writing Convex functions (queries, mutations, actions), defining schemas, creating indexes, or reviewing Convex code.
---

# Convex Best Practices

## Database Queries

### Avoid `.filter()` on database queries

Use `.withIndex()` instead of `.filter()` for performance. The `.filter()` method has no performance advantage over filtering in code.

```typescript
// ❌ Bad
const messages = ctx.db
  .query('messages')
  .filter((q) => q.eq(q.field('author'), 'Tom'))
  .collect()

// ✅ Good - use an index
const messages = await ctx.db
  .query('messages')
  .withIndex('by_author', (q) => q.eq('author', 'Tom'))
  .collect()
```

### Only use `.collect()` with bounded results

All results from `.collect()` count towards bandwidth. For potentially large result sets (1000+ docs), use pagination, limits, or tighter index filters.

```typescript
// ❌ Potentially unbounded
const allMovies = await ctx.db.query('movies').collect()

// ✅ Use pagination for large sets
const movies = await ctx.db
  .query('movies')
  .withIndex('by_director', (q) => q.eq('director', director))
  .paginate(paginationOptions)

// ✅ Or use limits with "99+" pattern
const movies = await ctx.db.query('movies').take(100)
const count = movies.length === 100 ? '99+' : movies.length.toString()
```

### Always include table name in `ctx.db` calls

```typescript
// ❌ Bad
await ctx.db.get(movieId)
await ctx.db.patch(movieId, { title: 'Whiplash' })

// ✅ Good
await ctx.db.get('movies', movieId)
await ctx.db.patch('movies', movieId, { title: 'Whiplash' })
```

### Don't use `Date.now()` in queries

Queries re-run on data changes, not time changes. Use scheduled functions to set flags instead.

```typescript
// ❌ Bad - may show stale results
const posts = await ctx.db
  .query('posts')
  .withIndex('by_released_at', (q) => q.lte('releasedAt', Date.now()))
  .collect()

// ✅ Good - use a flag updated by scheduled function
const posts = await ctx.db
  .query('posts')
  .withIndex('by_is_released', (q) => q.eq('isReleased', true))
  .collect()
```

## Security & Access Control

### Use argument validators for all public functions

```typescript
// ❌ Bad - unvalidated arguments
export const updateMovie = mutation({
  handler: async (ctx, { id, update }: { id: Id<'movies'>; update: any }) => {
    await ctx.db.patch('movies', id, update)
  },
})

// ✅ Good - validated arguments
export const updateMovie = mutation({
  args: {
    id: v.id('movies'),
    update: v.object({
      title: v.string(),
      director: v.string(),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch('movies', id, update)
  },
})
```

### Use access control in all public functions

Always verify `ctx.auth.getUserIdentity()` and check permissions. Never use spoofable arguments (like email) for access control.

```typescript
// ✅ Good - checks auth, uses ctx.auth (not spoofable)
export const updateTeam = mutation({
  args: { id: v.id("teams"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const isTeamMember = /* check membership using user.subject */;
    if (!isTeamMember) throw new Error("Unauthorized");

    await ctx.db.patch("teams", id, { name });
  },
});
```

### Only schedule internal functions

Use `internal.foo.bar` instead of `api.foo.bar` for scheduled functions and crons.

```typescript
// ❌ Bad
ctx.scheduler.runAfter(0, api.messages.sendMessage, { body })

// ✅ Good
ctx.scheduler.runAfter(0, internal.messages.sendMessage, { body })
```

## Code Organization

### Use helper functions for shared logic

Keep `query`, `mutation`, `action` wrappers thin. Put logic in plain TypeScript functions.

```typescript
// convex/model/users.ts
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return ctx.db
    .query('users')
    .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
    .unique()
}

// convex/conversations.ts
import * as Users from './model/users'

export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const user = await Users.getCurrentUser(ctx)
    // ... rest of logic
  },
})
```

### Use `runAction` only for different runtimes

Replace `ctx.runAction` with plain function calls when in the same runtime.

```typescript
// ❌ Bad - unnecessary overhead
await ctx.runAction(internal.scrape.scrapePage, { url })

// ✅ Good - direct function call
import * as Scrape from './model/scrape'
await Scrape.scrapePage(ctx, { url })
```

### Avoid sequential `ctx.runMutation`/`ctx.runQuery` in actions

Combine into single calls for consistency and atomicity.

```typescript
// ❌ Bad - separate transactions, may be inconsistent
const team = await ctx.runQuery(internal.teams.getTeam, { teamId })
const owner = await ctx.runQuery(internal.teams.getOwner, { teamId })

// ✅ Good - single transaction, consistent
const { team, owner } = await ctx.runQuery(internal.teams.getTeamAndOwner, {
  teamId,
})
```

## TypeScript Types

### Use generated types

```typescript
import { Doc, Id } from './_generated/dataModel'
import { QueryCtx, MutationCtx, ActionCtx } from './_generated/server'

export function myHelper(ctx: QueryCtx, id: Id<'channels'>) {
  /* ... */
}
```

### Infer types from validators

```typescript
import { Infer, v } from 'convex/values'

export const courseValidator = v.union(
  v.literal('appetizer'),
  v.literal('main'),
  v.literal('dessert'),
)

export type Course = Infer<typeof courseValidator>
// Inferred as 'appetizer' | 'main' | 'dessert'
```

### Use `WithoutSystemFields` for inserts

```typescript
import { WithoutSystemFields } from 'convex/server'
import { Doc } from './_generated/dataModel'

export async function insertMessage(
  ctx: MutationCtx,
  values: WithoutSystemFields<Doc<'messages'>>,
) {
  await ctx.db.insert('messages', values)
}
```

### Use `FunctionReturnType` on the client

```typescript
import { FunctionReturnType } from 'convex/server'
import { api } from '../convex/_generated/api'

type MessageData = FunctionReturnType<typeof api.messages.list>
```

## Checklist

Before releasing to production:

- [ ] All promises are awaited (use `no-floating-promises` ESLint rule)
- [ ] No `.filter()` on queries - use `.withIndex()` or filter in code
- [ ] `.collect()` only used with bounded result sets
- [ ] No redundant indexes (check for prefix duplicates)
- [ ] All public functions have argument validators
- [ ] All public functions have access control checks
- [ ] Scheduled functions use `internal.*` not `api.*`
- [ ] `ctx.db` calls include table name as first argument
- [ ] No `Date.now()` in queries

## Additional Resources

For detailed examples and patterns, see [reference.md](reference.md).
