import type { CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Play } from 'lucide-react'
import type { WorkoutDefinition, WorkoutSegment } from '@/workouts/catalog'
import './WorkoutBlockSidebar.scss'

type WorkoutBlockSidebarProps = {
  workout: WorkoutDefinition
  ftp: number
  workoutIntensityPercent: number
  activeSegmentIndex: number
  isWaitingForStart: boolean
  isCompleted: boolean
  onDecreaseIntensity: () => void
  onIncreaseIntensity: () => void
}

type WorkoutZone = 1 | 2 | 3 | 4 | 5 | 6
type WorkoutBlockState = 'completed' | 'active' | 'upcoming'

const ZONE_COLORS: Record<WorkoutZone, string> = {
  1: '#e0d4f5',
  2: '#00f0ff',
  3: '#ffe600',
  4: '#ff2d95',
  5: '#ff3b30',
  6: '#b000ff',
}

export function WorkoutBlockSidebar({
  workout,
  ftp,
  workoutIntensityPercent,
  activeSegmentIndex,
  isWaitingForStart,
  isCompleted,
  onDecreaseIntensity,
  onIncreaseIntensity,
}: WorkoutBlockSidebarProps) {
  const workoutBlocks = workout.segments.map((segment, index) => {
    const state = getWorkoutBlockState({
      index,
      activeSegmentIndex,
      isWaitingForStart,
      isCompleted,
    })
    const zoneColor = getZoneColor(getMidFtp(segment))
    const blockStyle = {
      '--cp-workout-block-color-solid': zoneColor,
    } as CSSProperties

    return {
      segment,
      state,
      blockStyle,
    }
  })

  const intensityControlsDisabled =
    isWaitingForStart || isCompleted || activeSegmentIndex < 0

  return (
    <aside className="cp-workout-block-sidebar" aria-label="Workout blocks">
      <div className="cp-workout-block-sidebar-list">
        {workoutBlocks.map(({ segment, state, blockStyle }) => (
          <div
            key={segment.id}
            className="cp-workout-block-row"
            style={blockStyle}
          >
            <div
              className={`cp-workout-block cp-workout-block--${state}`}
            >
              <span className="cp-workout-block-power">
                {formatBlockPower(
                  segment,
                  ftp,
                  state === 'completed' ? 100 : workoutIntensityPercent,
                )}
              </span>
              <span className="cp-workout-block-duration">
                {formatBlockDuration(segment.durationSeconds)}
              </span>
            </div>
            <span
              className={`cp-workout-block-active-indicator${
                state === 'active' ? ' cp-workout-block-active-indicator--active' : ''
              }`}
              aria-hidden="true"
            >
              {state === 'active' ? (
                <Play size={18} stroke="none" fill="currentColor" />
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <div className="cp-workout-block-intensity" aria-label="Workout intensity controls">
        <button
          type="button"
          className="cp-btn cp-workout-block-intensity-button"
          onClick={onDecreaseIntensity}
          disabled={intensityControlsDisabled}
          aria-label="Decrease workout intensity by one percent"
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        <p className="cp-workout-block-intensity-value">
          {workoutIntensityPercent}
          <span>%</span>
        </p>
        <button
          type="button"
          className="cp-btn cp-workout-block-intensity-button"
          onClick={onIncreaseIntensity}
          disabled={intensityControlsDisabled}
          aria-label="Increase workout intensity by one percent"
        >
          <ChevronUp size={16} strokeWidth={2} />
        </button>
      </div>
    </aside>
  )
}

function formatBlockDuration(totalSeconds: number): string {
  const safeTotal = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeTotal / 60)
  const seconds = safeTotal % 60

  if (safeTotal === 0) {
    return '0 sec'
  }

  if (seconds === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${seconds} sec`
  }

  return `${minutes} min ${seconds} sec`
}

function formatBlockPower(
  segment: WorkoutSegment,
  ftp: number,
  workoutIntensityPercent: number,
): string {
  const wattsLow = applyIntensityToWatts(
    Math.round(segment.ftpLow * ftp),
    workoutIntensityPercent,
  )
  const wattsHigh = applyIntensityToWatts(
    Math.round(segment.ftpHigh * ftp),
    workoutIntensityPercent,
  )

  if (wattsLow === wattsHigh) {
    return `${wattsLow} w`
  }

  return `${wattsLow}-${wattsHigh} w`
}

function applyIntensityToWatts(watts: number, workoutIntensityPercent: number): number {
  const normalizedPercent = Number.isFinite(workoutIntensityPercent)
    ? workoutIntensityPercent
    : 100
  const scaledWatts = Math.round(watts * (normalizedPercent / 100))
  return clamp(scaledWatts, 0, 2000)
}

function getWorkoutBlockState({
  index,
  activeSegmentIndex,
  isWaitingForStart,
  isCompleted,
}: {
  index: number
  activeSegmentIndex: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): WorkoutBlockState {
  if (isCompleted) {
    return 'completed'
  }

  if (isWaitingForStart || activeSegmentIndex < 0) {
    return 'upcoming'
  }

  if (index < activeSegmentIndex) {
    return 'completed'
  }

  if (index === activeSegmentIndex) {
    return 'active'
  }

  return 'upcoming'
}

function getMidFtp(segment: WorkoutSegment): number {
  return (segment.ftpLow + segment.ftpHigh) / 2
}

function getZoneFromFtp(ftpRatio: number): WorkoutZone {
  if (ftpRatio < 0.56) return 1
  if (ftpRatio < 0.76) return 2
  if (ftpRatio < 0.91) return 3
  if (ftpRatio < 1.06) return 4
  if (ftpRatio < 1.21) return 5
  return 6
}

function getZoneColor(ftpRatio: number): string {
  return ZONE_COLORS[getZoneFromFtp(ftpRatio)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

