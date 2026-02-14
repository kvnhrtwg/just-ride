import { v } from 'convex/values'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'

const chunkSizeLimit = 120

const workoutIntensityValidator = v.union(
  v.literal('lit'),
  v.literal('mit'),
  v.literal('hit')
)

const finalizeStatusValidator = v.union(v.literal('completed'), v.literal('ended'))

const workoutSampleValidator = v.object({
  timestampMs: v.number(),
  elapsedSeconds: v.number(),
  segmentId: v.union(v.string(), v.null()),
  segmentIndex: v.number(),
  targetWatts: v.union(v.number(), v.null()),
  powerWatts: v.union(v.number(), v.null()),
  cadenceRpm: v.union(v.number(), v.null()),
  heartRateBpm: v.union(v.number(), v.null()),
})

type WorkoutSample = {
  timestampMs: number
  elapsedSeconds: number
  segmentId: string | null
  segmentIndex: number
  targetWatts: number | null
  powerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

async function requireUserSubject(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthorized')
  }
  return identity.subject
}

function normalizeTimestamp(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return Date.now()
  }
  return rounded
}

function normalizeChunkIndex(chunkIndex: number): number {
  const rounded = Math.round(chunkIndex)
  if (!Number.isFinite(rounded) || rounded < 0) {
    throw new Error('Chunk index must be a non-negative integer.')
  }
  return rounded
}

function normalizeSample(sample: WorkoutSample): WorkoutSample {
  const normalizedElapsed = Math.max(0, Math.round(sample.elapsedSeconds))
  return {
    timestampMs: normalizeTimestamp(sample.timestampMs),
    elapsedSeconds: normalizedElapsed,
    segmentId: sample.segmentId,
    segmentIndex: Math.max(0, Math.round(sample.segmentIndex)),
    targetWatts:
      typeof sample.targetWatts === 'number' && Number.isFinite(sample.targetWatts)
        ? Math.max(0, Math.round(sample.targetWatts))
        : null,
    powerWatts:
      typeof sample.powerWatts === 'number' && Number.isFinite(sample.powerWatts)
        ? Math.max(0, Math.round(sample.powerWatts))
        : null,
    cadenceRpm:
      typeof sample.cadenceRpm === 'number' && Number.isFinite(sample.cadenceRpm)
        ? Math.max(0, Math.round(sample.cadenceRpm))
        : null,
    heartRateBpm:
      typeof sample.heartRateBpm === 'number' && Number.isFinite(sample.heartRateBpm)
        ? Math.max(0, Math.round(sample.heartRateBpm))
        : null,
  }
}

export const startWorkoutSession = mutation({
  args: {
    workoutId: v.string(),
    workoutTitle: v.string(),
    workoutIntensity: workoutIntensityValidator,
    workoutSourcePath: v.string(),
    plannedDurationSeconds: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const now = Date.now()
    const startedAt = normalizeTimestamp(args.startedAt)
    const plannedDurationSeconds = Math.max(0, Math.round(args.plannedDurationSeconds))

    return await ctx.db.insert('workoutSessions', {
      userSubject,
      workoutId: args.workoutId,
      workoutTitle: args.workoutTitle.trim(),
      workoutIntensity: args.workoutIntensity,
      workoutSourcePath: args.workoutSourcePath,
      plannedDurationSeconds,
      startedAt,
      status: 'recording',
      sampleCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const appendWorkoutSampleChunk = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
    chunkIndex: v.number(),
    samples: v.array(workoutSampleValidator),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    if (args.samples.length === 0) {
      return { inserted: false, reason: 'empty_chunk' as const }
    }
    if (args.samples.length > chunkSizeLimit) {
      throw new Error(`Chunk size must be <= ${chunkSizeLimit} samples.`)
    }

    const chunkIndex = normalizeChunkIndex(args.chunkIndex)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userSubject !== userSubject) {
      throw new Error('Workout session not found.')
    }
    if (session.status !== 'recording') {
      return { inserted: false, reason: 'session_not_recording' as const }
    }

    const existingChunk = await ctx.db
      .query('workoutSampleChunks')
      .withIndex('by_session_chunk', (q) =>
        q.eq('sessionId', args.sessionId).eq('chunkIndex', chunkIndex)
      )
      .unique()
    if (existingChunk) {
      return { inserted: false, reason: 'duplicate_chunk' as const }
    }

    const samples = args.samples.map(normalizeSample).sort((left, right) => {
      if (left.elapsedSeconds !== right.elapsedSeconds) {
        return left.elapsedSeconds - right.elapsedSeconds
      }
      return left.timestampMs - right.timestampMs
    })
    const now = Date.now()
    const fromElapsedSeconds = samples[0]?.elapsedSeconds ?? 0
    const toElapsedSeconds = samples[samples.length - 1]?.elapsedSeconds ?? fromElapsedSeconds

    await ctx.db.insert('workoutSampleChunks', {
      userSubject,
      sessionId: args.sessionId,
      chunkIndex,
      fromElapsedSeconds,
      toElapsedSeconds,
      sampleCount: samples.length,
      samples,
      createdAt: now,
    })

    await ctx.db.patch(session._id, {
      sampleCount: session.sampleCount + samples.length,
      updatedAt: now,
    })

    return { inserted: true as const }
  },
})

export const finalizeWorkoutSession = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
    status: finalizeStatusValidator,
    endedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userSubject !== userSubject) {
      throw new Error('Workout session not found.')
    }
    if (session.status !== 'recording') {
      return {
        sessionId: session._id,
        status: session.status,
        sampleCount: session.sampleCount,
      }
    }

    const chunks = await ctx.db
      .query('workoutSampleChunks')
      .withIndex('by_session_chunk', (q) => q.eq('sessionId', session._id))
      .collect()

    let sampleCount = 0
    let maxElapsedSeconds = 0
    let powerSum = 0
    let powerCount = 0
    let maxPowerWatts: number | null = null
    let heartRateSum = 0
    let heartRateCount = 0
    let maxHeartRateBpm: number | null = null
    let cadenceSum = 0
    let cadenceCount = 0
    let maxCadenceRpm: number | null = null

    for (const chunk of chunks) {
      for (const sample of chunk.samples) {
        sampleCount += 1
        if (sample.elapsedSeconds > maxElapsedSeconds) {
          maxElapsedSeconds = sample.elapsedSeconds
        }
        if (typeof sample.powerWatts === 'number') {
          powerSum += sample.powerWatts
          powerCount += 1
          maxPowerWatts =
            maxPowerWatts === null ? sample.powerWatts : Math.max(maxPowerWatts, sample.powerWatts)
        }
        if (typeof sample.heartRateBpm === 'number') {
          heartRateSum += sample.heartRateBpm
          heartRateCount += 1
          maxHeartRateBpm =
            maxHeartRateBpm === null
              ? sample.heartRateBpm
              : Math.max(maxHeartRateBpm, sample.heartRateBpm)
        }
        if (typeof sample.cadenceRpm === 'number') {
          cadenceSum += sample.cadenceRpm
          cadenceCount += 1
          maxCadenceRpm =
            maxCadenceRpm === null ? sample.cadenceRpm : Math.max(maxCadenceRpm, sample.cadenceRpm)
        }
      }
    }

    const endedAt = normalizeTimestamp(args.endedAt ?? Date.now())
    const now = Date.now()
    await ctx.db.patch(session._id, {
      status: args.status,
      endedAt,
      sampleCount,
      elapsedSeconds: maxElapsedSeconds,
      averagePowerWatts: powerCount > 0 ? Math.round(powerSum / powerCount) : undefined,
      maxPowerWatts: maxPowerWatts ?? undefined,
      averageHeartRateBpm:
        heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : undefined,
      maxHeartRateBpm: maxHeartRateBpm ?? undefined,
      averageCadenceRpm: cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : undefined,
      maxCadenceRpm: maxCadenceRpm ?? undefined,
      updatedAt: now,
    })

    return {
      sessionId: session._id,
      status: args.status,
      sampleCount,
    }
  },
})

export const getWorkoutSessionForFitExport = query({
  args: {
    sessionId: v.id('workoutSessions'),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userSubject !== userSubject) {
      throw new Error('Workout session not found.')
    }
    if (session.status === 'recording') {
      throw new Error('Workout is still recording.')
    }

    const chunks = await ctx.db
      .query('workoutSampleChunks')
      .withIndex('by_session_chunk', (q) => q.eq('sessionId', session._id))
      .collect()

    const samples = chunks
      .slice()
      .sort((left, right) => left.chunkIndex - right.chunkIndex)
      .flatMap((chunk) => chunk.samples)
      .sort((left, right) => {
        if (left.elapsedSeconds !== right.elapsedSeconds) {
          return left.elapsedSeconds - right.elapsedSeconds
        }
        return left.timestampMs - right.timestampMs
      })

    return {
      session: {
        _id: session._id,
        workoutId: session.workoutId,
        workoutTitle: session.workoutTitle,
        workoutIntensity: session.workoutIntensity,
        startedAt: session.startedAt,
        endedAt: session.endedAt ?? null,
        elapsedSeconds: session.elapsedSeconds ?? 0,
      },
      samples,
    }
  },
})

export const discardWorkoutSession = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
  },
  handler: async (ctx, args) => {
    const userSubject = await requireUserSubject(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userSubject !== userSubject) {
      throw new Error('Workout session not found.')
    }

    const chunks = await ctx.db
      .query('workoutSampleChunks')
      .withIndex('by_session_chunk', (q) => q.eq('sessionId', session._id))
      .collect()

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id)
    }
    await ctx.db.delete(session._id)

    return { discarded: true as const }
  },
})
