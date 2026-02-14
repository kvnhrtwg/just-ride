import type { CSSProperties } from 'react'
import type { WorkoutSegment } from '@/workouts/catalog'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { useId, useRef } from 'react'
import { Popover } from '@/components/Popover'
import './WorkoutProgress.scss'

type WorkoutProgressProps = {
  elapsedSeconds: number
  remainingSeconds: number
  progressRatio: number
  nextSegment: WorkoutSegment | null
  isWaitingForStart: boolean
  isPaused: boolean
  isCompleted: boolean
  onPause: () => void
  onResume: () => void
  onSkipSegment: () => void
  onEndWorkout: () => void
  onDiscardWorkout: () => Promise<void>
  onDownloadFit: () => void
  onDone: () => void
  canDownloadFit: boolean
  isPreparingFitDownload: boolean
  isFinalizingWorkout: boolean
  isDiscardingWorkout: boolean
  fitDownloadErrorMessage: string | null
}

export function WorkoutProgress({
  elapsedSeconds,
  remainingSeconds,
  progressRatio,
  nextSegment,
  isWaitingForStart,
  isPaused,
  isCompleted,
  onPause,
  onResume,
  onSkipSegment,
  onEndWorkout,
  onDiscardWorkout,
  onDownloadFit,
  onDone,
  canDownloadFit,
  isPreparingFitDownload,
  isFinalizingWorkout,
  isDiscardingWorkout,
  fitDownloadErrorMessage,
}: WorkoutProgressProps) {
  const endWorkoutPopoverId = useId()
  const discardWorkoutPopoverId = useId()
  const discardWorkoutPopoverRef = useRef<HTMLDivElement | null>(null)
  const endWorkoutPopoverRef = useRef<HTMLDivElement | null>(null)
  const progressValue = getProgressValue({
    progressRatio,
    isWaitingForStart,
    isCompleted,
  })
  const progressPercent = Math.round(progressValue * 100)
  const progressBarStyle = {
    '--cp-workout-progress-value': `${(progressValue * 100).toFixed(3)}%`,
  } as CSSProperties
  const totalSeconds = elapsedSeconds + remainingSeconds

  return (
    <section className="cp-workout-progress" aria-live="polite">
      {isWaitingForStart ? (
        <p className="cp-workout-progress-waiting">
          Workout is armed. Start pedaling and the workout will begin on the first power reading.
        </p>
      ) : null}

      <div className="cp-workout-progress-metrics">
        <Metric label="Elapsed" value={formatDuration(elapsedSeconds)} />
        <Metric label="Remaining" value={formatDuration(remainingSeconds)} />
        <Metric label="Total" value={formatDuration(totalSeconds)} />
      </div>

      <div
        className="cp-workout-progress-bar"
        role="progressbar"
        aria-valuenow={progressPercent}
        style={progressBarStyle}
      >
        <span />
      </div>
      <div className="cp-workout-progress-actions">
        {isCompleted ? (
          <>
            <button
              type="button"
              className="cp-btn cp-workout-progress-action"
              onClick={onDownloadFit}
              disabled={!canDownloadFit || isPreparingFitDownload || isFinalizingWorkout}
            >
              {isFinalizingWorkout
                ? 'Finalizing'
                : isPreparingFitDownload
                  ? 'Preparing FIT'
                  : 'Download FIT'}
            </button>
            <button
              type="button"
              className="cp-btn cp-workout-progress-action"
              onClick={onDone}
              disabled={isDiscardingWorkout}
            >
              Done
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-danger cp-workout-progress-action"
              popoverTarget={discardWorkoutPopoverId}
              popoverTargetAction="toggle"
              disabled={isDiscardingWorkout || isPreparingFitDownload || isFinalizingWorkout}
            >
              {isDiscardingWorkout ? 'Discarding' : 'Discard Workout'}
            </button>
          </>
        ) : isWaitingForStart ? null : isPaused ? (
          <button
            type="button"
            className="cp-btn cp-workout-progress-action cp-workout-progress-action--neutral"
            onClick={onResume}
          >
            <Play size={14} aria-hidden="true" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            type="button"
            className="cp-btn cp-workout-progress-action cp-workout-progress-action--neutral"
            onClick={onPause}
          >
            <Pause size={14} aria-hidden="true" />
            <span>Pause</span>
          </button>
        )}
        {!isCompleted ? (
          <>
            <button
              type="button"
              className="cp-btn cp-workout-progress-action cp-workout-progress-action--neutral"
              onClick={onSkipSegment}
              disabled={isWaitingForStart || nextSegment === null}
            >
              <SkipForward size={14} aria-hidden="true" />
              <span>Skip Segment</span>
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-danger cp-workout-progress-action"
              onClick={isWaitingForStart ? onEndWorkout : undefined}
              popoverTarget={isWaitingForStart ? undefined : endWorkoutPopoverId}
              popoverTargetAction={isWaitingForStart ? undefined : 'toggle'}
            >
              <X size={14} aria-hidden="true" />
              <span>{isWaitingForStart ? 'Cancel Workout' : 'End Workout'}</span>
            </button>
          </>
        ) : null}
      </div>
      <Popover
        id={endWorkoutPopoverId}
        ref={endWorkoutPopoverRef}
        title="End workout?"
        closeLabel="Close end workout confirmation"
        className="cp-workout-progress-confirm-popover"
        titleTag="h3"
      >
        <p>This will end the workout now. You can still download or discard it afterward.</p>
        <div className="cp-workout-progress-confirm-actions">
          <button
            type="button"
            className="cp-btn cp-workout-progress-action"
            popoverTarget={endWorkoutPopoverId}
            popoverTargetAction="hide"
          >
            Keep Riding
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-danger cp-workout-progress-action"
            onClick={() => {
              onEndWorkout()
              endWorkoutPopoverRef.current?.hidePopover()
            }}
          >
            End Workout
          </button>
        </div>
      </Popover>
      <Popover
        id={discardWorkoutPopoverId}
        ref={discardWorkoutPopoverRef}
        title="Discard workout?"
        closeLabel="Close discard confirmation"
        className="cp-workout-progress-confirm-popover"
        titleTag="h3"
      >
        <p>This permanently removes this workout and its recorded data.</p>
        <div className="cp-workout-progress-confirm-actions">
          <button
            type="button"
            className="cp-btn cp-workout-progress-action"
            popoverTarget={discardWorkoutPopoverId}
            popoverTargetAction="hide"
            disabled={isDiscardingWorkout}
          >
            Keep Workout
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-danger cp-workout-progress-action"
            onClick={async () => {
              await onDiscardWorkout()
              discardWorkoutPopoverRef.current?.hidePopover()
            }}
            disabled={isDiscardingWorkout}
          >
            {isDiscardingWorkout ? 'Discarding' : 'Discard'}
          </button>
        </div>
      </Popover>
      {fitDownloadErrorMessage ? (
        <p className="cp-workout-progress-download-error">{fitDownloadErrorMessage}</p>
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-workout-progress-metric">
      <p className="cp-panel-label">{label}</p>
      <p>{value}</p>
    </div>
  )
}

function formatDuration(totalSeconds: number): string {
  const safeTotal = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeTotal / 60)
  const seconds = safeTotal % 60

  if (minutes < 60) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0'
  )}`
}

function getProgressValue({
  progressRatio,
  isWaitingForStart,
  isCompleted,
}: {
  progressRatio: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): number {
  if (isCompleted) {
    return 1
  }

  if (isWaitingForStart) {
    return 0
  }

  return clamp(progressRatio, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
