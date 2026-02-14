import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

const DEFAULT_FTP = 180
const MIN_FTP = 1
const MAX_FTP = 2000
const DEFAULT_WEIGHT_KG = 75
const MIN_WEIGHT_KG = 20
const MAX_WEIGHT_KG = 300

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

function normalizeWeightKg(weightKg: number): number {
  const roundedToTenth = Math.round(weightKg * 10) / 10
  if (
    !Number.isFinite(roundedToTenth) ||
    roundedToTenth < MIN_WEIGHT_KG ||
    roundedToTenth > MAX_WEIGHT_KG
  ) {
    throw new Error(`Weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`)
  }
  return roundedToTenth
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
      weightKg: userData?.weightKg ?? DEFAULT_WEIGHT_KG,
    }
  },
})

export const setCurrentUserFtp = mutation({
  args: {
    ftp: v.number(),
    weightKg: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const existing = await ctx.db
      .query('userData')
      .withIndex('by_user_subject', (q) => q.eq('userSubject', userSubject))
      .unique()
    const ftp = normalizeFtp(args.ftp)
    const weightKg = normalizeWeightKg(
      args.weightKg ?? existing?.weightKg ?? DEFAULT_WEIGHT_KG,
    )
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ftp,
        weightKg,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('userData', {
        userSubject,
        ftp,
        weightKg,
        createdAt: now,
        updatedAt: now,
      })
    }

    return { ftp, weightKg }
  },
})
