import { DEFAULT_PREFERENCES, type ScheduleEntry, type UserPreferences } from '../types'
import { makeId, normalizeSessionNumber } from './schedule'

const ENTRIES_KEY = 'waktuku:entries:v2'
const LEGACY_SCHEDULES_KEY = 'waktuku:schedules:v1'
const PREFERENCES_KEY = 'waktuku:preferences:v1'

function isEntryLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toEntry(value: Record<string, unknown>): ScheduleEntry | null {
  const name = typeof value.name === 'string' ? value.name : ''
  const date = typeof value.date === 'string' ? value.date : ''
  const startTime = typeof value.startTime === 'string' ? value.startTime : ''
  const endTime = typeof value.endTime === 'string' ? value.endTime : ''
  const type = value.type
  if (!name || !date || !startTime || !endTime) return null
  if (type !== 'LEC' && type !== 'LAB' && type !== 'GSLC' && type !== 'CUSTOM') return null

  const sessionNumber = normalizeSessionNumber(value.sessionNumber)

  return {
    id: typeof value.id === 'string' ? value.id : makeId(),
    name,
    type,
    date,
    startTime,
    endTime,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    ...(type !== 'CUSTOM' && sessionNumber ? { sessionNumber } : {}),
  }
}

/**
 * Older versions generated repeating occurrences from a single record. Those
 * records are kept as one entry on their original date, since schedules no
 * longer repeat automatically.
 */
function migrateLegacySchedules(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_SCHEDULES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      if (!isEntryLike(item)) return []
      const entry = toEntry({
        ...item,
        date: item.firstDate ?? item.date,
        sessionNumber: item.sessionNumber ?? item.startingSession,
      })
      return entry ? [entry] : []
    })
  } catch {
    return []
  }
}

export function loadEntries(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    if (raw === null) {
      const migrated = migrateLegacySchedules()
      if (migrated.length) saveEntries(migrated)
      return migrated
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!isEntryLike(item)) return []
      const entry = toEntry(item)
      return entry ? [entry] : []
    })
  } catch {
    return []
  }
}

export function saveEntries(entries: ScheduleEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

export function loadPreferences(): UserPreferences {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) ?? '{}',
    ) as Partial<UserPreferences>
    return { ...DEFAULT_PREFERENCES, ...saved }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: UserPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}
