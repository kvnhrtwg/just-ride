import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

const DEFAULT_FTP = 180
const MIN_FTP = 1
const MAX_FTP = 2000

async function requireUserSubject(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthorized')
  }
  return identity.subject
}

function normalizeFtp(ftp: number): number {
  const rounded = Math.round(ftp)
  if (!Number.isFinite(rounded) || rounded < MIN_FTP || rounded > MAX_FTP) {
    throw new Error(`FTP must be between ${MIN_FTP} and ${MAX_FTP}.`)
  }
  return rounded
}

export const getCurrentUserData = query({
  args: {},
  handler: async (ctx) => {
    const userSubject = await requireUserSubject(ctx)
    const userData = await ctx.db
      .query('userData')
      .withIndex('by_user_subject', (q) => q.eq('userSubject', userSubject))
      .unique()

    return {
      ftp: userData?.ftp ?? DEFAULT_FTP,
    }
  },
})

export const setCurrentUserFtp = mutation({
  args: {
    ftp: v.number(),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const ftp = normalizeFtp(args.ftp)
    const existing = await ctx.db
      .query('userData')
      .withIndex('by_user_subject', (q) => q.eq('userSubject', userSubject))
      .unique()
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ftp,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('userData', {
        userSubject,
        ftp,
        createdAt: now,
        updatedAt: now,
      })
    }

    return { ftp }
  },
})
