import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useAction, useMutation as useConvexMutation } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { WorkoutExecutionSample } from '@/hooks/useWorkoutExecution'
import type { WorkoutDefinition } from '@/workouts/catalog'
import { Header } from '@/components/Header'
import { MetricCards } from '@/components/MetricCards'
import { useWorkoutDataSource } from '@/hooks/useWorkoutDataSource'
import { useTrainerBluetooth } from '@/hooks/useTrainerBluetooth'
import { WorkoutSelector } from '@/components/WorkoutSelector'
import { WorkoutProgress } from '@/components/WorkoutProgress'
import { useWorkoutExecution } from '@/hooks/useWorkoutExecution'

const currentUserQuery = convexQuery(api.auth.getCurrentUser, {})
const userDataQuery = convexQuery(api.userData.getCurrentUserData, {})
const workoutSampleChunkSize = 60
const FAKE_WORKOUT_ALLOWED_EMAIL = 'kvnhrtwg@gmail.com'

type RecorderSample = {
  timestampMs: number
  elapsedSeconds: number
  segmentId: string | null
  segmentIndex: number
  targetWatts: number | null
  powerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

type RecorderState = {
  sessionId: Id<'workoutSessions'> | null
  nextChunkIndex: number
  sampleBuffer: RecorderSample[]
  flushChain: Promise<void>
}

type CurrentUserResult = {
  email?: string | null
} | null

type UserDataResult = {
  ftp: number
}

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
  const startWorkoutSession = useConvexMutation(api.workouts.startWorkoutSession)
  const appendWorkoutSampleChunk = useConvexMutation(api.workouts.appendWorkoutSampleChunk)
  const finalizeWorkoutSession = useConvexMutation(api.workouts.finalizeWorkoutSession)
  const discardWorkoutSession = useConvexMutation(api.workouts.discardWorkoutSession)
  const generateWorkoutFitDownload = useAction(api.workoutExports.generateWorkoutFitDownload)
  const [isSavingFtp, setIsSavingFtp] = useState(false)
  const [pendingWorkoutStart, setPendingWorkoutStart] = useState<WorkoutDefinition | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<Id<'workoutSessions'> | null>(null)
  const [completedSessionId, setCompletedSessionId] = useState<Id<'workoutSessions'> | null>(null)
  const [isFinalizingWorkout, setIsFinalizingWorkout] = useState(false)
  const [isPreparingFitDownload, setIsPreparingFitDownload] = useState(false)
  const [isDiscardingWorkout, setIsDiscardingWorkout] = useState(false)
  const [isWorkoutLifecycleActive, setIsWorkoutLifecycleActive] = useState(false)
  const [fitDownloadErrorMessage, setFitDownloadErrorMessage] = useState<string | null>(null)
  const [recordingErrorMessage, setRecordingErrorMessage] = useState<string | null>(null)
  const { data: currentUser } = useSuspenseQuery(currentUserQuery) as {
    data: CurrentUserResult
  }
  const { data: userData } = useSuspenseQuery(userDataQuery) as {
    data: UserDataResult
  }
  const canUseFakeTelemetry =
    typeof currentUser?.email === 'string' &&
    currentUser.email.trim().toLowerCase() === FAKE_WORKOUT_ALLOWED_EMAIL
  const model = useTrainerBluetooth({ initialErgTargetWatts: userData.ftp })
  const recorderRef = useRef<RecorderState>({
    sessionId: null,
    nextChunkIndex: 0,
    sampleBuffer: [],
    flushChain: Promise.resolve(),
  })
  const manualEndRequestedRef = useRef(false)
  const hasFinalizedCurrentWorkoutRef = useRef(false)
  const isFinalizingWorkoutRef = useRef(false)
  const pendingFinalizeStatusRef = useRef<'completed' | 'ended' | null>(null)

  const {
    webBluetoothSupported,
    statusMessage,
    connectionState,
    heartRateConnectionState,
    ergControlAvailable,
    livePowerWatts: trainerLivePowerWatts,
    cadenceRpm: trainerCadenceRpm,
    heartRateBpm: trainerHeartRateBpm,
    setErgTargetWatts,
    setErgTargetValue: setTrainerErgTargetValue,
    connectTrainer,
    disconnectTrainer,
    connectHeartRateMonitor,
    disconnectHeartRateMonitor,
  } = model
  const {
    isUsingFakeTelemetry,
    livePowerWatts,
    cadenceRpm,
    heartRateBpm,
    setErgTargetValue,
  } = useWorkoutDataSource({
    connectionState,
    livePowerWatts: trainerLivePowerWatts,
    cadenceRpm: trainerCadenceRpm,
    heartRateBpm: trainerHeartRateBpm,
    setTrainerErgTargetValue,
    isWorkoutPendingOrActive: isWorkoutLifecycleActive,
    canUseFakeTelemetry,
  })

  const flushBufferedSamples = useCallback(
    async (forceFlush: boolean) => {
      const recorder = recorderRef.current
      const sessionId = recorder.sessionId
      if (!sessionId) {
        return
      }

      while (
        recorder.sampleBuffer.length >= workoutSampleChunkSize ||
        (forceFlush && recorder.sampleBuffer.length > 0)
      ) {
        const takeCount = forceFlush
          ? recorder.sampleBuffer.length
          : Math.min(workoutSampleChunkSize, recorder.sampleBuffer.length)
        const chunkSamples = recorder.sampleBuffer.splice(0, takeCount)
        const chunkIndex = recorder.nextChunkIndex
        recorder.nextChunkIndex += 1

        await appendWorkoutSampleChunk({
          sessionId,
          chunkIndex,
          samples: chunkSamples,
        })
      }
    },
    [appendWorkoutSampleChunk]
  )

  const queueChunkFlush = useCallback(
    (forceFlush: boolean) => {
      const recorder = recorderRef.current
      recorder.flushChain = recorder.flushChain
        .catch(() => {})
        .then(() => flushBufferedSamples(forceFlush))
        .catch((error) => {
          setRecordingErrorMessage(`Failed to save workout data: ${getErrorMessage(error)}`)
        })
      return recorder.flushChain
    },
    [flushBufferedSamples]
  )

  const workoutExecution = useWorkoutExecution({
    ftp: userData.ftp,
    livePowerWatts,
    cadenceRpm,
    heartRateBpm,
    setErgTargetValue,
    onSample: useCallback(
      (sample: WorkoutExecutionSample) => {
        const recorder = recorderRef.current
        recorder.sampleBuffer.push({
          timestampMs: sample.timestampMs,
          elapsedSeconds: sample.elapsedSeconds,
          segmentId: sample.segmentId,
          segmentIndex: sample.segmentIndex,
          targetWatts: sample.targetWatts,
          powerWatts: sample.livePowerWatts,
          cadenceRpm: sample.cadenceRpm,
          heartRateBpm: sample.heartRateBpm,
        })
        if (recorder.sampleBuffer.length >= workoutSampleChunkSize) {
          void queueChunkFlush(false)
        }
      },
      [queueChunkFlush]
    ),
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
    end: endWorkout,
    skipSegment,
    start: startWorkout,
    stop: stopWorkout,
  } = workoutExecution
  const waitingForFirstPower =
    pendingWorkoutStart !== null && !activeWorkout && !isUsingFakeTelemetry
  const displayedWorkout = activeWorkout ?? pendingWorkoutStart

  const finalizeCurrentWorkoutSession = useCallback(
    async (status: 'completed' | 'ended') => {
      if (isFinalizingWorkoutRef.current) {
        return
      }

      isFinalizingWorkoutRef.current = true
      setIsFinalizingWorkout(true)
      try {
        await queueChunkFlush(true)
        const sessionId = recorderRef.current.sessionId
        if (!sessionId) {
          pendingFinalizeStatusRef.current = status
          return
        }

        await finalizeWorkoutSession({
          sessionId,
          status,
          endedAt: Date.now(),
        })
        setCompletedSessionId(sessionId)
      } catch (error) {
        setRecordingErrorMessage(`Failed to finalize workout recording: ${getErrorMessage(error)}`)
      } finally {
        setIsFinalizingWorkout(false)
        isFinalizingWorkoutRef.current = false
      }
    },
    [finalizeWorkoutSession, queueChunkFlush]
  )

  useEffect(() => {
    if (!workoutCompleted || !activeWorkout || hasFinalizedCurrentWorkoutRef.current) {
      return
    }
    hasFinalizedCurrentWorkoutRef.current = true
    const status = manualEndRequestedRef.current ? 'ended' : 'completed'
    manualEndRequestedRef.current = false
    void finalizeCurrentWorkoutSession(status)
  }, [activeWorkout, finalizeCurrentWorkoutSession, workoutCompleted])

  useEffect(() => {
    if (!pendingWorkoutStart) {
      return
    }
    if (activeWorkout) {
      return
    }
    if (!isUsingFakeTelemetry && (typeof livePowerWatts !== 'number' || livePowerWatts <= 0)) {
      return
    }

    setFitDownloadErrorMessage(null)
    setRecordingErrorMessage(null)
    setCompletedSessionId(null)
    setActiveSessionId(null)
    hasFinalizedCurrentWorkoutRef.current = false
    manualEndRequestedRef.current = false
    pendingFinalizeStatusRef.current = null
    recorderRef.current = {
      sessionId: null,
      nextChunkIndex: 0,
      sampleBuffer: [],
      flushChain: Promise.resolve(),
    }

    const workout = pendingWorkoutStart
    startWorkout(workout)
    setPendingWorkoutStart(null)

    void (async () => {
      try {
        const sessionId = await startWorkoutSession({
          workoutId: workout.id,
          workoutTitle: workout.title,
          workoutIntensity: workout.intensity,
          workoutSourcePath: workout.sourcePath,
          plannedDurationSeconds: workout.totalDurationSeconds,
          startedAt: Date.now(),
        })
        recorderRef.current.sessionId = sessionId
        setActiveSessionId(sessionId)
        await queueChunkFlush(true)

        const pendingFinalizeStatus = pendingFinalizeStatusRef.current
        if (pendingFinalizeStatus) {
          pendingFinalizeStatusRef.current = null
          await finalizeCurrentWorkoutSession(pendingFinalizeStatus)
        }
      } catch (error) {
        setRecordingErrorMessage(
          `Workout started, but recording could not be initialized: ${getErrorMessage(error)}`
        )
      }
    })()
  }, [
    activeWorkout,
    finalizeCurrentWorkoutSession,
    livePowerWatts,
    isUsingFakeTelemetry,
    pendingWorkoutStart,
    queueChunkFlush,
    startWorkout,
    startWorkoutSession,
  ])

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
    if (!ergControlAvailable && !canUseFakeTelemetry) {
      return
    }
    setIsWorkoutLifecycleActive(true)
    setPendingWorkoutStart(workout)
  }

  const handleEndWorkout = () => {
    if (waitingForFirstPower) {
      setPendingWorkoutStart(null)
      setIsWorkoutLifecycleActive(false)
      return
    }
    if (!activeWorkout || workoutCompleted) {
      return
    }
    manualEndRequestedRef.current = true
    endWorkout()
  }

  const handleDoneWorkout = () => {
    stopWorkout()
    setIsWorkoutLifecycleActive(false)
    setPendingWorkoutStart(null)
    setActiveSessionId(null)
    setCompletedSessionId(null)
    setFitDownloadErrorMessage(null)
    setRecordingErrorMessage(null)
    hasFinalizedCurrentWorkoutRef.current = false
    manualEndRequestedRef.current = false
    pendingFinalizeStatusRef.current = null
    recorderRef.current = {
      sessionId: null,
      nextChunkIndex: 0,
      sampleBuffer: [],
      flushChain: Promise.resolve(),
    }
  }

  const handleDiscardWorkout = async () => {
    if (isDiscardingWorkout) {
      return
    }

    const sessionId = completedSessionId ?? activeSessionId ?? recorderRef.current.sessionId
    if (!sessionId) {
      handleDoneWorkout()
      return
    }

    setIsDiscardingWorkout(true)
    setFitDownloadErrorMessage(null)
    setRecordingErrorMessage(null)
    try {
      await discardWorkoutSession({ sessionId })
      handleDoneWorkout()
    } catch (error) {
      setFitDownloadErrorMessage(`Unable to discard workout: ${getErrorMessage(error)}`)
    } finally {
      setIsDiscardingWorkout(false)
    }
  }

  const handleDownloadFit = async () => {
    const sessionId = completedSessionId ?? activeSessionId ?? recorderRef.current.sessionId
    if (!sessionId) {
      setFitDownloadErrorMessage('No recorded session is available to export.')
      return
    }

    setFitDownloadErrorMessage(null)
    setIsPreparingFitDownload(true)
    try {
      const result = await generateWorkoutFitDownload({ sessionId })
      const fitBytes = decodeBase64ToArrayBuffer(result.contentBase64)
      const blob = new Blob([fitBytes], { type: 'application/octet-stream' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = result.fileName
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setFitDownloadErrorMessage(`Unable to generate FIT download: ${getErrorMessage(error)}`)
    } finally {
      setIsPreparingFitDownload(false)
    }
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <Header
          ftp={userData.ftp}
          userEmail={currentUser?.email ?? null}
          onSaveFtp={handleSaveFtp}
          isSavingFtp={isSavingFtp}
          webBluetoothSupported={webBluetoothSupported}
          statusMessage={statusMessage}
          connectionState={connectionState}
          heartRateConnectionState={heartRateConnectionState}
          connectTrainer={connectTrainer}
          disconnectTrainer={disconnectTrainer}
          connectHeartRateMonitor={connectHeartRateMonitor}
          disconnectHeartRateMonitor={disconnectHeartRateMonitor}
        />

        <MetricCards
          livePowerWatts={livePowerWatts}
          cadenceRpm={cadenceRpm}
          heartRateBpm={heartRateBpm}
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
            onDiscardWorkout={handleDiscardWorkout}
            onDownloadFit={handleDownloadFit}
            onDone={handleDoneWorkout}
            canDownloadFit={Boolean(completedSessionId ?? activeSessionId)}
            isPreparingFitDownload={isPreparingFitDownload}
            isFinalizingWorkout={isFinalizingWorkout}
            isDiscardingWorkout={isDiscardingWorkout}
            fitDownloadErrorMessage={fitDownloadErrorMessage ?? recordingErrorMessage}
          />
        ) : (
          <WorkoutSelector
            ftp={userData.ftp}
            ergControlAvailable={ergControlAvailable}
            canStartWithoutTrainer={canUseFakeTelemetry}
            onStartWorkout={handleStartWorkout}
          />
        )}
      </div>
    </main>
  )
}

function decodeBase64ToArrayBuffer(encoded: string): ArrayBuffer {
  const decoded = window.atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes.buffer
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unknown error'
}
