import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkoutDefinition, WorkoutSegment } from '@/workouts/catalog'

const DEFAULT_RAMP_UPDATE_INTERVAL_SECONDS = 15

export type WorkoutExecutionSample = {
  timestampMs: number
  elapsedSeconds: number
  segmentId: string | null
  segmentIndex: number
  targetWatts: number | null
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

type UseWorkoutExecutionOptions = {
  ftp: number
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
  setErgTargetValue: (
    value: number,
    options?: { announce?: boolean }
  ) => Promise<boolean>
  rampUpdateIntervalSeconds?: number
  onSample?: (sample: WorkoutExecutionSample) => void
}

export type WorkoutExecutionModel = {
  activeWorkout: WorkoutDefinition | null
  isRunning: boolean
  isPaused: boolean
  isCompleted: boolean
  elapsedSeconds: number
  totalDurationSeconds: number
  remainingSeconds: number
  progressRatio: number
  activeSegment: WorkoutSegment | null
  activeSegmentIndex: number
  nextSegment: WorkoutSegment | null
  currentTargetWatts: number | null
  recordedSamples: WorkoutExecutionSample[]
  start: (workout: WorkoutDefinition) => void
  pause: () => void
  resume: () => void
  end: () => void
  skipSegment: () => void
  stop: () => void
}

export function useWorkoutExecution({
  ftp,
  livePowerWatts,
  cadenceRpm,
  heartRateBpm,
  setErgTargetValue,
  onSample,
  rampUpdateIntervalSeconds = DEFAULT_RAMP_UPDATE_INTERVAL_SECONDS,
}: UseWorkoutExecutionOptions): WorkoutExecutionModel {
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDefinition | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentTargetWatts, setCurrentTargetWatts] = useState<number | null>(null)
  const [recordedSamples, setRecordedSamples] = useState<WorkoutExecutionSample[]>([])
  const lastSentTargetRef = useRef<number | null>(null)
  const lastSampleElapsedRef = useRef<number>(-1)

  const activeSegmentIndex = useMemo(
    () => getSegmentIndexForElapsed(activeWorkout, elapsedSeconds),
    [activeWorkout, elapsedSeconds]
  )
  const activeSegment =
    activeWorkout && activeSegmentIndex >= 0
      ? activeWorkout.segments[activeSegmentIndex]
      : null
  const nextSegment =
    activeWorkout && activeSegmentIndex >= 0
      ? activeWorkout.segments[activeSegmentIndex + 1] ?? null
      : null

  const totalDurationSeconds = activeWorkout?.totalDurationSeconds ?? 0
  const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds)
  const progressRatio =
    totalDurationSeconds > 0 ? Math.min(1, elapsedSeconds / totalDurationSeconds) : 0

  const start = useCallback((workout: WorkoutDefinition) => {
    setActiveWorkout(workout)
    setIsRunning(true)
    setIsPaused(false)
    setIsCompleted(false)
    setElapsedSeconds(0)
    setCurrentTargetWatts(null)
    setRecordedSamples([])
    lastSentTargetRef.current = null
    lastSampleElapsedRef.current = -1
  }, [])

  const pause = useCallback(() => {
    setIsPaused(true)
    setIsRunning(false)
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
    setIsRunning(true)
  }, [])

  const end = useCallback(() => {
    setIsRunning(false)
    setIsPaused(false)
    setIsCompleted(true)
    setCurrentTargetWatts(null)
  }, [])

  const stop = useCallback(() => {
    setActiveWorkout(null)
    setIsRunning(false)
    setIsPaused(false)
    setIsCompleted(false)
    setElapsedSeconds(0)
    setCurrentTargetWatts(null)
    lastSentTargetRef.current = null
    lastSampleElapsedRef.current = -1
  }, [])

  const skipSegment = useCallback(() => {
    if (!activeWorkout || activeSegmentIndex < 0) {
      return
    }

    const nextIndex = activeSegmentIndex + 1
    if (nextIndex >= activeWorkout.segments.length) {
      setElapsedSeconds(activeWorkout.totalDurationSeconds)
      setIsRunning(false)
      setIsPaused(false)
      setIsCompleted(true)
      setCurrentTargetWatts(null)
      return
    }

    setElapsedSeconds(activeWorkout.segments[nextIndex].startSecond)
  }, [activeSegmentIndex, activeWorkout])

  useEffect(() => {
    if (!activeWorkout || !isRunning || isPaused || isCompleted) {
      return
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => {
        if (current >= activeWorkout.totalDurationSeconds) {
          return current
        }
        return current + 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeWorkout, isCompleted, isPaused, isRunning])

  useEffect(() => {
    if (!activeWorkout || isCompleted) {
      return
    }

    if (elapsedSeconds < activeWorkout.totalDurationSeconds) {
      return
    }

    setElapsedSeconds(activeWorkout.totalDurationSeconds)
    setIsRunning(false)
    setIsPaused(false)
    setIsCompleted(true)
    setCurrentTargetWatts(null)
  }, [activeWorkout, elapsedSeconds, isCompleted])

  useEffect(() => {
    if (!activeWorkout || !isRunning || isPaused || isCompleted || activeSegmentIndex < 0) {
      return
    }

    const segment = activeWorkout.segments[activeSegmentIndex]
    const secondsIntoSegment = Math.max(0, elapsedSeconds - segment.startSecond)
    const dispatchSecond = getDispatchSecond({
      segment,
      secondsIntoSegment,
      rampUpdateIntervalSeconds,
    })
    if (dispatchSecond === null) {
      return
    }

    const nextTarget = getSegmentTargetWatts({
      segment,
      secondsIntoSegment: dispatchSecond,
      ftp,
    })
    setCurrentTargetWatts(nextTarget)

    const isScheduledDispatch = dispatchSecond === secondsIntoSegment
    const needsRetry = lastSentTargetRef.current !== nextTarget
    if (!isScheduledDispatch && !needsRetry) {
      return
    }

    if (lastSentTargetRef.current === nextTarget) {
      return
    }

    void (async () => {
      const sent = await setErgTargetValue(nextTarget, { announce: false })
      if (sent) {
        lastSentTargetRef.current = nextTarget
      }
    })()
  }, [
    activeSegmentIndex,
    activeWorkout,
    elapsedSeconds,
    ftp,
    isCompleted,
    isPaused,
    isRunning,
    rampUpdateIntervalSeconds,
    setErgTargetValue,
  ])

  useEffect(() => {
    if (
      !activeWorkout ||
      !isRunning ||
      isPaused ||
      isCompleted ||
      elapsedSeconds === lastSampleElapsedRef.current
    ) {
      return
    }

    lastSampleElapsedRef.current = elapsedSeconds
    const sample: WorkoutExecutionSample = {
      timestampMs: Date.now(),
      elapsedSeconds,
      segmentId: activeSegment?.id ?? null,
      segmentIndex: activeSegmentIndex,
      targetWatts: currentTargetWatts,
      livePowerWatts,
      cadenceRpm,
      heartRateBpm,
    }
    setRecordedSamples((current) => [...current, sample])
    onSample?.(sample)
  }, [
    activeSegment,
    activeSegmentIndex,
    activeWorkout,
    currentTargetWatts,
    elapsedSeconds,
    heartRateBpm,
    isCompleted,
    isPaused,
    isRunning,
    cadenceRpm,
    livePowerWatts,
    onSample,
  ])

  return {
    activeWorkout,
    isRunning,
    isPaused,
    isCompleted,
    elapsedSeconds,
    totalDurationSeconds,
    remainingSeconds,
    progressRatio,
    activeSegment,
    activeSegmentIndex,
    nextSegment,
    currentTargetWatts,
    recordedSamples,
    start,
    pause,
    resume,
    end,
    skipSegment,
    stop,
  }
}

function getSegmentIndexForElapsed(
  workout: WorkoutDefinition | null,
  elapsedSeconds: number
): number {
  if (!workout || workout.segments.length === 0) {
    return -1
  }

  const boundedElapsed = Math.max(0, elapsedSeconds)
  for (let index = 0; index < workout.segments.length; index += 1) {
    const segment = workout.segments[index]
    const segmentEnd = segment.startSecond + segment.durationSeconds
    if (boundedElapsed >= segment.startSecond && boundedElapsed < segmentEnd) {
      return index
    }
  }

  return -1
}

function getDispatchSecond({
  segment,
  secondsIntoSegment,
  rampUpdateIntervalSeconds,
}: {
  segment: WorkoutSegment
  secondsIntoSegment: number
  rampUpdateIntervalSeconds: number
}): number | null {
  if (segment.durationSeconds <= 0) {
    return null
  }

  if (secondsIntoSegment === 0) {
    return 0
  }

  const isRamp = segment.kind === 'ramp' && segment.ftpLow !== segment.ftpHigh
  if (!isRamp) {
    return 0
  }

  const rampInterval = Math.max(1, Math.round(rampUpdateIntervalSeconds))
  const segmentEndSecond = Math.max(0, segment.durationSeconds - 1)
  if (secondsIntoSegment >= segmentEndSecond) {
    return segmentEndSecond
  }

  return Math.floor(secondsIntoSegment / rampInterval) * rampInterval
}

function getSegmentTargetWatts({
  segment,
  secondsIntoSegment,
  ftp,
}: {
  segment: WorkoutSegment
  secondsIntoSegment: number
  ftp: number
}): number {
  const safeFtp = Number.isFinite(ftp) && ftp > 0 ? ftp : 1
  const isRamp = segment.kind === 'ramp' && segment.ftpLow !== segment.ftpHigh
  if (!isRamp) {
    return Math.round(segment.ftpLow * safeFtp)
  }

  const boundedSeconds = clamp(secondsIntoSegment, 0, Math.max(0, segment.durationSeconds - 1))
  const denominator = Math.max(1, segment.durationSeconds - 1)
  const progress = boundedSeconds / denominator
  const ftpRatio = segment.ftpLow + (segment.ftpHigh - segment.ftpLow) * progress
  return Math.round(ftpRatio * safeFtp)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
