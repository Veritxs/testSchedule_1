import { WeekGrid } from './WeekGrid'
import { getEntries, getWeekDays, startOfWeek } from '../lib/schedule'
import type { SharedWeek } from '../lib/share'

interface SharedWeekViewProps {
  shared: SharedWeek
}

const APP_BASE = import.meta.env.BASE_URL

/** Read-only page opened from a share link. No editing, no local data touched. */
export function SharedWeekView({ shared }: SharedWeekViewProps) {
  const weekStart = shared.weekStart || startOfWeek(shared.entries[0]?.date ?? '2026-01-01')
  const weekDays = getWeekDays(weekStart)
  const weekEntries = getEntries(shared.entries, weekDays[0], weekDays[6])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <div>
            <strong>{shared.title || 'Shared week'}</strong>
            <span>Shared timetable · view only</span>
          </div>
        </div>
      </header>

      <main className="main-content main-content--grid">
        <section className="hero hero--shared">
          <p className="shared-note">
            Someone shared their week so you can find a time to study together. Nothing here is
            saved to your device.
          </p>
        </section>

        {weekEntries.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true">✦</span>
              <h3>This shared week is empty</h3>
              <p>The link did not contain any classes.</p>
            </div>
          </section>
        ) : (
          <WeekGrid
            weekDays={weekDays}
            entries={weekEntries}
            dayStart="08:00"
            dayEnd="20:00"
            today=""
            selectedDate=""
            onSelectDate={() => {}}
            onSelectEntry={() => {}}
            readOnly
          />
        )}

        <a className="button button--primary button--full make-own" href={APP_BASE}>
          Make my own timetable
        </a>
      </main>
    </div>
  )
}
