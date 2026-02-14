import { useState } from 'react'
import {
  getInitialWorkoutIntensity,
  workoutsByIntensity,
  type WorkoutDefinition,
  type WorkoutIntensity,
} from '@/workouts/catalog'
import { WorkoutTimeline } from '@/components/WorkoutTimeline'
import './WorkoutSelector.scss'

type WorkoutSelectorProps = {
  ftp: number
  ergControlAvailable: boolean
  onStartWorkout: (workout: WorkoutDefinition) => void
}

const INTENSITY_OPTIONS: WorkoutIntensity[] = ['lit', 'mit', 'hit']

export function WorkoutSelector({
  ftp,
  ergControlAvailable,
  onStartWorkout,
}: WorkoutSelectorProps) {
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
          {!ergControlAvailable ? (
            <p className="cp-workout-helper">
              Connect a trainer with FTMS control before starting a workout.
            </p>
          ) : null}
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
                  <WorkoutTimeline workout={workout} ftp={ftp} />
                  <div className="cp-workout-actions">
                    <button
                      type="button"
                      className="cp-workout-action cp-workout-action--start"
                      disabled={!ergControlAvailable || workout.segments.length === 0}
                      onClick={() => onStartWorkout(workout)}
                    >
                      Start Workout
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
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
