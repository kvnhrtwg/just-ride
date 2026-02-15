import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

const defaultBatchSize = 50
const maxBatchSize = 200

// Repeat this mutation with the returned continueCursor until isDone is true.
export const removeWorkoutSampleTargetWattsBatch = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize)
    const page = await ctx.db.query('workoutSampleChunks').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    })

    let scannedChunks = 0
    let patchedChunks = 0
    let removedSampleFields = 0
    const dryRun = args.dryRun ?? false

    for (const chunk of page.page) {
      scannedChunks += 1
      let changed = false
      const cleanedSamples = chunk.samples.map((sample) => {
        if (!('targetWatts' in sample)) {
          return sample
        }
        changed = true
        removedSampleFields += 1
        const { targetWatts: _targetWatts, ...sampleWithoutTarget } =
          sample as typeof sample & {
            targetWatts?: number | null
          }
        return sampleWithoutTarget
      })

      if (changed) {
        patchedChunks += 1
        if (!dryRun) {
          await ctx.db.patch(chunk._id, {
            samples: cleanedSamples,
          })
        }
      }
    }

    return {
      dryRun,
      scannedChunks,
      patchedChunks,
      removedSampleFields,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})

function normalizeBatchSize(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultBatchSize
  }
  return Math.max(1, Math.min(maxBatchSize, Math.round(value)))
}
