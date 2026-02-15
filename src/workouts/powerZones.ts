export type WorkoutZone = 1 | 2 | 3 | 4 | 5 | 6

export const WORKOUT_ZONE_COLORS: Record<WorkoutZone, string> = {
  1: '#e3e3e3',
  2: '#00f0ff',
  3: '#39ff57',
  4: '#ffe600',
  5: '#ff6a00',
  6: '#ff2d95',
}

export function getWorkoutZoneFromFtp(ftpRatio: number): WorkoutZone {
  if (ftpRatio < 0.56) return 1
  if (ftpRatio < 0.76) return 2
  if (ftpRatio < 0.91) return 3
  if (ftpRatio < 1.06) return 4
  if (ftpRatio < 1.21) return 5
  return 6
}

export function getWorkoutZoneColor(ftpRatio: number): string {
  return WORKOUT_ZONE_COLORS[getWorkoutZoneFromFtp(ftpRatio)]
}
