export type ClassType = 'LEC' | 'LAB' | 'GSLC' | 'CUSTOM'

/**
 * One schedule on one date. Nothing repeats: every class or personal activity is
 * saved only on the date it actually happens.
 */
export interface ScheduleEntry {
  id: string
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  /** Optional label taken from the campus screenshot, e.g. Session 7. */
  sessionNumber?: number
  createdAt: string
}

export interface ImportDraft {
  id: string
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  sessionNumber?: number
}

export interface FreeSlot {
  startTime: string
  endTime: string
  minutes: number
}

export interface UserPreferences {
  dayStart: string
  dayEnd: string
  minimumFreeMinutes: number
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dayStart: '08:00',
  dayEnd: '20:00',
  minimumFreeMinutes: 30,
}
