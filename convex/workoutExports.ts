'use node'

import { Buffer } from 'node:buffer'
import { action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'
import { Encoder, Profile, Utils } from '@garmin/fitsdk'

export const generateWorkoutFitDownload = action({
  args: {
    sessionId: v.id('workoutSessions'),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    fileName: string
    contentBase64: string
  }> => {
    const exportData = (await ctx.runQuery(api.workouts.getWorkoutSessionForFitExport, {
      sessionId: args.sessionId,
    })) as {
      session: {
        workoutTitle: string
        startedAt: number
        endedAt: number | null
        elapsedSeconds: number
      }
      samples: Array<{
        timestampMs: number
        powerWatts: number | null
        cadenceRpm: number | null
        heartRateBpm: number | null
      }>
    }

    const samples = exportData.samples
    if (samples.length === 0) {
      throw new Error('No workout samples were recorded for this session.')
    }

    const startTimestampMs = exportData.session.startedAt
    const endTimestampMs =
      exportData.session.endedAt ??
      samples[samples.length - 1]?.timestampMs ??
      startTimestampMs + exportData.session.elapsedSeconds * 1000

    const startDateTime = Utils.convertDateToDateTime(new Date(startTimestampMs))
    const endDateTime = Utils.convertDateToDateTime(new Date(endTimestampMs))
    const localTimestampOffsetSeconds = new Date(endTimestampMs).getTimezoneOffset() * -60
    const totalElapsedSeconds = Math.max(
      1,
      Math.round((endTimestampMs - startTimestampMs) / 1000)
    )

    const encoder = new Encoder()
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.FILE_ID,
      type: 'activity',
      manufacturer: 'development',
      product: 1,
      timeCreated: startDateTime,
      serialNumber: Math.max(1, Math.round(startTimestampMs / 1000)),
    })
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.DEVICE_INFO,
      deviceIndex: 'creator',
      manufacturer: 'development',
      productName: 'Just Ride',
      timestamp: startDateTime,
    })
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.EVENT,
      timestamp: startDateTime,
      event: 'timer',
      eventType: 'start',
    })

    for (const sample of samples) {
      const recordMesg: Record<string, unknown> = {
        mesgNum: Profile.MesgNum.RECORD,
        timestamp: Utils.convertDateToDateTime(new Date(sample.timestampMs)),
      }
      assignRecordMetric(recordMesg, 'power', sample.powerWatts)
      assignRecordMetric(recordMesg, 'cadence', sample.cadenceRpm)
      assignRecordMetric(recordMesg, 'heartRate', sample.heartRateBpm)
      encoder.writeMesg(recordMesg)
    }

    encoder.writeMesg({
      mesgNum: Profile.MesgNum.EVENT,
      timestamp: endDateTime,
      event: 'timer',
      eventType: 'stop',
    })
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.LAP,
      messageIndex: 0,
      timestamp: endDateTime,
      startTime: startDateTime,
      totalElapsedTime: totalElapsedSeconds,
      totalTimerTime: totalElapsedSeconds,
    })
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.SESSION,
      messageIndex: 0,
      timestamp: endDateTime,
      startTime: startDateTime,
      totalElapsedTime: totalElapsedSeconds,
      totalTimerTime: totalElapsedSeconds,
      sport: 'cycling',
      firstLapIndex: 0,
      numLaps: 1,
    })
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.ACTIVITY,
      timestamp: endDateTime,
      numSessions: 1,
      localTimestamp: endDateTime + localTimestampOffsetSeconds,
      totalTimerTime: totalElapsedSeconds,
    })

    const fitBytes = encoder.close()
    return {
      fileName: buildFitFileName(exportData.session.workoutTitle, startTimestampMs),
      contentBase64: Buffer.from(fitBytes).toString('base64'),
    }
  },
})

function assignRecordMetric(
  recordMesg: Record<string, unknown>,
  fieldName: 'power' | 'cadence' | 'heartRate',
  value: number | null
) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    recordMesg[fieldName] = Math.max(0, Math.round(value))
  }
}

function buildFitFileName(workoutTitle: string, startedAt: number): string {
  const date = new Date(startedAt)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const safeTitle = workoutTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${yyyy}-${mm}-${dd}_${safeTitle || 'workout'}.fit`
}

