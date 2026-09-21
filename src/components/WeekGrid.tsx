import { useMemo } from 'react'
import {
  formatWeekday,
  minutesFromTime,
  parseLocalDate,
  timeFromMinutes,
} from '../lib/schedule'
import type { ScheduleEntry } from '../types'

interface WeekGridProps {
  weekDays: string[]
  entries: ScheduleEntry[]
  dayStart: string
  dayEnd: string
  today: string
  selectedDate: string
  onSelectDate: (date: string) => void
  onSelectEntry: (entry: ScheduleEntry) => void
}

const PIXELS_PER_MINUTE = 0.85

/** Lays out one entry, splitting the column when classes overlap in time. */
function layoutColumn(entries: ScheduleEntry[]) {
  const sorted = [...entries].sort(
    (left, right) => minutesFromTime(left.startTime) - minutesFromTime(right.startTime),
  )
  const columns: ScheduleEntry[][] = []

  for (const entry of sorted) {
    const start = minutesFromTime(entry.startTime)
    const column = columns.find(
      (items) => minutesFromTime(items[items.length - 1].endTime) <= start,
    )
    if (column) column.push(entry)
    else columns.push([entry])
  }

  return sorted.map((entry) => {
    const columnIndex = columns.findIndex((items) => items.includes(entry))
    return { entry, columnIndex, columnCount: columns.length }
  })
}

export function WeekGrid({
  weekDays,
  entries,
  dayStart,
  dayEnd,
  today,
  selectedDate,
  onSelectDate,
  onSelectEntry,
}: WeekGridProps) {
  const startMinutes = Math.min(
    minutesFromTime(dayStart),
    ...entries.map((entry) => minutesFromTime(entry.startTime)),
  )
  const endMinutes = Math.max(
    minutesFromTime(dayEnd),
    ...entries.map((entry) => minutesFromTime(entry.endTime)),
  )
  const firstHour = Math.floor(startMinutes / 60)
  const lastHour = Math.ceil(endMinutes / 60)
  const gridTop = firstHour * 60
  const gridHeight = (lastHour * 60 - gridTop) * PIXELS_PER_MINUTE

  const hours = useMemo(
    () => Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index),
    [firstHour, lastHour],
  )

  const byDay = useMemo(
    () =>
      weekDays.map((date) => ({
        date,
        items: layoutColumn(entries.filter((entry) => entry.date === date)),
      })),
    [entries, weekDays],
  )

  return (
    <section className="panel grid-panel" aria-labelledby="grid-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2 id="grid-heading">Week grid</h2>
        </div>
        <span className="count-pill">{entries.length}</span>
      </div>

      <div className="week-grid-scroll">
        <div className="week-grid" style={{ height: `${gridHeight + 44}px` }}>
          <div className="week-grid__corner" />
          {byDay.map(({ date, items }) => (
            <button
              className={`week-grid__head${date === selectedDate ? ' is-selected' : ''}${date === today ? ' is-today' : ''}`}
              key={`head-${date}`}
              type="button"
              onClick={() => onSelectDate(date)}
            >
              <span>{formatWeekday(date, true)}</span>
              <strong>{parseLocalDate(date).getDate()}</strong>
              {items.length > 0 && <i aria-hidden="true" />}
            </button>
          ))}

          <div className="week-grid__times" style={{ height: `${gridHeight}px` }}>
            {hours.map((hour) => (
              <span
                className="week-grid__time"
                key={hour}
                style={{ top: `${(hour * 60 - gridTop) * PIXELS_PER_MINUTE}px` }}
              >
                {timeFromMinutes(hour * 60)}
              </span>
            ))}
          </div>

          {byDay.map(({ date, items }) => (
            <div
              className={`week-grid__day${date === today ? ' is-today' : ''}`}
              key={`day-${date}`}
              style={{ height: `${gridHeight}px` }}
            >
              {hours.map((hour) => (
                <div
                  className="week-grid__line"
                  key={hour}
                  style={{ top: `${(hour * 60 - gridTop) * PIXELS_PER_MINUTE}px` }}
                />
              ))}

              {items.map(({ entry, columnIndex, columnCount }) => {
                const top = (minutesFromTime(entry.startTime) - gridTop) * PIXELS_PER_MINUTE
                const height = Math.max(
                  (minutesFromTime(entry.endTime) - minutesFromTime(entry.startTime)) *
                    PIXELS_PER_MINUTE,
                  26,
                )
                return (
                  <button
                    className={`week-grid__event week-grid__event--${entry.type.toLowerCase()}${height < 44 ? ' week-grid__event--short' : ''}`}
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectEntry(entry)}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `${(columnIndex / columnCount) * 100}%`,
                      width: `${100 / columnCount}%`,
                    }}
                    title={`${entry.name} · ${entry.startTime}–${entry.endTime}`}
                  >
                    <strong>{entry.name}</strong>
                    <span>{entry.startTime}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="legend">
        <span><i className="lec" />LEC</span>
        <span><i className="lab" />LAB</span>
        <span><i className="gslc" />GSLC</span>
        <span><i className="custom" />Personal</span>
      </div>
      <p className="grid-hint">Scroll sideways for the rest of the week. Tap a block to remove it.</p>
    </section>
  )
}
