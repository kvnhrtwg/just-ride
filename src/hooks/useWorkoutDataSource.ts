import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionState } from '@/hooks/useTrainerBluetooth'
import { createFakeWorkoutTelemetryService } from '@/services/fakeWorkoutTelemetry'
import type { FakeWorkoutTelemetrySnapshot } from '@/services/fakeWorkoutTelemetry'

type UseWorkoutDataSourceOptions = {
  connectionState: ConnectionState
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
  setTrainerErgTargetValue: (
    value: number,
    options?: { announce?: boolean }
  ) => Promise<boolean>
  isWorkoutPendingOrActive: boolean
  canUseFakeTelemetry: boolean
}

type WorkoutDataSourceModel = {
  isUsingFakeTelemetry: boolean
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
  setErgTargetValue: (
    value: number,
    options?: { announce?: boolean }
  ) => Promise<boolean>
}

export function useWorkoutDataSource({
  connectionState,
  livePowerWatts,
  cadenceRpm,
  heartRateBpm,
  setTrainerErgTargetValue,
  isWorkoutPendingOrActive,
  canUseFakeTelemetry,
}: UseWorkoutDataSourceOptions): WorkoutDataSourceModel {
  const fakeServiceRef = useRef(createFakeWorkoutTelemetryService())
  const [fakeSnapshot, setFakeSnapshot] = useState<FakeWorkoutTelemetrySnapshot>(
    fakeServiceRef.current.getSnapshot()
  )
  const isUsingFakeTelemetry =
    canUseFakeTelemetry && isWorkoutPendingOrActive && connectionState !== 'connected'

  useEffect(() => {
    return fakeServiceRef.current.subscribe(setFakeSnapshot)
  }, [])

  useEffect(() => {
    if (isUsingFakeTelemetry) {
      fakeServiceRef.current.start()
      return
    }

    fakeServiceRef.current.stop()
    fakeServiceRef.current.setErgSetpointWatts(null)
  }, [isUsingFakeTelemetry])

  const setErgTargetValue = useCallback(
    async (value: number, options?: { announce?: boolean }) => {
      if (isUsingFakeTelemetry) {
        fakeServiceRef.current.setErgSetpointWatts(value)
        return true
      }
      return setTrainerErgTargetValue(value, options)
    },
    [isUsingFakeTelemetry, setTrainerErgTargetValue]
  )

  if (isUsingFakeTelemetry) {
    return {
      isUsingFakeTelemetry,
      livePowerWatts: fakeSnapshot.powerWatts,
      cadenceRpm: fakeSnapshot.cadenceRpm,
      heartRateBpm: fakeSnapshot.heartRateBpm,
      setErgTargetValue,
    }
  }

  return {
    isUsingFakeTelemetry,
    livePowerWatts,
    cadenceRpm,
    heartRateBpm,
    setErgTargetValue,
  }
}
