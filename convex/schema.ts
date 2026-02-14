import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const workoutIntensityValidator = v.union(
  v.literal('lit'),
  v.literal('mit'),
  v.literal('hit')
)

const workoutStatusValidator = v.union(
  v.literal('recording'),
  v.literal('completed'),
  v.literal('ended')
)

const workoutSampleValidator = v.object({
  timestampMs: v.number(),
  elapsedSeconds: v.number(),
  segmentId: v.union(v.string(), v.null()),
  segmentIndex: v.number(),
  powerWatts: v.union(v.number(), v.null()),
  cadenceRpm: v.union(v.number(), v.null()),
  heartRateBpm: v.union(v.number(), v.null()),
})

export default defineSchema({
  userData: defineTable({
    userSubject: v.string(),
    ftp: v.number(),
    weightKg: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_subject', ['userSubject']),
  workoutSessions: defineTable({
    userSubject: v.string(),
    workoutId: v.string(),
    workoutTitle: v.string(),
    workoutIntensity: workoutIntensityValidator,
    workoutSourcePath: v.string(),
    plannedDurationSeconds: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    status: workoutStatusValidator,
    sampleCount: v.number(),
    elapsedSeconds: v.optional(v.number()),
    averagePowerWatts: v.optional(v.number()),
    maxPowerWatts: v.optional(v.number()),
    averageHeartRateBpm: v.optional(v.number()),
    maxHeartRateBpm: v.optional(v.number()),
    averageCadenceRpm: v.optional(v.number()),
    maxCadenceRpm: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_started_at', ['userSubject', 'startedAt'])
    .index('by_user_status', ['userSubject', 'status']),
  workoutSampleChunks: defineTable({
    userSubject: v.string(),
    sessionId: v.id('workoutSessions'),
    chunkIndex: v.number(),
    fromElapsedSeconds: v.number(),
    toElapsedSeconds: v.number(),
    sampleCount: v.number(),
    samples: v.array(workoutSampleValidator),
    createdAt: v.number(),
  }).index('by_session_chunk', ['sessionId', 'chunkIndex']),
})
