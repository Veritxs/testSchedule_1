import {
  DEFAULT_PREFERENCES,
  type ScheduleSeries,
  type UserPreferences,
} from '../types'

const SCHEDULES_KEY = 'waktuku:schedules:v1'
const PREFERENCES_KEY = 'waktuku:preferences:v1'

export function loadSchedules(): ScheduleSeries[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SCHEDULES_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is ScheduleSeries =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'name' in item &&
        'type' in item &&
        'firstDate' in item &&
        'startTime' in item &&
        'endTime' in item,
    )
  } catch {
    return []
  }
}

export function saveSchedules(schedules: ScheduleSeries[]): void {
  localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules))
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
