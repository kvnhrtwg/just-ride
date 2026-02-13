# Convex Best Practices Reference

Detailed examples and patterns for Convex development.

## Index Best Practices

### Check for redundant indexes

An index `by_foo` is redundant if `by_foo_and_bar` exists (since you can query `by_foo_and_bar` with only the `foo` condition).

```typescript
// schema.ts
// ❌ Redundant - by_team is a prefix of by_team_and_user
defineTable({...})
  .index("by_team", ["team"])
  .index("by_team_and_user", ["team", "user"])

// ✅ Just use the compound index
defineTable({...})
  .index("by_team_and_user", ["team", "user"])

// Query for team only:
ctx.db.query("teamMembers")
  .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
  .collect();
```

**Exception**: If you need to sort by `_creationTime` after a single field, keep both indexes:

- `.index("by_channel", ["channel"])` - sorts by channel, then `_creationTime`
- `.index("by_channel_and_author", ["channel", "author"])` - sorts by channel, author, then `_creationTime`

## Helper Function Patterns

### Organizing code in `convex/model/`

```typescript
// convex/model/users.ts
import { QueryCtx } from '../_generated/server'

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')

  const user = await ctx.db
    .query('users')
    .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
    .unique()

  if (!user) throw new Error('User not found')
  return user
}

export async function load(ctx: QueryCtx, { userId }: { userId: Id<'users'> }) {
  const user = await ctx.db.get('users', userId)
  if (!user) throw new Error('User not found')
  return user
}
```

```typescript
// convex/model/conversations.ts
import { QueryCtx, MutationCtx } from '../_generated/server'
import * as Users from './users'

export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<'conversations'> },
) {
  const user = await Users.getCurrentUser(ctx)
  const conversation = await ctx.db.get('conversations', conversationId)

  if (!conversation || !conversation.members.includes(user._id)) {
    throw new Error('Unauthorized')
  }
  return conversation
}

export async function listMessages(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<'conversations'> },
) {
  await ensureHasAccess(ctx, { conversationId })
  return ctx.db
    .query('messages')
    .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
    .collect()
}
```

```typescript
// convex/conversations.ts - thin wrapper
import * as Conversations from './model/conversations'

export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    return Conversations.listMessages(ctx, args)
  },
})
```

## Action Patterns

### Combining queries in actions

```typescript
// ❌ Bad - two separate transactions
export const summarize = action({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    })
    const participants = await ctx.runQuery(api.conversations.getParticipants, {
      conversationId,
    })
    // ...
  },
})

// ✅ Good - single transaction
export const getConversationData = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const messages = await Conversations.listMessages(ctx, { conversationId })
    const participants = await Conversations.getParticipants(ctx, {
      conversationId,
    })
    return { messages, participants }
  },
})

export const summarize = action({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const { messages, participants } = await ctx.runQuery(
      internal.conversations.getConversationData,
      { conversationId },
    )
    // ...
  },
})
```

### Batching mutations in actions

```typescript
// ❌ Bad - loses atomicity
export const importUsers = action({
  args: { teamId: v.id('teams') },
  handler: async (ctx, { teamId }) => {
    const users = await fetchUsersFromAPI(teamId)
    for (const user of users) {
      await ctx.runMutation(internal.users.insert, user)
    }
  },
})

// ✅ Good - atomic batch insert
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const user of users) {
      await ctx.db.insert('users', user)
    }
  },
})

export const importUsers = action({
  args: { teamId: v.id('teams') },
  handler: async (ctx, { teamId }) => {
    const users = await fetchUsersFromAPI(teamId)
    await ctx.runMutation(internal.users.insertUsers, { users })
  },
})
```

## TypeScript Patterns

### Frontend type annotations

```typescript
// src/components/Channel.tsx
import { Doc, Id } from '../convex/_generated/dataModel'
import { FunctionReturnType } from 'convex/server'
import { UsePaginatedQueryReturnType } from 'convex/react'
import { api } from '../convex/_generated/api'

// Using Doc and Id
function Channel({ channelId }: { channelId: Id<'channels'> }) {
  /* ... */
}
function MessageView({ message }: { message: Doc<'messages'> }) {
  /* ... */
}

// Using FunctionReturnType
type ChannelData = FunctionReturnType<typeof api.channels.get>

// Using UsePaginatedQueryReturnType
type PaginatedMessages = UsePaginatedQueryReturnType<typeof api.messages.list>
```

### Reusable validators

```typescript
// convex/validators.ts
import { v, Infer } from 'convex/values'

export const statusValidator = v.union(
  v.literal('pending'),
  v.literal('active'),
  v.literal('completed'),
)

export type Status = Infer<typeof statusValidator>

// Use in schema
export default defineSchema({
  tasks: defineTable({
    status: statusValidator,
    // ...
  }),
})

// Use in function
export const updateStatus = mutation({
  args: {
    id: v.id('tasks'),
    status: statusValidator,
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch('tasks', id, { status })
  },
})
```

## Partial Rollback Pattern

Use `ctx.runMutation` within mutations only when you need partial rollback:

```typescript
export const trySendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, { body, author }) => {
    try {
      // This runs in a nested transaction
      await ctx.runMutation(internal.messages.sendMessage, { body, author })
    } catch (e) {
      // sendMessage writes are rolled back, but we can still write here
      await ctx.db.insert('failures', {
        kind: 'MessageFailed',
        body,
        author,
        error: `${e}`,
      })
    }
  },
})
```

## ESLint Rules

Recommended ESLint rules for Convex:

```javascript
// eslint.config.js
export default [
  // ...
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@convex-dev/require-argument-validators': 'error',
      '@convex-dev/explicit-table-ids': 'error',
    },
  },
]
```

Install with:

```bash
npm install -D @convex-dev/eslint-plugin
```
