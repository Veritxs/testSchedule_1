export type ClassType = 'LEC' | 'LAB' | 'GSLC' | 'CUSTOM'

/** Repeat options available to personal ("Custom") schedules only. */
export type CustomRepeat = 'once' | 'daily' | 'weekly' | 'biweekly'

export interface ScheduleSeries {
  id: string
  name: string
  type: ClassType
  firstDate: string
  startTime: string
  endTime: string
  startingSession: number
  excludedDates: string[]
  createdAt: string
  /** Only used when `type` is `CUSTOM`. */
  repeat?: CustomRepeat
  /** Last date a repeating custom schedule may occur on. */
  endDate?: string
}

export interface ScheduleOccurrence {
  id: string
  seriesId: string
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  sessionNumber: number
  /** True when the parent series produces more than one occurrence. */
  isRecurring: boolean
}

export interface ImportDraft {
  id: string
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  startingSession: number
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
