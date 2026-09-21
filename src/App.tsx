import { useEffect, useMemo, useState } from 'react'
import { DaySchedule } from './components/DaySchedule'
import { Modal } from './components/Modal'
import { ScheduleForm, type ScheduleFormValues } from './components/ScheduleForm'
import { ScreenshotImport, type ImportOutcome } from './components/ScreenshotImport'
import { SettingsForm } from './components/SettingsForm'
import { WeekGrid } from './components/WeekGrid'
import { ExportSheet } from './components/ExportSheet'
import { SharedWeekView } from './components/SharedWeekView'
import { readSharedWeekFromHash } from './lib/share'
import {
  addDays,
  applyEntry,
  calculateFreeSlots,
  createEntry,
  formatLongDate,
  formatShortDate,
  formatWeekday,
  getEntries,
  getTodayString,
  getWeekDays,
  parseLocalDate,
  startOfWeek,
} from './lib/schedule'
import {
  loadEntries,
  loadPreferences,
  saveEntries,
  savePreferences,
} from './lib/storage'
import type { ImportDraft, ScheduleEntry } from './types'

type ViewMode = 'today' | 'week' | 'grid'
type OpenModal = 'add' | 'import' | 'settings' | 'removeAll' | 'export' | null

function App() {
  const sharedWeek = useMemo(() => readSharedWeekFromHash(), [])
  if (sharedWeek) return <SharedWeekView shared={sharedWeek} />
  return <MainApp />
}

function MainApp() {
  const today = getTodayString()
  const [entries, setEntries] = useState<ScheduleEntry[]>(loadEntries)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [view, setView] = useState<ViewMode>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEntry | null>(null)
  const [addError, setAddError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => saveEntries(entries), [entries])
  useEffect(() => savePreferences(preferences), [preferences])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const weekStart = startOfWeek(selectedDate)
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekEnd = weekDays[6]
  const weekEntries = useMemo(
    () => getEntries(entries, weekStart, weekEnd),
    [entries, weekEnd, weekStart],
  )
  const dayEntries = useMemo(
    () => getEntries(entries, selectedDate, selectedDate),
    [entries, selectedDate],
  )
  const freeSlots = useMemo(
    () =>
      calculateFreeSlots(
        dayEntries,
        preferences.dayStart,
        preferences.dayEnd,
        preferences.minimumFreeMinutes,
      ),
    [dayEntries, preferences],
  )

  function showToday() {
    setView('today')
    setSelectedDate(today)
  }

  function showWeek() {
    setView('week')
    if (view === 'today') setSelectedDate(today)
  }

  function showGrid() {
    setView('grid')
    if (view === 'today') setSelectedDate(today)
  }

  function moveDate(direction: -1 | 1) {
    setSelectedDate((current) =>
      addDays(current, direction * (view === 'today' ? 1 : 7)),
    )
  }

  function addSchedule(values: ScheduleFormValues) {
    const targetDates = values.dates.length ? values.dates : [values.date]
    let working = entries
    let added = 0
    let replaced = 0
    const skippedDates: string[] = []

    for (const date of targetDates) {
      const result = applyEntry(working, createEntry({ ...values, date }))
      if (result.status === 'duplicate') {
        skippedDates.push(date)
        continue
      }
      working = result.entries
      if (result.status === 'replaced') replaced += 1
      else added += 1
    }

    if (!added && !replaced) {
      setAddError(
        targetDates.length === 1
          ? `“${values.name}” is already saved on ${formatLongDate(values.date)} at ${values.startTime}–${values.endTime}, so nothing was added.`
          : `Every one of those ${targetDates.length} dates already has “${values.name}” at ${values.startTime}–${values.endTime}, so nothing was added.`,
      )
      return
    }

    setAddError('')
    setEntries(working)
    setSelectedDate(values.date)
    setOpenModal(null)

    const parts: string[] = []
    if (added) parts.push(`${added} date${added === 1 ? '' : 's'} added`)
    if (replaced) parts.push(`${replaced} replaced a lecture`)
    if (skippedDates.length) parts.push(`${skippedDates.length} already existed`)
    setToast(`${values.name}: ${parts.join(' · ')}`)
  }

  function importSchedules(drafts: ImportDraft[]): ImportOutcome {
    let working = entries
    let importedCount = 0
    let replacedCount = 0
    const skipped: Array<{ name: string; date: string }> = []
    let firstDate = ''

    for (const draft of drafts) {
      const result = applyEntry(working, createEntry(draft))
      if (result.status === 'duplicate' && result.duplicate) {
        skipped.push({ name: result.duplicate.name, date: result.duplicate.date })
        continue
      }

      working = result.entries
      if (result.status === 'replaced') replacedCount += 1
      else importedCount += 1
      if (!firstDate) firstDate = draft.date
    }

    if (!importedCount && !replacedCount) return { importedCount: 0, replacedCount: 0, skipped }

    setEntries(working)
    setSelectedDate(firstDate)
    setOpenModal(null)

    const parts: string[] = []
    if (importedCount) parts.push(`${importedCount} imported`)
    if (replacedCount) parts.push(`${replacedCount} replaced a lecture`)
    if (skipped.length) parts.push(`${skipped.length} already existed`)
    setToast(parts.join(' · '))

    return { importedCount, replacedCount, skipped }
  }

  function removeEntry() {
    if (!deleteTarget) return
    setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id))
    setToast(`${deleteTarget.name} removed`)
    setDeleteTarget(null)
  }

  function removeAllSchedules() {
    const removedCount = entries.length
    setEntries([])
    setDeleteTarget(null)
    setOpenModal(null)
    setToast(`All ${removedCount} schedule${removedCount === 1 ? '' : 's'} removed`)
  }

  const weekRangeLabel = `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <div>
            <strong>WaktuKu</strong>
            <span>My campus rhythm</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="avatar-button" type="button" onClick={() => setOpenModal('export')} aria-label="Share this week">
            <span aria-hidden="true">↗</span>
          </button>
          <button className="avatar-button" type="button" onClick={() => setOpenModal('settings')} aria-label="Open settings">
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <main className={`main-content${view === 'grid' ? ' main-content--grid' : ''}`}>
        <section className="hero">
          <div className="view-switcher view-switcher--triple" aria-label="Timetable view">
            <button className={view === 'today' ? 'is-active' : ''} type="button" onClick={showToday}>Today</button>
            <button className={view === 'week' ? 'is-active' : ''} type="button" onClick={showWeek}>Week</button>
            <button className={view === 'grid' ? 'is-active' : ''} type="button" onClick={showGrid}>Grid</button>
          </div>

          <div className="date-navigation">
            <button className="round-button" type="button" onClick={() => moveDate(-1)} aria-label={view === 'today' ? 'Previous day' : 'Previous week'}>‹</button>
            <div>
              <p>{selectedDate === today ? 'Today' : formatWeekday(selectedDate)}</p>
              <h1>{view === 'today' ? formatLongDate(selectedDate) : weekRangeLabel}</h1>
            </div>
            <button className="round-button" type="button" onClick={() => moveDate(1)} aria-label={view === 'today' ? 'Next day' : 'Next week'}>›</button>
          </div>

          {view === 'week' && (
            <div className="week-strip" aria-label="Choose a day">
              {weekDays.map((date) => {
                const count = weekEntries.filter((item) => item.date === date).length
                const isSelected = date === selectedDate
                return (
                  <button className={isSelected ? 'is-selected' : ''} type="button" key={date} onClick={() => setSelectedDate(date)}>
                    <span>{formatWeekday(date, true)}</span>
                    <strong>{parseLocalDate(date).getDate()}</strong>
                    <i className={count ? 'has-events' : ''} aria-label={`${count} schedules`} />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* The grid needs every pixel it can get for 7 day columns. */}
        {view === 'grid' ? (
          <WeekGrid
            weekDays={weekDays}
            entries={weekEntries}
            dayStart={preferences.dayStart}
            dayEnd={preferences.dayEnd}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date)
              setView('today')
            }}
            onSelectEntry={setDeleteTarget}
          />
        ) : (
          <DaySchedule entries={dayEntries} freeSlots={freeSlots} onDelete={setDeleteTarget} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`nav-item${view !== 'grid' ? ' is-active' : ''}`} type="button" onClick={showToday}>
          <span aria-hidden="true">▦</span>
          <small>Schedule</small>
        </button>
        <button className="nav-item" type="button" onClick={() => setOpenModal('import')}>
          <span aria-hidden="true">▣</span>
          <small>Import</small>
        </button>
        <button
          className="add-button"
          type="button"
          onClick={() => {
            setAddError('')
            setOpenModal('add')
          }}
          aria-label="Add a schedule"
        >
          <span aria-hidden="true">＋</span>
        </button>
        <button className={`nav-item${view === 'grid' ? ' is-active' : ''}`} type="button" onClick={showGrid}>
          <span aria-hidden="true">▤</span>
          <small>Grid</small>
        </button>
        <button className="nav-item" type="button" onClick={() => setOpenModal('settings')}>
          <span aria-hidden="true">⚙</span>
          <small>Settings</small>
        </button>
      </nav>

      {openModal === 'add' && (
        <Modal title="Add schedule" onClose={() => setOpenModal(null)}>
          <ScheduleForm
            initial={{ date: selectedDate }}
            externalError={addError}
            onSave={addSchedule}
            onCancel={() => setOpenModal(null)}
          />
        </Modal>
      )}

      {openModal === 'import' && (
        <Modal title="Import screenshot" onClose={() => setOpenModal(null)} wide>
          <ScreenshotImport
            onImport={importSchedules}
            onCancel={() => setOpenModal(null)}
          />
        </Modal>
      )}

      {openModal === 'export' && (
        <Modal title="Share this week" onClose={() => setOpenModal(null)}>
          <ExportSheet
            entries={weekEntries}
            weekDays={weekDays}
            weekStart={weekStart}
            weekLabel={weekRangeLabel}
            dayStart={preferences.dayStart}
            dayEnd={preferences.dayEnd}
            onClose={() => setOpenModal(null)}
          />
        </Modal>
      )}

      {openModal === 'settings' && (
        <Modal title="Free-time settings" onClose={() => setOpenModal(null)}>
          <SettingsForm
            preferences={preferences}
            scheduleCount={entries.length}
            onRequestRemoveAll={() => setOpenModal('removeAll')}
            onCancel={() => setOpenModal(null)}
            onSave={(next) => {
              setPreferences(next)
              setOpenModal(null)
              setToast('Settings saved')
            }}
          />
        </Modal>
      )}

      {openModal === 'removeAll' && (
        <Modal title="Remove all schedules" onClose={() => setOpenModal(null)}>
          <div className="delete-sheet">
            <div className="remove-all-warning">
              <span aria-hidden="true">⚠</span>
              <p>
                <strong>This cannot be undone</strong>
                All {entries.length} saved schedule{entries.length === 1 ? '' : 's'} will be
                deleted. Your settings and campus screenshots are kept.
              </p>
            </div>
            <button className="delete-option delete-option--danger" type="button" onClick={removeAllSchedules}>
              <strong>Yes, remove everything</strong>
              <span>Start again with an empty timetable</span>
            </button>
            <button className="button button--ghost button--full" type="button" onClick={() => setOpenModal('settings')}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Remove schedule" onClose={() => setDeleteTarget(null)}>
          <div className="delete-sheet">
            <div className="delete-summary">
              <span className={`type-dot type-dot--${deleteTarget.type.toLowerCase()}`} />
              <div>
                <strong>{deleteTarget.name}</strong>
                <span>{formatLongDate(deleteTarget.date)} · {deleteTarget.startTime}–{deleteTarget.endTime}</span>
              </div>
            </div>
            <button className="delete-option delete-option--danger" type="button" onClick={removeEntry}>
              <strong>Remove this schedule</strong>
              <span>Only this date is affected</span>
            </button>
            <button className="button button--ghost button--full" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  )
}

export default App
