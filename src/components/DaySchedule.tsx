import { formatDuration } from '../lib/schedule'
import type { FreeSlot, ScheduleOccurrence } from '../types'

interface DayScheduleProps {
  occurrences: ScheduleOccurrence[]
  freeSlots: FreeSlot[]
  onDelete: (occurrence: ScheduleOccurrence) => void
}

const TYPE_LABEL: Record<ScheduleOccurrence['type'], string> = {
  LEC: 'Lecture',
  LAB: 'Lab',
  GSLC: 'GSLC',
  CUSTOM: 'Personal',
}

const TYPE_BADGE: Record<ScheduleOccurrence['type'], string> = {
  LEC: 'LEC',
  LAB: 'LAB',
  GSLC: 'GSLC',
  CUSTOM: 'PERSONAL',
}

function describeOccurrence(occurrence: ScheduleOccurrence): string {
  if (occurrence.type === 'CUSTOM') {
    return occurrence.isRecurring ? 'Repeating' : 'One time'
  }
  if (occurrence.type === 'GSLC') return `Replaces Session ${occurrence.sessionNumber}`
  return `${TYPE_LABEL[occurrence.type]} · Session ${occurrence.sessionNumber}`
}

export function DaySchedule({ occurrences, freeSlots, onDelete }: DayScheduleProps) {
  return (
    <div className="day-content">
      <section className="panel" aria-labelledby="schedule-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Timetable</p>
            <h2 id="schedule-heading">Your schedule</h2>
          </div>
          <span className="count-pill">{occurrences.length}</span>
        </div>

        {occurrences.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">✦</span>
            <h3>Your day is clear</h3>
            <p>Add a schedule or import a campus screenshot.</p>
          </div>
        ) : (
          <div className="schedule-list">
            {occurrences.map((occurrence) => (
              <article className={`schedule-card schedule-card--${occurrence.type.toLowerCase()}`} key={occurrence.id}>
                <div className="schedule-time" aria-label={`${occurrence.startTime} to ${occurrence.endTime}`}>
                  <strong>{occurrence.startTime}</strong>
                  <span>{occurrence.endTime}</span>
                </div>
                <div className="schedule-detail">
                  <h3>{occurrence.name}</h3>
                  <p>
                    <span className="type-badge">{TYPE_BADGE[occurrence.type]}</span>
                    {describeOccurrence(occurrence)}
                  </p>
                </div>
                <button
                  className="more-button"
                  type="button"
                  onClick={() => onDelete(occurrence)}
                  aria-label={`Remove ${occurrence.name}`}
                >
                  <span aria-hidden="true">•••</span>
                </button>
              </article>
            ))}
          </div>
        )}

        {occurrences.length > 0 && (
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
