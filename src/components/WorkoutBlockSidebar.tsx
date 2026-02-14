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
type IntervalLoopIndicatorTarget = 'none' | 'on' | 'off'
type SingleWorkoutBlockRow = {
  type: 'single'
  key: string
  segment: WorkoutSegment
  state: WorkoutBlockState
  blockStyle: CSSProperties
}
type IntervalLoopWorkoutBlockRow = {
  type: 'interval-loop'
  key: string
  repeatCount: number
  repeatLabel: string
  onSegment: WorkoutSegment
  offSegment: WorkoutSegment
  onState: WorkoutBlockState
  offState: WorkoutBlockState
  indicatorState: WorkoutBlockState
  indicatorTarget: IntervalLoopIndicatorTarget
  onBlockStyle: CSSProperties
  offBlockStyle: CSSProperties
}
type WorkoutBlockRow = SingleWorkoutBlockRow | IntervalLoopWorkoutBlockRow

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
  const workoutBlockRows = buildWorkoutBlockRows({
    segments: workout.segments,
    activeSegmentIndex,
    isWaitingForStart,
    isCompleted,
  })

  const intensityControlsDisabled =
    isWaitingForStart || isCompleted || activeSegmentIndex < 0

  return (
    <aside className="cp-workout-block-sidebar" aria-label="Workout blocks">
      <div className="cp-workout-block-sidebar-list">
        {workoutBlockRows.map((row) => {
          if (row.type === 'interval-loop') {
            return (
              <div key={row.key} className="cp-workout-block-row cp-workout-block-row--loop">
                <div className="cp-workout-block-loop">
                  <div
                    className={`cp-workout-block cp-workout-block--compact cp-workout-block--loop cp-workout-block--${row.onState}`}
                    style={row.onBlockStyle}
                  >
                    <span className="cp-workout-block-loop-repeat">{row.repeatLabel}</span>
                    <span className="cp-workout-block-power">
                      {formatBlockPower(
                        row.onSegment,
                        ftp,
                        getDisplayIntensityPercent(row.onState, workoutIntensityPercent),
                      )}
                    </span>
                    <span className="cp-workout-block-duration">
                      {formatBlockDuration(row.onSegment.durationSeconds)}
                    </span>
                  </div>
                  <div
                    className={`cp-workout-block cp-workout-block--compact cp-workout-block--loop cp-workout-block--${row.offState}`}
                    style={row.offBlockStyle}
                  >
                    <span
                      className="cp-workout-block-loop-repeat cp-workout-block-loop-repeat--placeholder"
                      aria-hidden="true"
                    />
                    <span className="cp-workout-block-power">
                      {formatBlockPower(
                        row.offSegment,
                        ftp,
                        getDisplayIntensityPercent(row.offState, workoutIntensityPercent),
                      )}
                    </span>
                    <span className="cp-workout-block-duration">
                      {formatBlockDuration(row.offSegment.durationSeconds)}
                    </span>
                  </div>
                </div>
                <span
                  className={`cp-workout-block-active-indicator${
                    row.indicatorState === 'active'
                      ? ' cp-workout-block-active-indicator--active'
                      : ''
                  }${
                    row.indicatorTarget === 'on'
                      ? ' cp-workout-block-active-indicator--loop-on'
                      : row.indicatorTarget === 'off'
                        ? ' cp-workout-block-active-indicator--loop-off'
                        : ''
                  }`}
                  aria-hidden="true"
                >
                  {row.indicatorState === 'active' ? (
                    <Play size={18} stroke="none" fill="currentColor" />
                  ) : null}
                </span>
              </div>
            )
          }

          return (
            <div
              key={row.key}
              className="cp-workout-block-row"
              style={row.blockStyle}
            >
              <div className={`cp-workout-block cp-workout-block--${row.state}`}>
                <span className="cp-workout-block-power">
                  {formatBlockPower(
                    row.segment,
                    ftp,
                    getDisplayIntensityPercent(row.state, workoutIntensityPercent),
                  )}
                </span>
                <span className="cp-workout-block-duration">
                  {formatBlockDuration(row.segment.durationSeconds)}
                </span>
              </div>
              <span
                className={`cp-workout-block-active-indicator${
                  row.state === 'active' ? ' cp-workout-block-active-indicator--active' : ''
                }`}
                aria-hidden="true"
              >
                {row.state === 'active' ? (
                  <Play size={18} stroke="none" fill="currentColor" />
                ) : null}
              </span>
            </div>
          )
        })}
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

function buildWorkoutBlockRows({
  segments,
  activeSegmentIndex,
  isWaitingForStart,
  isCompleted,
}: {
  segments: WorkoutSegment[]
  activeSegmentIndex: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): WorkoutBlockRow[] {
  const rows: WorkoutBlockRow[] = []
  let index = 0

  while (index < segments.length) {
    const segment = segments[index]
    const nextSegment = segments[index + 1]

    if (segment.kind === 'interval-on' && nextSegment?.kind === 'interval-off') {
      const repeatCount = getIntervalLoopRepeatCount(segments, index)

      if (repeatCount > 0) {
        const states = getIntervalLoopStates({
          segments,
          loopStartIndex: index,
          repeatCount,
          activeSegmentIndex,
          isWaitingForStart,
          isCompleted,
        })

        rows.push({
          type: 'interval-loop',
          key: `${segment.id}-loop-${repeatCount}`,
          repeatCount,
          repeatLabel: getIntervalLoopRepeatLabel({
            loopStartIndex: index,
            repeatCount,
            activeSegmentIndex,
            isWaitingForStart,
            isCompleted,
          }),
          onSegment: segment,
          offSegment: nextSegment,
          onState: states.onState,
          offState: states.offState,
          indicatorState: states.indicatorState,
          indicatorTarget: states.indicatorTarget,
          onBlockStyle: {
            '--cp-workout-block-color-solid': getZoneColor(getMidFtp(segment)),
          } as CSSProperties,
          offBlockStyle: {
            '--cp-workout-block-color-solid': getZoneColor(getMidFtp(nextSegment)),
          } as CSSProperties,
        })
        index += repeatCount * 2
        continue
      }
    }

    const state = getWorkoutBlockState({
      index,
      activeSegmentIndex,
      isWaitingForStart,
      isCompleted,
    })

    rows.push({
      type: 'single',
      key: segment.id,
      segment,
      state,
      blockStyle: {
        '--cp-workout-block-color-solid': getZoneColor(getMidFtp(segment)),
      } as CSSProperties,
    })
    index += 1
  }

  return rows
}

function getIntervalLoopRepeatCount(segments: WorkoutSegment[], startIndex: number): number {
  const firstOn = segments[startIndex]
  const firstOff = segments[startIndex + 1]
  if (!firstOn || !firstOff) {
    return 0
  }

  let repeatCount = 0
  let cursor = startIndex

  while (cursor + 1 < segments.length) {
    const onSegment = segments[cursor]
    const offSegment = segments[cursor + 1]

    if (
      !isMatchingIntervalLoopSegment(onSegment, firstOn, 'interval-on') ||
      !isMatchingIntervalLoopSegment(offSegment, firstOff, 'interval-off')
    ) {
      break
    }

    repeatCount += 1
    cursor += 2
  }

  return repeatCount
}

function isMatchingIntervalLoopSegment(
  segment: WorkoutSegment | undefined,
  referenceSegment: WorkoutSegment,
  kind: WorkoutSegment['kind'],
): boolean {
  if (!segment || segment.kind !== kind) {
    return false
  }

  return (
    segment.durationSeconds === referenceSegment.durationSeconds &&
    areNearlyEqual(segment.ftpLow, referenceSegment.ftpLow) &&
    areNearlyEqual(segment.ftpHigh, referenceSegment.ftpHigh)
  )
}

function getIntervalLoopStates({
  segments,
  loopStartIndex,
  repeatCount,
  activeSegmentIndex,
  isWaitingForStart,
  isCompleted,
}: {
  segments: WorkoutSegment[]
  loopStartIndex: number
  repeatCount: number
  activeSegmentIndex: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): {
  onState: WorkoutBlockState
  offState: WorkoutBlockState
  indicatorState: WorkoutBlockState
  indicatorTarget: IntervalLoopIndicatorTarget
} {
  if (isCompleted) {
    return {
      onState: 'completed',
      offState: 'completed',
      indicatorState: 'completed',
      indicatorTarget: 'none',
    }
  }

  if (isWaitingForStart || activeSegmentIndex < 0) {
    return {
      onState: 'upcoming',
      offState: 'upcoming',
      indicatorState: 'upcoming',
      indicatorTarget: 'none',
    }
  }

  const loopEndIndex = loopStartIndex + repeatCount * 2 - 1
  if (activeSegmentIndex < loopStartIndex) {
    return {
      onState: 'upcoming',
      offState: 'upcoming',
      indicatorState: 'upcoming',
      indicatorTarget: 'none',
    }
  }

  if (activeSegmentIndex > loopEndIndex) {
    return {
      onState: 'completed',
      offState: 'completed',
      indicatorState: 'completed',
      indicatorTarget: 'none',
    }
  }

  const activeSegment = segments[activeSegmentIndex]
  if (activeSegment?.kind === 'interval-off') {
    return {
      onState: 'completed',
      offState: 'active',
      indicatorState: 'active',
      indicatorTarget: 'off',
    }
  }

  return {
    onState: 'active',
    offState: 'upcoming',
    indicatorState: 'active',
    indicatorTarget: 'on',
  }
}

function getIntervalLoopRepeatLabel({
  loopStartIndex,
  repeatCount,
  activeSegmentIndex,
  isWaitingForStart,
  isCompleted,
}: {
  loopStartIndex: number
  repeatCount: number
  activeSegmentIndex: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): string {
  if (isCompleted) {
    return `${repeatCount}/${repeatCount}`
  }

  if (isWaitingForStart || activeSegmentIndex < loopStartIndex) {
    return `${repeatCount}x`
  }

  const loopEndIndex = loopStartIndex + repeatCount * 2 - 1
  const effectiveIndex = clamp(activeSegmentIndex, loopStartIndex, loopEndIndex)
  const currentRepeat = Math.floor((effectiveIndex - loopStartIndex) / 2) + 1
  return `${currentRepeat}/${repeatCount}`
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

function getDisplayIntensityPercent(
  state: WorkoutBlockState,
  workoutIntensityPercent: number,
): number {
  return state === 'completed' ? 100 : workoutIntensityPercent
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

function areNearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001
}

