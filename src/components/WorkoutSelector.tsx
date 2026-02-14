import { useMemo, useState } from 'react'
import {
  getInitialWorkoutIntensity,
  workoutsByIntensity,
  type WorkoutDefinition,
  type WorkoutIntensity,
  type WorkoutSegment,
} from '@/workouts/catalog'
import './WorkoutSelector.scss'

type WorkoutSelectorProps = {
  ftp: number
}

type WorkoutZone = 1 | 2 | 3 | 4 | 5 | 6

const INTENSITY_OPTIONS: WorkoutIntensity[] = ['lit', 'mit', 'hit']
const WORKOUT_PLOT_WIDTH = 100
const WORKOUT_PLOT_HEIGHT = 34
const WORKOUT_PLOT_BASELINE = 32
const WORKOUT_PLOT_TOP_PADDING = 2
const WORKOUT_SEGMENT_GAP = 0.18

const ZONE_COLORS: Record<WorkoutZone, string> = {
  1: '#e0d4f5',
  2: '#00f0ff',
  3: '#ffe600',
  4: '#ff2d95',
  5: '#ff3b30',
  6: '#b000ff',
}

export function WorkoutSelector({ ftp }: WorkoutSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIntensity, setSelectedIntensity] = useState<WorkoutIntensity>(
    getInitialWorkoutIntensity(),
  )

  const workouts = workoutsByIntensity[selectedIntensity]

  const handleToggleSelector = () => {
    setIsOpen((open) => !open)
  }

  const handleSelectIntensity = (nextIntensity: WorkoutIntensity) => {
    setSelectedIntensity(nextIntensity)
  }

  return (
    <section className="cp-workout-selector">
      <button
        type="button"
        className="cp-workout-toggle"
        onClick={handleToggleSelector}
        aria-expanded={isOpen}
        aria-controls="cp-workout-chooser"
      >
        Select Workout
      </button>

      {isOpen ? (
        <div id="cp-workout-chooser" className="cp-workout-panel">
          <div className="cp-workout-levels" role="tablist" aria-label="Workout intensity">
            {INTENSITY_OPTIONS.map((intensity) => (
              <button
                key={intensity}
                type="button"
                role="tab"
                aria-selected={selectedIntensity === intensity}
                className={`cp-workout-level ${
                  selectedIntensity === intensity ? 'cp-workout-level--active' : ''
                }`}
                onClick={() => handleSelectIntensity(intensity)}
              >
                {intensity.toUpperCase()}
              </button>
            ))}
          </div>

          {workouts.length === 0 ? (
            <p className="cp-workout-empty">
              No {selectedIntensity.toUpperCase()} workouts available yet.
            </p>
          ) : (
            <div className="cp-workout-list">
              {workouts.map((workout) => (
                <article key={workout.id} className="cp-workout-card">
                  <header className="cp-workout-card-header">
                    <h3>{workout.title}</h3>
                    <p>{formatDuration(workout.totalDurationSeconds)}</p>
                  </header>
                  <p className="cp-workout-description">{workout.description}</p>
                  <WorkoutDetailTimeline workout={workout} ftp={ftp} />
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function WorkoutDetailTimeline({
  workout,
  ftp,
}: {
  workout: WorkoutDefinition
  ftp: number
}) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(
    workout.segments[0]?.id ?? null,
  )

  const activeSegment = useMemo(
    () =>
      workout.segments.find((segment) => segment.id === hoveredSegmentId) ??
      workout.segments[0] ??
      null,
    [hoveredSegmentId, workout.segments],
  )
  const { geometries: segmentGeometries, maxFtp } = useMemo(
    () => buildSegmentGeometries(workout.id, workout.segments),
    [workout.id, workout.segments],
  )

  const ftpLineY = getSegmentTopY(1.0, maxFtp)
  const maxLineY = getSegmentTopY(maxFtp, maxFtp)
  const showMaxLine = maxFtp > 1.05
  const maxWatts = Math.round(maxFtp * ftp)

  if (workout.segments.length === 0) {
    return <p className="cp-workout-empty">This workout has no parsable sections yet.</p>
  }

  return (
    <section className="cp-workout-detail">
      <div className="cp-workout-plot-container">
        <svg
          className="cp-workout-plot"
          viewBox={`0 0 ${WORKOUT_PLOT_WIDTH} ${WORKOUT_PLOT_HEIGHT}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredSegmentId(workout.segments[0]?.id ?? null)}
          aria-label={`Workout profile for ${workout.title}`}
        >
          <defs>
            {segmentGeometries.map((geometry) => (
              <linearGradient
                key={`${geometry.segment.id}-gradient`}
                id={geometry.gradientId}
                x1="0%"
                x2="100%"
                y1="0%"
                y2="0%"
              >
                <stop offset="0%" stopColor={getZoneColor(geometry.segment.ftpLow)} />
                <stop offset="100%" stopColor={getZoneColor(geometry.segment.ftpHigh)} />
              </linearGradient>
            ))}
          </defs>

          <line
            x1={0}
            y1={ftpLineY}
            x2={WORKOUT_PLOT_WIDTH}
            y2={ftpLineY}
            className="cp-workout-ref-line"
          />
          {showMaxLine && (
            <line
              x1={0}
              y1={maxLineY}
              x2={WORKOUT_PLOT_WIDTH}
              y2={maxLineY}
              className="cp-workout-ref-line"
            />
          )}

          {segmentGeometries.map((geometry) => {
            const isActive = activeSegment?.id === geometry.segment.id
            return (
              <g
                key={geometry.segment.id}
                className={`cp-workout-segment-group ${
                  isActive ? 'cp-workout-segment-group--active' : ''
                }`}
              >
                <path
                  d={geometry.path}
                  className="cp-workout-segment-shape"
                  fill={`url(#${geometry.gradientId})`}
                />
                <rect
                  x={geometry.x}
                  y={0}
                  width={geometry.width}
                  height={WORKOUT_PLOT_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${geometry.segment.label}, ${formatSegmentPower(geometry.segment, ftp)}`}
                  onMouseEnter={() => setHoveredSegmentId(geometry.segment.id)}
                  onFocus={() => setHoveredSegmentId(geometry.segment.id)}
                />
              </g>
            )
          })}
        </svg>
        <span
          className="cp-workout-ref-label"
          style={{ top: `${(ftpLineY / WORKOUT_PLOT_HEIGHT) * 100}%` }}
        >
          FTP {ftp} W
        </span>
        {showMaxLine && (
          <span
            className="cp-workout-ref-label"
            style={{ top: `${(maxLineY / WORKOUT_PLOT_HEIGHT) * 100}%` }}
          >
            {maxWatts} W
          </span>
        )}
      </div>

      {activeSegment ? (
        <div className="cp-workout-segment-readout">
          <p className="cp-workout-segment-title">
            {activeSegment.label} - {formatDuration(activeSegment.durationSeconds)}
          </p>
          <p className="cp-workout-segment-power">
            {formatSegmentPower(activeSegment, ftp)} - Zone {getZoneFromFtp(getMidFtp(activeSegment))}
          </p>
        </div>
      ) : null}
    </section>
  )
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

function buildSegmentGeometries(workoutId: string, segments: WorkoutSegment[]) {
  const totalDuration = Math.max(
    1,
    segments.reduce((total, segment) => total + segment.durationSeconds, 0),
  )
  const maxFtp = Math.max(
    0.01,
    ...segments.flatMap((segment) => [segment.ftpLow, segment.ftpHigh]),
  )
  const totalGap = Math.max(0, segments.length - 1) * WORKOUT_SEGMENT_GAP
  const availableWidth = WORKOUT_PLOT_WIDTH - totalGap
  let cursorX = 0

  const geometries = segments.map((segment) => {
    const width = Math.max(0.35, (segment.durationSeconds / totalDuration) * availableWidth)
    const leftY = getSegmentTopY(segment.ftpLow, maxFtp)
    const rightY = getSegmentTopY(segment.ftpHigh, maxFtp)
    const x = cursorX
    cursorX += width + WORKOUT_SEGMENT_GAP

    return {
      segment,
      x,
      width,
      gradientId: `cp-workout-${workoutId}-${segment.id}`,
      path: getSegmentPath(x, width, leftY, rightY),
    }
  })

  return { geometries, maxFtp }
}

function getSegmentPath(x: number, width: number, leftY: number, rightY: number): string {
  const bottom = WORKOUT_PLOT_BASELINE
  const leftTop = clamp(leftY, WORKOUT_PLOT_TOP_PADDING, bottom)
  const rightTop = clamp(rightY, WORKOUT_PLOT_TOP_PADDING, bottom)

  return `M ${x} ${bottom} L ${x + width} ${bottom} L ${x + width} ${rightTop} L ${x} ${leftTop} Z`
}

function getSegmentTopY(ftpRatio: number, maxFtp: number): number {
  const minY = WORKOUT_PLOT_TOP_PADDING
  const maxY = WORKOUT_PLOT_BASELINE - 1.5
  const normalized = clamp(ftpRatio / maxFtp, 0, 1)
  const y = maxY - normalized * (maxY - minY)
  return clamp(y, minY, maxY)
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
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes < 60) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
