import type { WorkoutDefinition, WorkoutSegment } from '@/workouts/catalog'
import { X } from 'lucide-react'
import { useId, useRef } from 'react'
import { WorkoutTimeline } from '@/components/WorkoutTimeline'
import './WorkoutProgress.scss'

type WorkoutProgressProps = {
  ftp: number
  workout: WorkoutDefinition
  elapsedSeconds: number
  remainingSeconds: number
  progressRatio: number
  activeSegment: WorkoutSegment | null
  activeSegmentIndex: number
  nextSegment: WorkoutSegment | null
  currentTargetWatts: number | null
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
  ftp,
  workout,
  elapsedSeconds,
  remainingSeconds,
  progressRatio,
  activeSegment,
  activeSegmentIndex,
  nextSegment,
  currentTargetWatts,
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
  const progressPercent = Math.round(Math.min(1, Math.max(0, progressRatio)) * 100)
  const blockRemainingSeconds = getBlockRemainingSeconds({
    workout,
    activeSegment,
    elapsedSeconds,
    isWaitingForStart,
    isCompleted,
  })

  return (
    <section className="cp-workout-progress cp-panel" aria-live="polite">
      <header className="cp-workout-progress-header">
        <div className="cp-workout-progress-title-wrap">
          <p className="cp-panel-label">Active Workout</p>
          <h2>{workout.title}</h2>
        </div>
        <p
          className={`cp-workout-progress-state ${
            isCompleted
              ? 'cp-workout-progress-state--completed'
              : isWaitingForStart
                ? 'cp-workout-progress-state--waiting'
              : isPaused
                ? 'cp-workout-progress-state--paused'
                : 'cp-workout-progress-state--running'
          }`}
        >
          {isCompleted ? 'Completed' : isWaitingForStart ? 'Armed' : isPaused ? 'Paused' : 'Running'}
        </p>
      </header>

      {isWaitingForStart ? (
        <p className="cp-workout-progress-waiting">
          Workout is armed. Start pedaling and the workout will begin on the first power reading.
        </p>
      ) : null}

      <div className="cp-workout-progress-metrics">
        <Metric label="Elapsed" value={formatDuration(elapsedSeconds)} />
        <Metric
          label="Block Remaining"
          value={blockRemainingSeconds === null ? '--' : formatDuration(blockRemainingSeconds)}
        />
        <Metric label="Remaining" value={formatDuration(remainingSeconds)} />
        <Metric
          label="Target"
          value={currentTargetWatts === null ? '--' : `${currentTargetWatts} W`}
        />
      </div>

      <div className="cp-workout-progress-bar" role="progressbar" aria-valuenow={progressPercent}>
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <WorkoutTimeline
        workout={workout}
        ftp={ftp}
        elapsedSeconds={elapsedSeconds}
        interactive={false}
        showTimescale
      />

      <div className="cp-workout-progress-segments">
        <article className="cp-workout-progress-segment">
          <p className="cp-panel-label">Current Block</p>
          {activeSegment ? (
            <>
              <h3>
                {activeSegmentIndex + 1}. {activeSegment.label}
              </h3>
              <p>{formatSegmentPower(activeSegment, ftp)}</p>
              <p>{formatDuration(activeSegment.durationSeconds)}</p>
            </>
          ) : (
            <p className="cp-workout-progress-empty">No active segment.</p>
          )}
        </article>

        <article className="cp-workout-progress-segment">
          <p className="cp-panel-label">Next Block</p>
          {nextSegment ? (
            <>
              <h3>{nextSegment.label}</h3>
              <p>{formatSegmentPower(nextSegment, ftp)}</p>
              <p>{formatDuration(nextSegment.durationSeconds)}</p>
            </>
          ) : (
            <p className="cp-workout-progress-empty">No more segments.</p>
          )}
        </article>
      </div>

      <div className="cp-workout-progress-actions">
        {isCompleted ? (
          <>
            <button
              type="button"
              className="cp-workout-progress-action"
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
              className="cp-workout-progress-action cp-workout-progress-action--secondary"
              onClick={onDone}
              disabled={isDiscardingWorkout}
            >
              Done
            </button>
            <button
              type="button"
              className="cp-workout-progress-action cp-workout-progress-action--danger"
              popoverTarget={discardWorkoutPopoverId}
              popoverTargetAction="toggle"
              disabled={isDiscardingWorkout || isPreparingFitDownload || isFinalizingWorkout}
            >
              {isDiscardingWorkout ? 'Discarding' : 'Discard Workout'}
            </button>
          </>
        ) : isWaitingForStart ? null : isPaused ? (
          <button type="button" className="cp-workout-progress-action" onClick={onResume}>
            Resume
          </button>
        ) : (
          <button type="button" className="cp-workout-progress-action" onClick={onPause}>
            Pause
          </button>
        )}
        <button
          type="button"
          className="cp-workout-progress-action cp-workout-progress-action--secondary"
          onClick={onSkipSegment}
          disabled={isCompleted || isWaitingForStart || nextSegment === null}
        >
          Skip Segment
        </button>
        <button
          type="button"
          className="cp-workout-progress-action cp-workout-progress-action--danger"
          onClick={isWaitingForStart ? onEndWorkout : undefined}
          popoverTarget={isWaitingForStart ? undefined : endWorkoutPopoverId}
          popoverTargetAction={isWaitingForStart ? undefined : 'toggle'}
          disabled={isCompleted}
        >
          {isWaitingForStart ? 'Cancel Workout' : 'End Workout'}
        </button>
      </div>
      <div
        id={endWorkoutPopoverId}
        ref={endWorkoutPopoverRef}
        popover="auto"
        className="cp-workout-progress-confirm-popover"
        role="dialog"
        aria-labelledby={`${endWorkoutPopoverId}-title`}
      >
        <div className="cp-workout-progress-confirm-header">
          <h3 id={`${endWorkoutPopoverId}-title`}>End workout?</h3>
          <button
            type="button"
            className="cp-workout-progress-confirm-close"
            popoverTarget={endWorkoutPopoverId}
            popoverTargetAction="hide"
            aria-label="Close end workout confirmation"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p>This will end the workout now. You can still download or discard it afterward.</p>
        <div className="cp-workout-progress-confirm-actions">
          <button
            type="button"
            className="cp-workout-progress-action cp-workout-progress-action--secondary"
            popoverTarget={endWorkoutPopoverId}
            popoverTargetAction="hide"
          >
            Keep Riding
          </button>
          <button
            type="button"
            className="cp-workout-progress-action cp-workout-progress-action--danger"
            onClick={() => {
              onEndWorkout()
              endWorkoutPopoverRef.current?.hidePopover()
            }}
          >
            End Workout
          </button>
        </div>
      </div>
      <div
        id={discardWorkoutPopoverId}
        ref={discardWorkoutPopoverRef}
        popover="auto"
        className="cp-workout-progress-confirm-popover"
        role="dialog"
        aria-labelledby={`${discardWorkoutPopoverId}-title`}
      >
        <div className="cp-workout-progress-confirm-header">
          <h3 id={`${discardWorkoutPopoverId}-title`}>Discard workout?</h3>
          <button
            type="button"
            className="cp-workout-progress-confirm-close"
            popoverTarget={discardWorkoutPopoverId}
            popoverTargetAction="hide"
            aria-label="Close discard confirmation"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p>This permanently removes this workout and its recorded data.</p>
        <div className="cp-workout-progress-confirm-actions">
          <button
            type="button"
            className="cp-workout-progress-action cp-workout-progress-action--secondary"
            popoverTarget={discardWorkoutPopoverId}
            popoverTargetAction="hide"
            disabled={isDiscardingWorkout}
          >
            Keep Workout
          </button>
          <button
            type="button"
            className="cp-workout-progress-action cp-workout-progress-action--danger"
            onClick={async () => {
              await onDiscardWorkout()
              discardWorkoutPopoverRef.current?.hidePopover()
            }}
            disabled={isDiscardingWorkout}
          >
            {isDiscardingWorkout ? 'Discarding' : 'Discard'}
          </button>
        </div>
      </div>
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

function formatSegmentPower(segment: WorkoutSegment, ftp: number): string {
  const ftpLowPercent = Math.round(segment.ftpLow * 100)
  const ftpHighPercent = Math.round(segment.ftpHigh * 100)
  const wattsLow = Math.round(segment.ftpLow * ftp)
  const wattsHigh = Math.round(segment.ftpHigh * ftp)

  if (ftpLowPercent === ftpHighPercent) {
    return `${ftpLowPercent}% FTP (${wattsLow} W)`
  }

  return `${ftpLowPercent}-${ftpHighPercent}% FTP (${wattsLow}-${wattsHigh} W)`
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

function getBlockRemainingSeconds({
  workout,
  activeSegment,
  elapsedSeconds,
  isWaitingForStart,
  isCompleted,
}: {
  workout: WorkoutDefinition
  activeSegment: WorkoutSegment | null
  elapsedSeconds: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): number | null {
  if (isCompleted) {
    return 0
  }

  if (isWaitingForStart) {
    return workout.segments[0]?.durationSeconds ?? null
  }

  if (!activeSegment) {
    return null
  }

  const secondsIntoSegment = Math.max(0, elapsedSeconds - activeSegment.startSecond)
  return Math.max(0, activeSegment.durationSeconds - secondsIntoSegment)
}
