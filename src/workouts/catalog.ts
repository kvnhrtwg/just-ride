export type WorkoutIntensity = 'lit' | 'mit' | 'hit'

export type WorkoutSegment = {
  id: string
  label: string
  kind: 'steady' | 'ramp' | 'interval-on' | 'interval-off'
  durationSeconds: number
  ftpLow: number
  ftpHigh: number
  startSecond: number
}

export type WorkoutDefinition = {
  id: string
  fileName: string
  sourcePath: string
  intensity: WorkoutIntensity
  title: string
  description: string
  totalDurationSeconds: number
  segments: WorkoutSegment[]
}

const WORKOUT_MODULES = import.meta.glob('./**/*.zwo', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const INTENSITIES: WorkoutIntensity[] = ['lit', 'mit', 'hit']

const TITLE_BY_TAG: Record<string, string> = {
  warmup: 'Warmup',
  cooldown: 'Cooldown',
  steadystate: 'Steady',
  intervalst: 'Intervals',
}

export const workouts: WorkoutDefinition[] = Object.entries(WORKOUT_MODULES)
  .map(([path, raw]) => parseWorkout(path, raw))
  .filter((workout): workout is WorkoutDefinition => workout !== null)
  .sort((a, b) => a.title.localeCompare(b.title))

export const workoutsByIntensity: Record<WorkoutIntensity, WorkoutDefinition[]> = {
  lit: workouts.filter((workout) => workout.intensity === 'lit'),
  mit: workouts.filter((workout) => workout.intensity === 'mit'),
  hit: workouts.filter((workout) => workout.intensity === 'hit'),
}

export function getInitialWorkoutIntensity(): WorkoutIntensity {
  for (const intensity of INTENSITIES) {
    if (workoutsByIntensity[intensity].length > 0) {
      return intensity
    }
  }

  return 'mit'
}

function parseWorkout(sourcePath: string, raw: string): WorkoutDefinition | null {
  const intensity = getIntensityFromPath(sourcePath)
  if (!intensity) {
    return null
  }

  const fileName = sourcePath.split('/').at(-1)?.replace(/\.zwo$/i, '') ?? 'workout'
  const title = extractTagContent(raw, 'name') ?? humanizeFileName(fileName)
  const description =
    extractTagContent(raw, 'description') ?? 'No workout description provided.'
  const workoutContent = extractTagContent(raw, 'workout') ?? ''
  const segments = parseSegments(fileName, workoutContent)
  const totalDurationSeconds = segments.reduce(
    (duration, segment) => duration + segment.durationSeconds,
    0,
  )

  return {
    id: `${intensity}-${slugify(fileName)}`,
    fileName,
    sourcePath,
    intensity,
    title,
    description: normalizeWhitespace(description),
    totalDurationSeconds,
    segments,
  }
}

function parseSegments(fileName: string, workoutContent: string): WorkoutSegment[] {
  const segments: WorkoutSegment[] = []
  let elapsedSeconds = 0
  let segmentIndex = 0

  const segmentRegex = /<([A-Za-z]+)([^>]*)>([\s\S]*?)<\/\1>|<([A-Za-z]+)([^>]*)\/>/g
  let match: RegExpExecArray | null

  while ((match = segmentRegex.exec(workoutContent)) !== null) {
    const rawTagName = (match[1] ?? match[4] ?? '').toLowerCase()
    const attributeSource = match[2] ?? match[5] ?? ''
    const attrs = parseAttributes(attributeSource)

    if (rawTagName === 'intervalst') {
      const repeat = getPositiveInt(attrs.Repeat, 1)
      const onDuration = getPositiveInt(attrs.OnDuration, 0)
      const offDuration = getPositiveInt(attrs.OffDuration, 0)
      const onPower = getNonNegativeNumber(attrs.OnPower)
      const offPower = getNonNegativeNumber(attrs.OffPower)

      for (let index = 0; index < repeat; index += 1) {
        if (onDuration > 0) {
          segments.push({
            id: `${slugify(fileName)}-segment-${segmentIndex}`,
            label: 'Interval On',
            kind: 'interval-on',
            durationSeconds: onDuration,
            ftpLow: onPower,
            ftpHigh: onPower,
            startSecond: elapsedSeconds,
          })
          elapsedSeconds += onDuration
          segmentIndex += 1
        }

        if (offDuration > 0) {
          segments.push({
            id: `${slugify(fileName)}-segment-${segmentIndex}`,
            label: 'Interval Recover',
            kind: 'interval-off',
            durationSeconds: offDuration,
            ftpLow: offPower,
            ftpHigh: offPower,
            startSecond: elapsedSeconds,
          })
          elapsedSeconds += offDuration
          segmentIndex += 1
        }
      }

      continue
    }

    const duration = getPositiveInt(attrs.Duration, 0)
    if (duration < 1) {
      continue
    }

    const hasRampPower = typeof attrs.PowerLow === 'string' || typeof attrs.PowerHigh === 'string'
    const lowFromAttr = hasRampPower ? getNonNegativeNumber(attrs.PowerLow ?? attrs.Power) : null
    const highFromAttr = hasRampPower ? getNonNegativeNumber(attrs.PowerHigh ?? attrs.Power) : null
    const steadyPower = getNonNegativeNumber(attrs.Power)
    const ftpLow = lowFromAttr ?? steadyPower
    const ftpHigh = highFromAttr ?? steadyPower
    const kind: WorkoutSegment['kind'] =
      ftpLow !== ftpHigh ? 'ramp' : rawTagName === 'steadystate' ? 'steady' : 'ramp'
    const fallbackLabel = rawTagName in TITLE_BY_TAG ? TITLE_BY_TAG[rawTagName] : 'Segment'

    segments.push({
      id: `${slugify(fileName)}-segment-${segmentIndex}`,
      label: fallbackLabel,
      kind,
      durationSeconds: duration,
      ftpLow,
      ftpHigh,
      startSecond: elapsedSeconds,
    })
    elapsedSeconds += duration
    segmentIndex += 1
  }

  return segments
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributeRegex = /([A-Za-z]+)="([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = attributeRegex.exec(source)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2])
  }

  return attributes
}

function getIntensityFromPath(path: string): WorkoutIntensity | null {
  const lowerPath = path.toLowerCase()
  for (const intensity of INTENSITIES) {
    if (lowerPath.includes(`/${intensity}/`) || lowerPath.startsWith(`./${intensity}/`)) {
      return intensity
    }
  }

  return null
}

function extractTagContent(source: string, tag: string): string | null {
  const tagRegex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')
  const match = source.match(tagRegex)
  if (!match) {
    return null
  }

  return decodeXmlEntities(match[1].trim())
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function humanizeFileName(fileName: string): string {
  return fileName.replace(/[_-]+/g, ' ').trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getPositiveInt(rawValue: string | undefined, fallback: number): number {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.round(value)
}

function getNonNegativeNumber(rawValue: string | undefined): number {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return value
}
