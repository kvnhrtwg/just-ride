import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import './workouts.scss'

type PastWorkout = {
  _id: Id<'workoutSessions'>
  workoutTitle: string
  workoutIntensity: 'lit' | 'mit' | 'hit'
  status: 'completed' | 'ended'
  startedAt: number
  endedAt: number | null
  elapsedSeconds: number
  sampleCount: number
  averagePowerWatts: number | null
  averageHeartRateBpm: number | null
  averageCadenceRpm: number | null
}

const pastWorkoutsQuery = convexQuery(api.workouts.listPastWorkoutSessions, {})

export const Route = createFileRoute('/workouts/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(pastWorkoutsQuery)
  },
  component: WorkoutHistoryPage,
})

function WorkoutHistoryPage() {
  const { data: workouts } = useSuspenseQuery(pastWorkoutsQuery) as {
    data: PastWorkout[]
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <section className="cp-workout-history-view">
          <header className="cp-workout-history-header">
            <div className="cp-workout-history-title-block">
              <p className="cp-panel-label">History</p>
              <h2>Past workouts</h2>
            </div>
            <Link to="/" className="cp-btn cp-workout-history-action">
              Back to home
            </Link>
          </header>

          {workouts.length === 0 ? (
            <p className="cp-workout-history-empty">
              No past workouts yet. Complete a workout to see it here.
            </p>
          ) : (
            <div className="cp-workout-history-list">
              {workouts.map((workout) => {
                const endedAt = workout.endedAt ?? workout.startedAt
                const durationSeconds =
                  workout.elapsedSeconds > 0
                    ? workout.elapsedSeconds
                    : Math.max(0, Math.round((endedAt - workout.startedAt) / 1000))

                return (
                  <article key={workout._id} className="cp-workout-history-card">
                    <div className="cp-workout-history-card-header">
                      <div>
                        <h3>{workout.workoutTitle}</h3>
                        <p>
                          {formatDateTime(endedAt)} // {formatDuration(durationSeconds)}
                        </p>
                      </div>
                      <p className="cp-workout-history-status">
                        {workout.status === 'completed'
                          ? 'Completed'
                          : 'Ended early'}
                      </p>
                    </div>
                    <div className="cp-workout-history-metrics">
                      <p>{formatMetric(workout.averagePowerWatts, 'Avg Power', 'W')}</p>
                      <p>{formatMetric(workout.averageHeartRateBpm, 'Avg HR', 'BPM')}</p>
                      <p>{formatMetric(workout.averageCadenceRpm, 'Avg Cadence', 'RPM')}</p>
                      <p>{workout.sampleCount} samples</p>
                    </div>
                    <div className="cp-workout-history-actions">
                      <Link
                        to="/workouts/$sessionId"
                        params={{ sessionId: workout._id }}
                        className="cp-btn cp-workout-history-action"
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
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

function formatMetric(
  value: number | null,
  label: string,
  unit: string,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${label}: -- ${unit}`
  }
  return `${label}: ${value} ${unit}`
}
