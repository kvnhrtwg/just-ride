import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import type { WorkoutExecutionSample } from '@/hooks/useWorkoutExecution'
import './WorkoutTelemetryChart.scss'

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

type WorkoutTelemetryChartProps = {
  samples: WorkoutExecutionSample[]
  isWaitingForStart: boolean
}

type ChartPalette = {
  power: string
  cadence: string
  heartRate: string
  text: string
  grid: string
}

type TelemetryPoint = {
  x: number
  y: number | null
}

type CompressedTelemetrySample = {
  timelineSeconds: number
  powerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

const MAX_VISIBLE_WINDOW_SECONDS = 10 * 60
const MAX_EXPECTED_SAMPLE_STEP_SECONDS = 2
const NOMINAL_SAMPLE_STEP_SECONDS = 1

const DEFAULT_CHART_PALETTE: ChartPalette = {
  power: '#00f0ff',
  cadence: '#b000ff',
  heartRate: '#ff2d95',
  text: '#aa98cf',
  grid: 'rgba(255, 255, 255, 0.12)',
}

export function WorkoutTelemetryChart({
  samples,
  isWaitingForStart,
}: WorkoutTelemetryChartProps) {
  const [palette, setPalette] = useState<ChartPalette>(() => getChartPalette())

  useEffect(() => {
    setPalette(getChartPalette())
  }, [])

  const compressedSamples = useMemo(
    () => buildCompressedSeries(samples),
    [samples],
  )
  const timeWindow = useMemo(
    () => getTimeWindow(compressedSamples, MAX_VISIBLE_WINDOW_SECONDS),
    [compressedSamples],
  )
  const visibleSamples = useMemo(
    () => getVisibleSamples(compressedSamples, timeWindow.minElapsedSeconds),
    [compressedSamples, timeWindow.minElapsedSeconds],
  )

  const chartData = useMemo<ChartData<'line', TelemetryPoint[]>>(() => {
    return {
      datasets: [
        {
          label: 'Power (W)',
          data: visibleSamples.map((sample) =>
            toTelemetryPoint(sample.timelineSeconds, sample.powerWatts),
          ),
          borderColor: palette.power,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.38,
        },
        {
          label: 'Cadence (RPM)',
          data: visibleSamples.map((sample) =>
            toTelemetryPoint(sample.timelineSeconds, sample.cadenceRpm),
          ),
          borderColor: palette.cadence,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.38,
        },
        {
          label: 'Heart Rate (BPM)',
          data: visibleSamples.map((sample) =>
            toTelemetryPoint(sample.timelineSeconds, sample.heartRateBpm),
          ),
          borderColor: palette.heartRate,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.38,
        },
      ],
    }
  }, [palette, visibleSamples])

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      normalized: true,
      animation: false,
      events: [],
      layout: {
        padding: {
          left: 8,
        },
      },
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
          displayColors: true,
          callbacks: {
            title(items) {
              const first = items[0]
              if (!first) {
                return ''
              }
              const parsedX = first.parsed.x
              if (typeof parsedX !== 'number' || !Number.isFinite(parsedX)) {
                return ''
              }
              return formatElapsedLabel(parsedX)
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: timeWindow.minElapsedSeconds,
          max: timeWindow.maxElapsedSeconds,
          border: {
            display: false,
          },
          ticks: {
            display: false,
          },
          grid: {
            display: false,
            drawTicks: false,
          },
        },
        y: {
          beginAtZero: false,
          min: 50,
          border: {
            display: false,
          },
          ticks: {
            color: palette.text,
            maxTicksLimit: 4,
            crossAlign: 'far',
            padding: 12,
          },
          grid: {
            display: false,
            drawTicks: false,
          },
        },
      },
    }),
    [palette, timeWindow.maxElapsedSeconds, timeWindow.minElapsedSeconds],
  )

  return (
    <section className="cp-workout-telemetry" aria-label="Live telemetry chart">
      {visibleSamples.length > 0 ? (
        <div className="cp-workout-telemetry-canvas">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p className="cp-workout-telemetry-empty">
          {isWaitingForStart
            ? 'Waiting for first telemetry sample...'
            : 'Start riding to see power, cadence, and heart rate.'}
        </p>
      )}
    </section>
  )
}

function sanitizeMetric(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

function toTelemetryPoint(
  timelineSeconds: number,
  value: number | null,
): TelemetryPoint {
  return {
    x: timelineSeconds,
    y: sanitizeMetric(value),
  }
}

function buildCompressedSeries(
  samples: WorkoutExecutionSample[],
): CompressedTelemetrySample[] {
  if (samples.length === 0) {
    return []
  }

  const points: CompressedTelemetrySample[] = []
  let compressedOffsetSeconds = 0
  let previousElapsedSeconds: number | null = null

  for (const sample of samples) {
    const elapsedSeconds = Math.max(0, sample.elapsedSeconds)

    if (
      typeof previousElapsedSeconds === 'number' &&
      elapsedSeconds - previousElapsedSeconds > MAX_EXPECTED_SAMPLE_STEP_SECONDS
    ) {
      compressedOffsetSeconds +=
        elapsedSeconds - previousElapsedSeconds - NOMINAL_SAMPLE_STEP_SECONDS
    }

    points.push({
      timelineSeconds: Math.max(0, elapsedSeconds - compressedOffsetSeconds),
      powerWatts: sanitizeMetric(sample.livePowerWatts),
      cadenceRpm: sanitizeMetric(sample.cadenceRpm),
      heartRateBpm: sanitizeMetric(sample.heartRateBpm),
    })
    previousElapsedSeconds = elapsedSeconds
  }

  return points
}

function getTimeWindow(
  samples: CompressedTelemetrySample[],
  windowSizeSeconds: number,
): {
  minElapsedSeconds: number
  maxElapsedSeconds: number
} {
  const latestSample = samples[samples.length - 1]
  const latestElapsedSeconds = latestSample?.timelineSeconds ?? 0
  const minElapsedSeconds = Math.max(0, latestElapsedSeconds - windowSizeSeconds)
  return {
    minElapsedSeconds,
    maxElapsedSeconds: minElapsedSeconds + windowSizeSeconds,
  }
}

function getVisibleSamples(
  samples: CompressedTelemetrySample[],
  minElapsedSeconds: number,
): CompressedTelemetrySample[] {
  if (samples.length === 0) {
    return samples
  }

  let startIndex = 0
  while (
    startIndex < samples.length &&
    samples[startIndex].timelineSeconds < minElapsedSeconds
  ) {
    startIndex += 1
  }

  return startIndex === 0 ? samples : samples.slice(startIndex)
}

function resolveCssVariable(variableName: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()
  return value || fallback
}

function getChartPalette(): ChartPalette {
  return {
    power: resolveCssVariable('--cp-accent-cyan', DEFAULT_CHART_PALETTE.power),
    cadence: resolveCssVariable('--cp-accent-purple', DEFAULT_CHART_PALETTE.cadence),
    heartRate: resolveCssVariable('--cp-accent-pink', DEFAULT_CHART_PALETTE.heartRate),
    text: resolveCssVariable('--cp-text-secondary', DEFAULT_CHART_PALETTE.text),
    grid: resolveCssVariable('--cp-panel-border', DEFAULT_CHART_PALETTE.grid),
  }
}

function formatElapsedLabel(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
