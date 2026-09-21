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

export function totalSessionsFor(type: ClassType): number {
  return TYPE_RULES[type].totalSessions
}

export function normalizeStartingSession(type: ClassType, session: number): number {
  if (type === 'GSLC' || type === 'CUSTOM') return 1
  return Math.min(Math.max(Math.round(session) || 1, 1), totalSessionsFor(type))
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

/** Dates for an academic class, driven by its fixed cadence and session count. */
function academicSeriesDates(series: ScheduleSeries): string[] {
  const rule = TYPE_RULES[series.type]
  const firstSession = normalizeStartingSession(series.type, series.startingSession)
  const count = rule.totalSessions - firstSession + 1
  return Array.from({ length: count }, (_, index) =>
    addDays(series.firstDate, index * rule.intervalDays),
  )
}

export function occurrencesForSeries(series: ScheduleSeries): ScheduleOccurrence[] {
  const dates =
    series.type === 'CUSTOM' ? customSeriesDates(series) : academicSeriesDates(series)
  const firstSession = normalizeStartingSession(series.type, series.startingSession)
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
      sessionNumber: firstSession + index,
      isRecurring,
    }))
    .filter((occurrence) => !series.excludedDates.includes(occurrence.date))
}

export function getOccurrences(
  series: ScheduleSeries[],
  rangeStart?: string,
  rangeEnd?: string,
): ScheduleOccurrence[] {
  return series
    .flatMap(occurrencesForSeries)
    .filter((occurrence) => !rangeStart || occurrence.date >= rangeStart)
    .filter((occurrence) => !rangeEnd || occurrence.date <= rangeEnd)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startTime.localeCompare(right.startTime) ||
        left.name.localeCompare(right.name),
    )
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
