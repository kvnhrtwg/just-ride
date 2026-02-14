import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { Header } from '@/components/Header'
import { MetricCards } from '@/components/MetricCards'
import { useTrainerBluetooth } from '@/hooks/useTrainerBluetooth'
import { ConnectionPanels } from '@/components/ConnectionPanels'
import { StatusBar } from '@/components/StatusBar'
import { WorkoutSelector } from '@/components/WorkoutSelector'
import { WorkoutProgress } from '@/components/WorkoutProgress'
import { useWorkoutExecution } from '@/hooks/useWorkoutExecution'
import type { WorkoutDefinition } from '@/workouts/catalog'

const currentUserQuery = convexQuery(api.auth.getCurrentUser, {})
const userDataQuery = convexQuery(api.userData.getCurrentUserData, {})

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentUserQuery),
      context.queryClient.ensureQueryData(userDataQuery),
    ])
  },
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const setCurrentUserFtp = useConvexMutation(api.userData.setCurrentUserFtp)
  const [isSavingFtp, setIsSavingFtp] = useState(false)
  const [pendingWorkoutStart, setPendingWorkoutStart] = useState<WorkoutDefinition | null>(null)
  const { data: currentUser } = useSuspenseQuery(currentUserQuery)
  const { data: userData } = useSuspenseQuery(userDataQuery)
  const model = useTrainerBluetooth({ initialErgTargetWatts: userData.ftp })

  const {
    webBluetoothSupported,
    statusMessage,
    connectionState,
    heartRateConnectionState,
    ergControlAvailable,
    trainerName,
    heartRateMonitorName,
    livePowerWatts,
    cadenceRpm,
    heartRateBpm,
    setErgTargetWatts,
    setErgTargetValue,
    connectTrainer,
    disconnectTrainer,
    connectHeartRateMonitor,
    disconnectHeartRateMonitor,
  } = model

  const workoutExecution = useWorkoutExecution({
    ftp: userData.ftp,
    livePowerWatts,
    heartRateBpm,
    setErgTargetValue,
  })
  const {
    activeWorkout,
    elapsedSeconds,
    remainingSeconds,
    progressRatio,
    activeSegment,
    activeSegmentIndex,
    nextSegment,
    currentTargetWatts,
    isPaused,
    isCompleted: workoutCompleted,
    pause,
    resume,
    skipSegment,
    start: startWorkout,
    stop: stopWorkout,
  } = workoutExecution
  const waitingForFirstPower = pendingWorkoutStart !== null && !activeWorkout
  const displayedWorkout = activeWorkout ?? pendingWorkoutStart

  useEffect(() => {
    if (!workoutCompleted) {
      return
    }
    setPendingWorkoutStart(null)
    stopWorkout()
  }, [stopWorkout, workoutCompleted])

  useEffect(() => {
    if (!pendingWorkoutStart) {
      return
    }
    if (activeWorkout) {
      return
    }
    if (typeof livePowerWatts !== 'number' || livePowerWatts <= 0) {
      return
    }

    startWorkout(pendingWorkoutStart)
    setPendingWorkoutStart(null)
  }, [activeWorkout, livePowerWatts, pendingWorkoutStart, startWorkout])

  const handleSaveFtp = async (ftp: number) => {
    setIsSavingFtp(true)
    try {
      await setCurrentUserFtp({ ftp })
      setErgTargetWatts(ftp)
      await queryClient.invalidateQueries({
        queryKey: userDataQuery.queryKey,
      })
    } finally {
      setIsSavingFtp(false)
    }
  }

  const handleStartWorkout = (workout: WorkoutDefinition) => {
    if (!ergControlAvailable) {
      return
    }
    setPendingWorkoutStart(workout)
  }

  const handleEndWorkout = () => {
    setPendingWorkoutStart(null)
    stopWorkout()
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <Header
          ftp={userData.ftp}
          userEmail={currentUser?.email ?? null}
          onSaveFtp={handleSaveFtp}
          isSavingFtp={isSavingFtp}
        />

        <MetricCards
          livePowerWatts={livePowerWatts}
          cadenceRpm={cadenceRpm}
          trainerName={trainerName}
          connectionState={connectionState}
          heartRateBpm={heartRateBpm}
          heartRateMonitorName={heartRateMonitorName}
          heartRateConnectionState={heartRateConnectionState}
        />

        <ConnectionPanels
          webBluetoothSupported={webBluetoothSupported}
          connectionState={connectionState}
          heartRateConnectionState={heartRateConnectionState}
          connectTrainer={connectTrainer}
          disconnectTrainer={disconnectTrainer}
          connectHeartRateMonitor={connectHeartRateMonitor}
          disconnectHeartRateMonitor={disconnectHeartRateMonitor}
        />

        {displayedWorkout ? (
          <WorkoutProgress
            ftp={userData.ftp}
            workout={displayedWorkout}
            elapsedSeconds={elapsedSeconds}
            remainingSeconds={remainingSeconds}
            progressRatio={progressRatio}
            activeSegment={activeSegment}
            activeSegmentIndex={activeSegmentIndex}
            nextSegment={nextSegment}
            currentTargetWatts={currentTargetWatts}
            isWaitingForStart={waitingForFirstPower}
            isPaused={isPaused}
            isCompleted={workoutCompleted}
            onPause={pause}
            onResume={resume}
            onSkipSegment={skipSegment}
            onEndWorkout={handleEndWorkout}
          />
        ) : (
          <WorkoutSelector
            ftp={userData.ftp}
            ergControlAvailable={ergControlAvailable}
            onStartWorkout={handleStartWorkout}
          />
        )}

        <StatusBar
          connectionState={connectionState}
          statusMessage={statusMessage}
        />
      </div>
    </main>
  )
}
