export type FakeWorkoutTelemetrySnapshot = {
  powerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

type FakeWorkoutTelemetryListener = (snapshot: FakeWorkoutTelemetrySnapshot) => void

type FakeWorkoutTelemetryService = {
  start: () => void
  stop: () => void
  setTargetWatts: (targetWatts: number | null) => void
  getSnapshot: () => FakeWorkoutTelemetrySnapshot
  subscribe: (listener: FakeWorkoutTelemetryListener) => () => void
}

type CreateFakeWorkoutTelemetryServiceOptions = {
  tickIntervalMs?: number
}

const DEFAULT_TICK_INTERVAL_MS = 1000
const CADENCE_RANGE = { min: 70, max: 90 }
const HEART_RATE_RANGE = { min: 100, max: 140 }
const MAX_TARGET_WATTS = 2000

export function createFakeWorkoutTelemetryService(
  options: CreateFakeWorkoutTelemetryServiceOptions = {}
): FakeWorkoutTelemetryService {
  const tickIntervalMs = Math.max(250, Math.round(options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS))
  const listeners = new Set<FakeWorkoutTelemetryListener>()

  let timer: ReturnType<typeof setInterval> | null = null
  let targetWatts: number | null = null
  let snapshot: FakeWorkoutTelemetrySnapshot = {
    powerWatts: null,
    cadenceRpm: null,
    heartRateBpm: null,
  }

  const emit = () => {
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const tick = () => {
    const nextPowerWatts = targetWatts
    const targetRatio = targetWatts === null ? 0.45 : clamp(targetWatts / 320, 0, 1)
    const desiredCadence = 74 + targetRatio * 12
    const desiredHeartRate = 104 + targetRatio * 32

    const currentCadence = snapshot.cadenceRpm ?? 78
    const currentHeartRate = snapshot.heartRateBpm ?? 112

    const nextCadence = Math.round(
      clamp(
        currentCadence + clamp(desiredCadence - currentCadence, -1.4, 1.4) + randomBetween(-1.2, 1.2),
        CADENCE_RANGE.min,
        CADENCE_RANGE.max
      )
    )
    const nextHeartRate = Math.round(
      clamp(
        currentHeartRate +
          clamp(desiredHeartRate - currentHeartRate, -1.8, 1.8) +
          randomBetween(-1.5, 1.5),
        HEART_RATE_RANGE.min,
        HEART_RATE_RANGE.max
      )
    )

    snapshot = {
      powerWatts: nextPowerWatts,
      cadenceRpm: nextCadence,
      heartRateBpm: nextHeartRate,
    }
    emit()
  }

  return {
    start: () => {
      if (timer !== null) {
        return
      }
      if (snapshot.cadenceRpm === null || snapshot.heartRateBpm === null) {
        snapshot = {
          powerWatts: targetWatts,
          cadenceRpm: Math.round(randomBetween(75, 82)),
          heartRateBpm: Math.round(randomBetween(108, 118)),
        }
        emit()
      }
      timer = setInterval(tick, tickIntervalMs)
    },
    stop: () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      snapshot = {
        powerWatts: null,
        cadenceRpm: null,
        heartRateBpm: null,
      }
      emit()
    },
    setTargetWatts: (nextTargetWatts: number | null) => {
      targetWatts =
        typeof nextTargetWatts === 'number' && Number.isFinite(nextTargetWatts)
          ? clamp(Math.round(nextTargetWatts), 0, MAX_TARGET_WATTS)
          : null
      if (snapshot.powerWatts !== targetWatts) {
        snapshot = {
          ...snapshot,
          powerWatts: targetWatts,
        }
        emit()
      }
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(snapshot)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
