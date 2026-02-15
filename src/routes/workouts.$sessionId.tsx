import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
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
import { useAction, useMutation as useConvexMutation } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { useId, useMemo, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Popover } from '@/components/Popover'
import { downloadFitFile } from '@/lib/fit-download'
import './workouts.$sessionId.scss'

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

type WorkoutDetailSample = {
  timestampMs: number
  elapsedSeconds: number
  powerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

type WorkoutDetailQueryResult = {
  session: {
    workoutTitle: string
    startedAt: number
    endedAt: number | null
    elapsedSeconds: number
  }
  samples: WorkoutDetailSample[]
}

type MetricKey = 'powerWatts' | 'heartRateBpm' | 'cadenceRpm'

type TelemetryPoint = {
  x: number
  y: number | null
}

const METRIC_CHARTS: Array<{
  key: MetricKey
  title: string
  unit: string
  color: string
  emptyMessage: string
}> = [
  {
    key: 'powerWatts',
    title: 'Watts',
    unit: 'W',
    color: '#00f0ff',
    emptyMessage: 'No power samples were recorded for this workout.',
  },
  {
    key: 'heartRateBpm',
    title: 'Heart rate',
    unit: 'BPM',
    color: '#ff2d95',
    emptyMessage: 'No heart rate samples were recorded for this workout.',
  },
  {
    key: 'cadenceRpm',
    title: 'Cadence',
    unit: 'RPM',
    color: '#b000ff',
    emptyMessage: 'No cadence samples were recorded for this workout.',
  },
]

export const Route = createFileRoute('/workouts/$sessionId')({
  loader: async ({ context, params }) => {
    const sessionId = params.sessionId as Id<'workoutSessions'>
    await context.queryClient.ensureQueryData(getWorkoutDetailQuery(sessionId))
  },
  component: WorkoutDetailPage,
})

function WorkoutDetailPage() {
  const { sessionId } = Route.useParams()
  const normalizedSessionId = sessionId as Id<'workoutSessions'>
  const navigate = useNavigate()
  const discardWorkoutSession = useConvexMutation(
    api.workouts.discardWorkoutSession,
  )
  const generateWorkoutFitDownload = useAction(
    api.workoutExports.generateWorkoutFitDownload,
  )
  const deleteWorkoutPopoverId = useId()
  const deleteWorkoutPopoverRef = useRef<HTMLDivElement | null>(null)
  const [isPreparingFitDownload, setIsPreparingFitDownload] = useState(false)
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false)
  const [fitDownloadErrorMessage, setFitDownloadErrorMessage] = useState<
    string | null
  >(null)
  const [deleteWorkoutErrorMessage, setDeleteWorkoutErrorMessage] = useState<
    string | null
  >(null)
  const { data: workoutDetail } = useSuspenseQuery(
    getWorkoutDetailQuery(normalizedSessionId),
  ) as { data: WorkoutDetailQueryResult }

  const orderedSamples = useMemo(
    () =>
      workoutDetail.samples.slice().sort((left, right) => {
        if (left.elapsedSeconds !== right.elapsedSeconds) {
          return left.elapsedSeconds - right.elapsedSeconds
        }
        return left.timestampMs - right.timestampMs
      }),
    [workoutDetail.samples],
  )

  const averagePowerWatts = useMemo(
    () => getAverageMetric(orderedSamples, 'powerWatts'),
    [orderedSamples],
  )
  const averageHeartRateBpm = useMemo(
    () => getAverageMetric(orderedSamples, 'heartRateBpm'),
    [orderedSamples],
  )
  const averageCadenceRpm = useMemo(
    () => getAverageMetric(orderedSamples, 'cadenceRpm'),
    [orderedSamples],
  )

  const workoutEndedAt =
    workoutDetail.session.endedAt ??
    orderedSamples.at(-1)?.timestampMs ??
    workoutDetail.session.startedAt
  const workoutDurationSeconds =
    workoutDetail.session.elapsedSeconds > 0
      ? workoutDetail.session.elapsedSeconds
      : Math.max(
          0,
          Math.round((workoutEndedAt - workoutDetail.session.startedAt) / 1000),
        )
  const maxElapsedSeconds = orderedSamples.at(-1)?.elapsedSeconds ?? 0
  const chartMaxElapsedSeconds = Math.max(
    60,
    Math.ceil(maxElapsedSeconds / 60) * 60,
  )

  const handleDownloadFit = async () => {
    setIsPreparingFitDownload(true)
    setFitDownloadErrorMessage(null)
    try {
      const result = await generateWorkoutFitDownload({
        sessionId: normalizedSessionId,
      })
      downloadFitFile(result)
    } catch (error) {
      setFitDownloadErrorMessage(
        `Unable to generate FIT download: ${getErrorMessage(error)}`,
      )
    } finally {
      setIsPreparingFitDownload(false)
    }
  }

  const handleDeleteWorkout = async (): Promise<boolean> => {
    if (isDeletingWorkout) {
      return false
    }

    setDeleteWorkoutErrorMessage(null)
    setFitDownloadErrorMessage(null)
    setIsDeletingWorkout(true)
    try {
      await discardWorkoutSession({
        sessionId: normalizedSessionId,
      })
      void navigate({ to: '/' })
      return true
    } catch (error) {
      setDeleteWorkoutErrorMessage(
        `Unable to delete workout: ${getErrorMessage(error)}`,
      )
      return false
    } finally {
      setIsDeletingWorkout(false)
    }
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <section className="cp-workout-detail-view">
          <header className="cp-workout-detail-header">
            <div className="cp-workout-detail-title-block">
              <p className="cp-panel-label">Workout</p>
              <h2>{workoutDetail.session.workoutTitle}</h2>
              <p className="cp-workout-detail-meta">
                {formatDateTime(workoutEndedAt)} //{' '}
                {formatDuration(workoutDurationSeconds)}
              </p>
            </div>
            <div className="cp-workout-detail-actions">
              <Link to="/" className="cp-btn cp-workout-detail-action">
                Back to home
              </Link>
              <button
                type="button"
                className="cp-btn cp-workout-detail-action"
                onClick={handleDownloadFit}
                disabled={isPreparingFitDownload || isDeletingWorkout}
              >
                {isPreparingFitDownload ? 'Preparing FIT' : 'Download FIT'}
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-danger cp-workout-detail-action"
                popoverTarget={deleteWorkoutPopoverId}
                popoverTargetAction="toggle"
                disabled={isPreparingFitDownload || isDeletingWorkout}
              >
                {isDeletingWorkout ? 'Deleting' : 'Delete workout'}
              </button>
            </div>
          </header>
          <Popover
            id={deleteWorkoutPopoverId}
            ref={deleteWorkoutPopoverRef}
            title="Delete workout?"
            closeLabel="Close delete workout confirmation"
            className="cp-workout-detail-delete-popover"
            titleTag="h3"
          >
            <p>This permanently removes this workout and all recorded samples.</p>
            <div className="cp-workout-detail-delete-actions">
              <button
                type="button"
                className="cp-btn cp-workout-detail-action"
                popoverTarget={deleteWorkoutPopoverId}
                popoverTargetAction="hide"
                disabled={isDeletingWorkout}
              >
                Keep Workout
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-danger cp-workout-detail-action"
                onClick={async () => {
                  const didDelete = await handleDeleteWorkout()
                  if (didDelete) {
                    deleteWorkoutPopoverRef.current?.hidePopover()
                  }
                }}
                disabled={isDeletingWorkout}
              >
                {isDeletingWorkout ? 'Deleting' : 'Delete'}
              </button>
            </div>
          </Popover>

          <section className="cp-workout-detail-summary" aria-label="Workout averages">
            <SummaryMetric
              label="Average watts"
              value={formatMetricValue(averagePowerWatts, 'W')}
            />
            <SummaryMetric
              label="Average heart rate"
              value={formatMetricValue(averageHeartRateBpm, 'BPM')}
            />
            <SummaryMetric
              label="Average cadence"
              value={formatMetricValue(averageCadenceRpm, 'RPM')}
            />
          </section>

          <section className="cp-workout-detail-charts" aria-label="Workout telemetry charts">
            {METRIC_CHARTS.map((chartConfig) => (
              <WorkoutMetricChart
                key={chartConfig.key}
                title={chartConfig.title}
                unit={chartConfig.unit}
                color={chartConfig.color}
                points={toMetricPoints(orderedSamples, chartConfig.key)}
                maxElapsedSeconds={chartMaxElapsedSeconds}
                emptyMessage={chartConfig.emptyMessage}
              />
            ))}
          </section>

          {fitDownloadErrorMessage ? (
            <p className="cp-workout-detail-download-error">{fitDownloadErrorMessage}</p>
          ) : null}
          {deleteWorkoutErrorMessage ? (
            <p className="cp-workout-detail-delete-error">
              {deleteWorkoutErrorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="cp-workout-detail-summary-metric">
      <p className="cp-panel-label">{label}</p>
      <p>{value}</p>
    </article>
  )
}

function WorkoutMetricChart({
  title,
  unit,
  color,
  points,
  maxElapsedSeconds,
  emptyMessage,
}: {
  title: string
  unit: string
  color: string
  points: TelemetryPoint[]
  maxElapsedSeconds: number
  emptyMessage: string
}) {
  const hasValues = points.some(
    (point) => typeof point.y === 'number' && Number.isFinite(point.y),
  )

  const chartData = useMemo<ChartData<'line', TelemetryPoint[]>>(
    () => ({
      datasets: [
        {
          label: title,
          data: points,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.3,
        },
      ],
    }),
    [color, points, title],
  )

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          callbacks: {
            title(items) {
              const first = items[0]
              if (!first) {
                return ''
              }
              const elapsedSeconds = first.parsed.x
              if (
                typeof elapsedSeconds !== 'number' ||
                !Number.isFinite(elapsedSeconds)
              ) {
                return ''
              }
              return formatDuration(elapsedSeconds)
            },
            label(context) {
              const value = context.parsed.y
              if (typeof value !== 'number' || !Number.isFinite(value)) {
                return '--'
              }
              return `${Math.round(value)} ${unit}`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: maxElapsedSeconds,
          border: {
            color: 'rgba(255, 255, 255, 0.24)',
          },
          ticks: {
            color: '#aa98cf',
            maxTicksLimit: 7,
            callback(value) {
              return formatDuration(Number(value))
            },
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
          },
        },
        y: {
          beginAtZero: true,
          border: {
            color: 'rgba(255, 255, 255, 0.24)',
          },
          ticks: {
            color: '#aa98cf',
            maxTicksLimit: 5,
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
          },
        },
      },
    }),
    [maxElapsedSeconds, unit],
  )

  return (
    <article className="cp-workout-detail-chart" aria-label={`${title} chart`}>
      <header className="cp-workout-detail-chart-header">
        <h3>{title}</h3>
      </header>
      {hasValues ? (
        <div className="cp-workout-detail-chart-canvas">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p className="cp-workout-detail-chart-empty">{emptyMessage}</p>
      )}
    </article>
  )
}

function toMetricPoints(
  samples: WorkoutDetailSample[],
  metricKey: MetricKey,
): TelemetryPoint[] {
  return samples.map((sample) => ({
    x: sample.elapsedSeconds,
    y: sanitizeMetric(sample[metricKey]),
  }))
}

function sanitizeMetric(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

function getAverageMetric(
  samples: WorkoutDetailSample[],
  metricKey: MetricKey,
): number | null {
  let total = 0
  let count = 0

  for (const sample of samples) {
    const value = sample[metricKey]
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value
      count += 1
    }
  }

  if (count === 0) {
    return null
  }

  return Math.round(total / count)
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
  return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDateTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestampMs))
}

function formatMetricValue(value: number | null, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `-- ${unit}`
  }
  return `${value} ${unit}`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unknown error'
}

function getWorkoutDetailQuery(sessionId: Id<'workoutSessions'>) {
  return convexQuery(api.workouts.getWorkoutSessionForFitExport, {
    sessionId,
  })
}
