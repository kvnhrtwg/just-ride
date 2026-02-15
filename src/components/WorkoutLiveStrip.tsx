import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleSlash2, HeartPulse, RotateCw, Zap } from 'lucide-react'
import type { WorkoutDefinition, WorkoutSegment } from '@/workouts/catalog'
import { getWorkoutZoneColor } from '@/workouts/powerZones'
import './WorkoutLiveStrip.scss'

type WorkoutLiveStripProps = {
  workout: WorkoutDefinition
  ftp: number
  riderWeightKg: number
  activeSegment: WorkoutSegment | null
  elapsedSeconds: number
  isWaitingForStart: boolean
  isCompleted: boolean
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
  avgPowerWatts: number | null
  avgCadenceRpm: number | null
  avgHeartRateBpm: number | null
  workoutIntensityPercent: number
}

export function WorkoutLiveStrip({
  workout,
  ftp,
  riderWeightKg,
  activeSegment,
  elapsedSeconds,
  isWaitingForStart,
  isCompleted,
  livePowerWatts,
  cadenceRpm,
  heartRateBpm,
  avgPowerWatts,
  avgCadenceRpm,
  avgHeartRateBpm,
  workoutIntensityPercent,
}: WorkoutLiveStripProps) {
  if (workout.segments.length === 0) {
    return null
  }

  const displaySegment = getDisplaySegment({
    workout,
    activeSegment,
    isWaitingForStart,
    isCompleted,
  })
  const segmentProgress = getSegmentProgress({
    segment: displaySegment,
    elapsedSeconds,
    isWaitingForStart,
    isCompleted,
  })
  const segmentRemainingSeconds = getSegmentRemainingSeconds({
    segment: displaySegment,
    elapsedSeconds,
    isWaitingForStart,
    isCompleted,
  })
  const zoneColor = getWorkoutZoneColor(getMidFtp(displaySegment))
  const blockStyle = {
    '--cp-workout-live-zone-color': zoneColor,
    '--cp-workout-live-zone-progress': `${(segmentProgress * 100).toFixed(3)}%`,
  } as CSSProperties
  const currentWattsPerKg = formatWattsPerKg(livePowerWatts, riderWeightKg)

  return (
    <section className="cp-workout-live-strip" aria-label="Live workout status">
      <div className="cp-workout-live-metrics">
        <LiveMetric
          label="Watts"
          icon={Zap}
          value={livePowerWatts}
          avgValue={avgPowerWatts}
          unit="W"
          tone="power"
          leadingAverageValue={`${currentWattsPerKg} W/kg`}
        />
        <LiveMetric
          label="Cadence"
          icon={RotateCw}
          value={cadenceRpm}
          avgValue={avgCadenceRpm}
          unit="RPM"
          tone="cadence"
        />
        <LiveMetric
          label="Heart rate"
          icon={HeartPulse}
          value={heartRateBpm}
          avgValue={avgHeartRateBpm}
          unit="BPM"
          tone="bpm"
        />
      </div>
      <div className="cp-workout-live-block" style={blockStyle}>
        <span className="cp-workout-live-block-power">
          {formatBlockPower(displaySegment, ftp, workoutIntensityPercent)}
        </span>
        <span className="cp-workout-live-block-remaining">
          {formatRemainingDuration(segmentRemainingSeconds)}
        </span>
      </div>
    </section>
  )
}

function LiveMetric({
  label,
  icon: Icon,
  value,
  avgValue,
  unit,
  tone,
  leadingAverageValue,
}: {
  label: string
  icon: LucideIcon
  value: number | null
  avgValue: number | null
  unit: string
  tone: 'power' | 'cadence' | 'bpm'
  leadingAverageValue?: string
}) {
  return (
    <article
      className={`cp-workout-live-metric cp-workout-live-metric--${tone}`}
      aria-label={label}
    >
      <p className="cp-workout-live-metric-value">
        <p className="cp-workout-live-metric-icon" aria-hidden="true">
          <Icon size={24} strokeWidth={2} />
        </p>
        <span>{value ?? '--'}</span>
        <span className="cp-workout-live-metric-unit">{unit}</span>
      </p>
      <p className="cp-workout-live-metric-average">
        {leadingAverageValue ? (
          <span className="cp-workout-live-metric-average-leading">
            {leadingAverageValue} //
          </span>
        ) : null}
        <CircleSlash2
          size={12}
          strokeWidth={2}
          className="cp-workout-live-metric-average-icon"
          aria-hidden="true"
        />
        <span>{avgValue ?? '--'}</span>
        <span className="cp-workout-live-metric-average-unit">{unit}</span>
      </p>
    </article>
  )
}

function getDisplaySegment({
  workout,
  activeSegment,
  isWaitingForStart,
  isCompleted,
}: {
  workout: WorkoutDefinition
  activeSegment: WorkoutSegment | null
  isWaitingForStart: boolean
  isCompleted: boolean
}): WorkoutSegment {
  const firstSegment = workout.segments[0]
  const lastSegment = workout.segments.at(-1) ?? firstSegment

  if (isCompleted) {
    return lastSegment
  }

  if (isWaitingForStart || !activeSegment) {
    return firstSegment
  }

  return activeSegment
}

function getSegmentProgress({
  segment,
  elapsedSeconds,
  isWaitingForStart,
  isCompleted,
}: {
  segment: WorkoutSegment
  elapsedSeconds: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): number {
  if (isCompleted) {
    return 1
  }

  if (isWaitingForStart || segment.durationSeconds <= 0) {
    return 0
  }

  const secondsIntoSegment = clamp(
    elapsedSeconds - segment.startSecond,
    0,
    segment.durationSeconds,
  )
  return secondsIntoSegment / segment.durationSeconds
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

function applyIntensityToWatts(
  watts: number,
  workoutIntensityPercent: number,
): number {
  const normalizedPercent = Number.isFinite(workoutIntensityPercent)
    ? workoutIntensityPercent
    : 100
  const scaledWatts = Math.round(watts * (normalizedPercent / 100))
  return clamp(scaledWatts, 0, 2000)
}

function getSegmentRemainingSeconds({
  segment,
  elapsedSeconds,
  isWaitingForStart,
  isCompleted,
}: {
  segment: WorkoutSegment
  elapsedSeconds: number
  isWaitingForStart: boolean
  isCompleted: boolean
}): number {
  if (isCompleted) {
    return 0
  }

  if (isWaitingForStart || segment.durationSeconds <= 0) {
    return Math.max(0, segment.durationSeconds)
  }

  const secondsIntoSegment = clamp(
    elapsedSeconds - segment.startSecond,
    0,
    segment.durationSeconds,
  )
  return Math.max(0, segment.durationSeconds - secondsIntoSegment)
}

function formatRemainingDuration(totalSeconds: number): string {
  const safeTotal = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeTotal / 60)
  const seconds = safeTotal % 60

  if (minutes < 60) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`
}

function getMidFtp(segment: WorkoutSegment): number {
  return (segment.ftpLow + segment.ftpHigh) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatWattsPerKg(
  livePowerWatts: number | null,
  riderWeightKg: number,
): string {
  if (
    typeof livePowerWatts !== 'number' ||
    !Number.isFinite(livePowerWatts) ||
    !Number.isFinite(riderWeightKg) ||
    riderWeightKg <= 0
  ) {
    return '--'
  }
  return (livePowerWatts / riderWeightKg).toFixed(1)
}
