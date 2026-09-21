import type { ClassType, ScheduleEntry } from '../types'

/**
 * A shared week travels entirely inside the URL — there is no server — so the
 * payload is kept small: only the fields a viewer needs, packed positionally and
 * base64url-encoded.
 */
interface SharePayload {
  v: 1
  title: string
  weekStart: string
  entries: Array<[string, number, string, string, string, number]>
}

const TYPE_CODES: ClassType[] = ['LEC', 'LAB', 'GSLC', 'CUSTOM']

export interface SharedWeek {
  title: string
  weekStart: string
  entries: ScheduleEntry[]
}

function toBase64Url(text: string): string {
  const base64 = btoa(unescape(encodeURIComponent(text)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  return decodeURIComponent(escape(atob(base64)))
}

export function encodeSharedWeek(
  entries: ScheduleEntry[],
  weekStart: string,
  title: string,
): string {
  const payload: SharePayload = {
    v: 1,
    title: title.slice(0, 80),
    weekStart,
    entries: entries.map((entry) => [
      entry.name,
      TYPE_CODES.indexOf(entry.type),
      entry.date,
      entry.startTime,
      entry.endTime,
      entry.sessionNumber ?? 0,
    ]),
  }
  return toBase64Url(JSON.stringify(payload))
}

export function decodeSharedWeek(encoded: string): SharedWeek | null {
  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as SharePayload
    if (payload.v !== 1 || !Array.isArray(payload.entries)) return null

    const entries: ScheduleEntry[] = payload.entries.flatMap((row, index) => {
      const [name, typeCode, date, startTime, endTime, session] = row
      const type = TYPE_CODES[typeCode]
      if (!type || !name || !date || !startTime || !endTime) return []
      return [
        {
          id: `shared-${index}`,
          name,
          type,
          date,
          startTime,
          endTime,
          createdAt: '',
          ...(type !== 'CUSTOM' && session ? { sessionNumber: session } : {}),
        },
      ]
    })

    return {
      title: typeof payload.title === 'string' ? payload.title : 'Shared week',
      weekStart: payload.weekStart,
      entries,
    }
  } catch {
    return null
  }
}

export function buildShareUrl(encoded: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/share?w=${encoded}`
}

export function readSharedWeekFromHash(): SharedWeek | null {
  const hash = window.location.hash
  if (!hash.startsWith('#/share')) return null
  const query = hash.slice(hash.indexOf('?') + 1)
  const encoded = new URLSearchParams(query).get('w')
  return encoded ? decodeSharedWeek(encoded) : null
}
