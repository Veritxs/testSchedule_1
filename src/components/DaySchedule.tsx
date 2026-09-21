import { describeEntry, formatDuration, TYPE_BADGES } from '../lib/schedule'
import type { FreeSlot, ScheduleEntry } from '../types'

interface DayScheduleProps {
  entries: ScheduleEntry[]
  freeSlots: FreeSlot[]
  onDelete: (entry: ScheduleEntry) => void
}

export function DaySchedule({ entries, freeSlots, onDelete }: DayScheduleProps) {
  return (
    <div className="day-content">
      <section className="panel" aria-labelledby="schedule-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Timetable</p>
            <h2 id="schedule-heading">Your schedule</h2>
          </div>
          <span className="count-pill">{entries.length}</span>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">✦</span>
            <h3>Your day is clear</h3>
            <p>Add a schedule or import a campus screenshot.</p>
          </div>
        ) : (
          <div className="schedule-list">
            {entries.map((entry) => (
              <article className={`schedule-card schedule-card--${entry.type.toLowerCase()}`} key={entry.id}>
                <div className="schedule-time" aria-label={`${entry.startTime} to ${entry.endTime}`}>
                  <strong>{entry.startTime}</strong>
                  <span>{entry.endTime}</span>
                </div>
                <div className="schedule-detail">
                  <h3>{entry.name}</h3>
                  <p>
                    <span className="type-badge">{TYPE_BADGES[entry.type]}</span>
                    {describeEntry(entry)}
                  </p>
                </div>
                <button
                  className="more-button"
                  type="button"
                  onClick={() => onDelete(entry)}
                  aria-label={`Remove ${entry.name}`}
                >
                  <span aria-hidden="true">•••</span>
                </button>
              </article>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="legend">
            <span><i className="lec" />LEC</span>
            <span><i className="lab" />LAB</span>
            <span><i className="gslc" />GSLC</span>
            <span><i className="custom" />Personal</span>
          </div>
        )}
      </section>

      <section className="panel free-panel" aria-labelledby="free-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow eyebrow--green">Open space</p>
            <h2 id="free-heading">Free time</h2>
          </div>
        </div>
        {freeSlots.length === 0 ? (
          <p className="muted-message">No free blocks match your minimum duration.</p>
        ) : (
          <div className="free-list">
            {freeSlots.map((slot) => (
              <div className="free-card" key={`${slot.startTime}-${slot.endTime}`}>
                <span className="free-card__dot" />
                <strong>{slot.startTime}–{slot.endTime}</strong>
                <span>{formatDuration(slot.minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
