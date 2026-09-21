import type { ClassType, FreeSlot, ScheduleEntry } from '../types'

export const TYPE_LABELS: Record<ClassType, string> = {
  LEC: 'Lecture',
  LAB: 'Lab',
  GSLC: 'GSLC',
  CUSTOM: 'Personal',
}

export const TYPE_BADGES: Record<ClassType, string> = {
  LEC: 'LEC',
  LAB: 'LAB',
  GSLC: 'GSLC',
  CUSTOM: 'PERSONAL',
}

/** Highest session label accepted; purely descriptive, nothing is generated. */
const MAX_SESSION_NUMBER = 40

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

export function normalizeSessionNumber(value: unknown): number | undefined {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return Math.min(parsed, MAX_SESSION_NUMBER)
}

export type RepeatOption = 'none' | 'daily' | 'weekly' | 'biweekly'

export const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
}

const REPEAT_INTERVALS: Record<RepeatOption, number> = {
  none: 0,
  daily: 1,
  weekly: 7,
  biweekly: 14,
}

/** Hard ceiling so one save can never create an unbounded pile of entries. */
export const MAX_REPEAT_DATES = 60

/**
 * Expands a chosen repeat into the list of dates to create. Each date becomes its
 * own independent entry, so nothing repeats behind your back afterwards.
 */
export function repeatDates(
  startDate: string,
  repeat: RepeatOption,
  untilDate?: string,
): string[] {
  const interval = REPEAT_INTERVALS[repeat]
  if (!interval) return [startDate]

  const lastDate = untilDate && untilDate >= startDate ? untilDate : startDate
  const dates: string[] = []
  let date = startDate
  while (date <= lastDate && dates.length < MAX_REPEAT_DATES) {
    dates.push(date)
    date = addDays(date, interval)
  }
  return dates
}

export function defaultRepeatUntil(startDate: string, repeat: RepeatOption): string {
  if (repeat === 'daily') return addDays(startDate, 6)
  if (repeat === 'biweekly') return addDays(startDate, 70)
  return addDays(startDate, 35)
}

export interface EntryInput {
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  sessionNumber?: number
}

export function createEntry(input: EntryInput): ScheduleEntry {
  const sessionNumber =
    input.type === 'CUSTOM' ? undefined : normalizeSessionNumber(input.sessionNumber)

  return {
    id: makeId(),
    name: input.name,
    type: input.type,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    createdAt: new Date().toISOString(),
    ...(sessionNumber ? { sessionNumber } : {}),
  }
}

/** Loose name comparison so OCR spacing and casing differences still match. */
export function normalizeScheduleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getEntries(
  entries: ScheduleEntry[],
  rangeStart?: string,
  rangeEnd?: string,
): ScheduleEntry[] {
  return entries
    .filter((entry) => !rangeStart || entry.date >= rangeStart)
    .filter((entry) => !rangeEnd || entry.date <= rangeEnd)
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

function timesOverlap(
  left: { startTime: string; endTime: string },
  right: { startTime: string; endTime: string },
): boolean {
  return (
    minutesFromTime(left.startTime) < minutesFromTime(right.endTime) &&
    minutesFromTime(right.startTime) < minutesFromTime(left.endTime)
  )
}

export interface DuplicateMatch {
  name: string
  date: string
  startTime: string
  endTime: string
}

/**
 * Finds an entry that already covers the same class at the same time on the same
 * date. Two different courses sharing a slot are still allowed.
 */
export function findDuplicateEntry(
  candidate: ScheduleEntry,
  existing: ScheduleEntry[],
): DuplicateMatch | null {
  const candidateName = normalizeScheduleName(candidate.name)
  const clash = existing.find(
    (entry) =>
      entry.id !== candidate.id &&
      entry.date === candidate.date &&
      normalizeScheduleName(entry.name) === candidateName &&
      timesOverlap(entry, candidate),
  )

  return clash
    ? {
        name: clash.name,
        date: clash.date,
        startTime: clash.startTime,
        endTime: clash.endTime,
      }
    : null
}

export interface ReplacedEntry {
  name: string
  date: string
  sessionNumber?: number
}

export type ApplyStatus = 'added' | 'replaced' | 'duplicate'

export interface ApplyResult {
  entries: ScheduleEntry[]
  status: ApplyStatus
  duplicate?: DuplicateMatch
  replaced?: ReplacedEntry
}

/**
 * Adds `candidate` to `existing`. A GSLC stands in for the lecture of the same
 * mata kuliah on that date, so that lecture entry is removed and the GSLC keeps
 * its session label. Anything else already saved at the same name, date and time
 * is rejected.
 */
export function applyEntry(
  existing: ScheduleEntry[],
  candidate: ScheduleEntry,
): ApplyResult {
  if (candidate.type === 'GSLC') {
    const lecture = existing.find(
      (entry) =>
        entry.type === 'LEC' &&
        entry.date === candidate.date &&
        normalizeScheduleName(entry.name) === normalizeScheduleName(candidate.name),
    )

    if (lecture) {
      const withoutLecture = existing.filter((entry) => entry.id !== lecture.id)
      const gslc: ScheduleEntry = {
        ...candidate,
        sessionNumber: candidate.sessionNumber ?? lecture.sessionNumber,
      }
      const duplicate = findDuplicateEntry(gslc, withoutLecture)
      if (duplicate) return { entries: existing, status: 'duplicate', duplicate }

      return {
        entries: [...withoutLecture, gslc],
        status: 'replaced',
        replaced: {
          name: lecture.name,
          date: lecture.date,
          sessionNumber: lecture.sessionNumber,
        },
      }
    }
  }

  const duplicate = findDuplicateEntry(candidate, existing)
  if (duplicate) return { entries: existing, status: 'duplicate', duplicate }

  return { entries: [...existing, candidate], status: 'added' }
}

export function calculateFreeSlots(
  entries: ScheduleEntry[],
  dayStart: string,
  dayEnd: string,
  minimumMinutes: number,
): FreeSlot[] {
  const startBoundary = minutesFromTime(dayStart)
  const endBoundary = minutesFromTime(dayEnd)
  if (endBoundary <= startBoundary) return []

  const busy = entries
    .map((entry) => ({
      start: Math.max(startBoundary, minutesFromTime(entry.startTime)),
      end: Math.min(endBoundary, minutesFromTime(entry.endTime)),
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

/** Compact column heading used by the week grid, e.g. 09/14. */
export function formatMonthDay(value: string): string {
  const date = parseLocalDate(value)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
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

export function describeEntry(entry: ScheduleEntry): string {
  if (entry.type === 'CUSTOM') return TYPE_LABELS.CUSTOM
  if (entry.sessionNumber) return `${TYPE_LABELS[entry.type]} · Session ${entry.sessionNumber}`
  return TYPE_LABELS[entry.type]
}
