import type {
  ClassType,
  CustomRepeat,
  FreeSlot,
  ScheduleOccurrence,
  ScheduleSeries,
} from '../types'

export const TYPE_RULES: Record<
  ClassType,
  { intervalDays: number; totalSessions: number; label: string }
> = {
  LEC: { intervalDays: 7, totalSessions: 13, label: 'Weekly · 13 sessions' },
  LAB: { intervalDays: 14, totalSessions: 6, label: 'Every 2 weeks · 6 sessions' },
  GSLC: { intervalDays: 0, totalSessions: 1, label: 'One time only' },
  CUSTOM: { intervalDays: 0, totalSessions: 1, label: 'Personal · repeats however you choose' },
}

export const CUSTOM_REPEAT_INTERVALS: Record<CustomRepeat, number> = {
  once: 0,
  daily: 1,
  weekly: 7,
  biweekly: 14,
}

export const CUSTOM_REPEAT_LABELS: Record<CustomRepeat, string> = {
  once: 'One time only',
  daily: 'Every day',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
}

/** Default horizon for a repeating personal schedule with no chosen end date. */
export const DEFAULT_CUSTOM_WEEKS = 12

/** Hard ceiling so a repeating personal schedule can never grow without bound. */
const MAX_CUSTOM_OCCURRENCES = 400

export function isAcademicType(type: ClassType): boolean {
  return type !== 'CUSTOM'
}

export function defaultCustomEndDate(firstDate: string): string {
  return addDays(firstDate, DEFAULT_CUSTOM_WEEKS * 7)
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

export function startOfWeek(value: string): string {
  const date = parseLocalDate(value)
  const day = date.getDay()
  const distanceFromMonday = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - distanceFromMonday)
  return toLocalDateString(date)
}

export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function getTodayString(): string {
  return toLocalDateString(new Date())
}

/**
 * Mata kuliah that run more than the usual 13 lecture sessions. Matched loosely
 * on the course name so OCR spacing and casing differences still count.
 */
export const COURSE_SESSION_OVERRIDES: Array<{ match: string; totalSessions: number }> = [
  { match: 'algorithm design', totalSessions: 32 },
  { match: 'artificial intelligence', totalSessions: 32 },
]

export function totalSessionsFor(type: ClassType, name?: string): number {
  if (type === 'LEC' && name) {
    const normalized = normalizeScheduleName(name)
    const override = COURSE_SESSION_OVERRIDES.find((item) => normalized.includes(item.match))
    if (override) return override.totalSessions
  }
  return TYPE_RULES[type].totalSessions
}

export function normalizeStartingSession(
  type: ClassType,
  session: number,
  name?: string,
): number {
  if (type === 'CUSTOM') return 1
  // A GSLC keeps the session number it stands in for, so the ceiling is the
  // largest lecture session number rather than its own single-occurrence count.
  const ceiling = type === 'GSLC' ? totalSessionsFor('LEC', name) : totalSessionsFor(type, name)
  return Math.min(Math.max(Math.round(session) || 1, 1), ceiling)
}

/** Dates for a personal schedule, bounded by its end date and a hard ceiling. */
function customSeriesDates(series: ScheduleSeries): string[] {
  const repeat = series.repeat ?? 'once'
  const interval = CUSTOM_REPEAT_INTERVALS[repeat]
  if (!interval) return [series.firstDate]

  const lastDate = series.endDate || defaultCustomEndDate(series.firstDate)
  if (lastDate < series.firstDate) return [series.firstDate]

  const dates: string[] = []
  let date = series.firstDate
  while (date <= lastDate && dates.length < MAX_CUSTOM_OCCURRENCES) {
    dates.push(date)
    date = addDays(date, interval)
  }
  return dates
}

/**
 * Slots of the same mata kuliah and class type share one pool of academic
 * sessions, so two slots on the same day take consecutive numbers (6 and 7) and
 * the following week continues from there (8 and 9).
 */
function academicGroupOccurrences(group: ScheduleSeries[]): ScheduleOccurrence[] {
  const type = group[0].type
  const rule = TYPE_RULES[type]
  const totalSessions = totalSessionsFor(type, group[0].name)
  const firstSession = Math.min(
    ...group.map((series) =>
      normalizeStartingSession(type, series.startingSession, series.name),
    ),
  )
  const capacity = Math.max(totalSessions - firstSession + 1, 1)
  const perSlot = rule.intervalDays === 0 ? 1 : Math.ceil(capacity / group.length) + 1

  const candidates = group.flatMap((series) =>
    Array.from({ length: perSlot }, (_, index) => ({
      series,
      date: addDays(series.firstDate, index * rule.intervalDays),
    })),
  )

  candidates.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.series.startTime.localeCompare(right.series.startTime) ||
      left.series.id.localeCompare(right.series.id),
  )

  const chosen = candidates.slice(0, capacity)
  const countsBySeries = new Map<string, number>()
  for (const item of chosen) {
    countsBySeries.set(item.series.id, (countsBySeries.get(item.series.id) ?? 0) + 1)
  }

  return chosen
    .map((item, index) => ({
      id: `${item.series.id}:${item.date}`,
      seriesId: item.series.id,
      name: item.series.name,
      type: item.series.type,
      date: item.date,
      startTime: item.series.startTime,
      endTime: item.series.endTime,
      sessionNumber: firstSession + index,
      isRecurring: (countsBySeries.get(item.series.id) ?? 0) > 1,
    }))
    .filter((occurrence) => {
      const series = group.find((item) => item.id === occurrence.seriesId)
      return !series?.excludedDates.includes(occurrence.date)
    })
}

/** Slots that never share a session pool: personal schedules and one-off GSLCs. */
function groupKey(series: ScheduleSeries): string {
  if (series.type === 'CUSTOM' || series.type === 'GSLC') return `solo:${series.id}`
  return `${series.type}:${normalizeScheduleName(series.name)}`
}

function customSeriesOccurrences(series: ScheduleSeries): ScheduleOccurrence[] {
  const dates = customSeriesDates(series)
  const isRecurring = dates.length > 1

  return dates
    .map((date, index) => ({
      id: `${series.id}:${date}`,
      seriesId: series.id,
      name: series.name,
      type: series.type,
      date,
      startTime: series.startTime,
      endTime: series.endTime,
      sessionNumber: index + 1,
      isRecurring,
    }))
    .filter((occurrence) => !series.excludedDates.includes(occurrence.date))
}

export function occurrencesForSeries(series: ScheduleSeries): ScheduleOccurrence[] {
  return series.type === 'CUSTOM'
    ? customSeriesOccurrences(series)
    : academicGroupOccurrences([series])
}

export function getOccurrences(
  series: ScheduleSeries[],
  rangeStart?: string,
  rangeEnd?: string,
): ScheduleOccurrence[] {
  const groups = new Map<string, ScheduleSeries[]>()
  for (const item of series) {
    const key = groupKey(item)
    const existing = groups.get(key)
    if (existing) existing.push(item)
    else groups.set(key, [item])
  }

  return [...groups.values()]
    .flatMap((group) =>
      group[0].type === 'CUSTOM'
        ? group.flatMap(customSeriesOccurrences)
        : academicGroupOccurrences(group),
    )
    .filter((occurrence) => !rangeStart || occurrence.date >= rangeStart)
    .filter((occurrence) => !rangeEnd || occurrence.date <= rangeEnd)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startTime.localeCompare(right.startTime) ||
        left.name.localeCompare(right.name),
    )
}

export interface SeriesInput {
  name: string
  type: ClassType
  firstDate: string
  startTime: string
  endTime: string
  startingSession: number
  repeat?: CustomRepeat
  endDate?: string
}

export interface DuplicateMatch {
  name: string
  date: string
  startTime: string
  endTime: string
}

export function createSeries(input: SeriesInput): ScheduleSeries {
  return {
    id: makeId(),
    name: input.name,
    type: input.type,
    firstDate: input.firstDate,
    startTime: input.startTime,
    endTime: input.endTime,
    startingSession: normalizeStartingSession(input.type, input.startingSession, input.name),
    excludedDates: [],
    createdAt: new Date().toISOString(),
    ...(input.repeat ? { repeat: input.repeat } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
  }
}

/** Loose name comparison so OCR spacing/casing differences still match. */
export function normalizeScheduleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function timesOverlap(
  left: { startTime: string; endTime: string },
  right: { startTime: string; endTime: string },
): boolean {
  return (
    minutesFromTime(left.startTime) < minutesFromTime(right.endTime) &&
    minutesFromTime(right.startTime) < minutesFromTime(left.endTime)
  )
}

/**
 * Returns the first occurrence of `candidate` that already exists in `existing`.
 * A clash counts as a duplicate only when the names match, so two different
 * courses sharing a time slot are still allowed.
 */
export function findDuplicateOccurrence(
  candidate: ScheduleSeries,
  existing: ScheduleSeries[],
): DuplicateMatch | null {
  const candidateName = normalizeScheduleName(candidate.name)
  const sameNamed = existing.filter(
    (series) =>
      series.id !== candidate.id && normalizeScheduleName(series.name) === candidateName,
  )
  if (!sameNamed.length) return null

  const existingOccurrences = getOccurrences(sameNamed)

  for (const occurrence of occurrencesForSeries(candidate)) {
    const clash = existingOccurrences.find(
      (other) => other.date === occurrence.date && timesOverlap(occurrence, other),
    )
    if (clash) {
      return {
        name: clash.name,
        date: clash.date,
        startTime: clash.startTime,
        endTime: clash.endTime,
      }
    }
  }

  return null
}

export interface ReplacedSession {
  name: string
  date: string
  sessionNumber: number
}

export type ApplyStatus = 'added' | 'replaced' | 'duplicate'

export interface ApplyResult {
  series: ScheduleSeries[]
  status: ApplyStatus
  duplicate?: DuplicateMatch
  replaced?: ReplacedSession
}

/**
 * Adds `candidate` to `existing`, with two special rules:
 * - a GSLC stands in for the lecture session on the same date, so that lecture
 *   occurrence is cancelled and the GSLC inherits its session number;
 * - anything that already exists at the same name, date and time is rejected.
 */
export function applySeries(
  existing: ScheduleSeries[],
  candidate: ScheduleSeries,
): ApplyResult {
  if (candidate.type === 'GSLC') {
    const lectures = existing.filter(
      (series) =>
        series.type === 'LEC' &&
        normalizeScheduleName(series.name) === normalizeScheduleName(candidate.name),
    )
    const replacedOccurrence = getOccurrences(lectures).find(
      (occurrence) => occurrence.date === candidate.firstDate,
    )

    if (replacedOccurrence) {
      const updated = existing.map((series) =>
        series.id === replacedOccurrence.seriesId
          ? {
              ...series,
              excludedDates: Array.from(
                new Set([...series.excludedDates, replacedOccurrence.date]),
              ),
            }
          : series,
      )
      const gslc: ScheduleSeries = {
        ...candidate,
        startingSession: replacedOccurrence.sessionNumber,
      }
      const duplicate = findDuplicateOccurrence(gslc, updated)
      if (duplicate) return { series: existing, status: 'duplicate', duplicate }

      return {
        series: [...updated, gslc],
        status: 'replaced',
        replaced: {
          name: replacedOccurrence.name,
          date: replacedOccurrence.date,
          sessionNumber: replacedOccurrence.sessionNumber,
        },
      }
    }
  }

  const duplicate = findDuplicateOccurrence(candidate, existing)
  if (duplicate) return { series: existing, status: 'duplicate', duplicate }

  return { series: [...existing, candidate], status: 'added' }
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeFromMinutes(total: number): string {
  const bounded = Math.max(0, Math.min(total, 24 * 60 - 1))
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(
    bounded % 60,
  ).padStart(2, '0')}`
}

export function calculateFreeSlots(
  occurrences: ScheduleOccurrence[],
  dayStart: string,
  dayEnd: string,
  minimumMinutes: number,
): FreeSlot[] {
  const startBoundary = minutesFromTime(dayStart)
  const endBoundary = minutesFromTime(dayEnd)
  if (endBoundary <= startBoundary) return []

  const busy = occurrences
    .map((occurrence) => ({
      start: Math.max(startBoundary, minutesFromTime(occurrence.startTime)),
      end: Math.min(endBoundary, minutesFromTime(occurrence.endTime)),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start)

  const merged: Array<{ start: number; end: number }> = []
  for (const interval of busy) {
    const previous = merged.at(-1)
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }

  const free: FreeSlot[] = []
  let cursor = startBoundary
  for (const interval of merged) {
    if (interval.start - cursor >= minimumMinutes) {
      free.push({
        startTime: timeFromMinutes(cursor),
        endTime: timeFromMinutes(interval.start),
        minutes: interval.start - cursor,
      })
    }
    cursor = Math.max(cursor, interval.end)
  }

  if (endBoundary - cursor >= minimumMinutes) {
    free.push({
      startTime: timeFromMinutes(cursor),
      endTime: timeFromMinutes(endBoundary),
      minutes: endBoundary - cursor,
    })
  }

  return free
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseLocalDate(value))
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(parseLocalDate(value))
}

export function formatWeekday(value: string, narrow = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: narrow ? 'short' : 'long',
  }).format(parseLocalDate(value))
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder}m`
  if (!remainder) return `${hours}h`
  return `${hours}h ${remainder}m`
}
