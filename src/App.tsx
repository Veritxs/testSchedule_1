import { useEffect, useMemo, useState } from 'react'
import { DaySchedule } from './components/DaySchedule'
import { Modal } from './components/Modal'
import { ScheduleForm, type ScheduleFormValues } from './components/ScheduleForm'
import { ScreenshotImport } from './components/ScreenshotImport'
import { SettingsForm } from './components/SettingsForm'
import {
  addDays,
  calculateFreeSlots,
  formatLongDate,
  formatShortDate,
  formatWeekday,
  getOccurrences,
  getTodayString,
  getWeekDays,
  makeId,
  parseLocalDate,
  startOfWeek,
} from './lib/schedule'
import {
  loadPreferences,
  loadSchedules,
  savePreferences,
  saveSchedules,
} from './lib/storage'
import type { ImportDraft, ScheduleOccurrence, ScheduleSeries } from './types'

type ViewMode = 'today' | 'week'
type OpenModal = 'add' | 'import' | 'settings' | null

function App() {
  const today = getTodayString()
  const [series, setSeries] = useState<ScheduleSeries[]>(loadSchedules)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [view, setView] = useState<ViewMode>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleOccurrence | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => saveSchedules(series), [series])
  useEffect(() => savePreferences(preferences), [preferences])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const weekStart = startOfWeek(selectedDate)
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekEnd = weekDays[6]
  const weekOccurrences = useMemo(
    () => getOccurrences(series, weekStart, weekEnd),
    [series, weekEnd, weekStart],
  )
  const dayOccurrences = useMemo(
    () => getOccurrences(series, selectedDate, selectedDate),
    [selectedDate, series],
  )
  const freeSlots = useMemo(
    () =>
      calculateFreeSlots(
        dayOccurrences,
        preferences.dayStart,
        preferences.dayEnd,
        preferences.minimumFreeMinutes,
      ),
    [dayOccurrences, preferences],
  )

  function showToday() {
    setView('today')
    setSelectedDate(today)
  }

  function showWeek() {
    setView('week')
    if (view === 'today') setSelectedDate(today)
  }

  function moveDate(direction: -1 | 1) {
    setSelectedDate((current) => addDays(current, direction * (view === 'week' ? 7 : 1)))
  }

  function addSchedule(values: ScheduleFormValues) {
    const schedule: ScheduleSeries = {
      id: makeId(),
      name: values.name,
      type: values.type,
      firstDate: values.firstDate,
      startTime: values.startTime,
      endTime: values.endTime,
      startingSession: values.startingSession,
      excludedDates: [],
      createdAt: new Date().toISOString(),
    }
    setSeries((current) => [...current, schedule])
    setSelectedDate(values.firstDate)
    setOpenModal(null)
    setToast(`${values.name} added`)
  }

  function importSchedules(drafts: ImportDraft[]) {
    const imported: ScheduleSeries[] = drafts.map((draft) => ({
      id: makeId(),
      name: draft.name,
      type: draft.type,
      firstDate: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      startingSession: draft.startingSession,
      excludedDates: [],
      createdAt: new Date().toISOString(),
    }))
    setSeries((current) => [...current, ...imported])
    setSelectedDate(drafts[0].date)
    setOpenModal(null)
    setToast(`${drafts.length} class${drafts.length === 1 ? '' : 'es'} imported`)
  }

  function removeOccurrence() {
    if (!deleteTarget) return
    setSeries((current) =>
      current.map((schedule) =>
        schedule.id === deleteTarget.seriesId
          ? {
              ...schedule,
              excludedDates: Array.from(
                new Set([...schedule.excludedDates, deleteTarget.date]),
              ),
            }
          : schedule,
      ),
    )
    setToast('This occurrence was removed')
    setDeleteTarget(null)
  }

  function removeSeries() {
    if (!deleteTarget) return
    setSeries((current) =>
      current.filter((schedule) => schedule.id !== deleteTarget.seriesId),
    )
    setToast(`${deleteTarget.name} schedule removed`)
    setDeleteTarget(null)
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
        <button className="avatar-button" type="button" onClick={() => setOpenModal('settings')} aria-label="Open settings">
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="view-switcher" aria-label="Timetable view">
            <button className={view === 'today' ? 'is-active' : ''} type="button" onClick={showToday}>Today</button>
            <button className={view === 'week' ? 'is-active' : ''} type="button" onClick={showWeek}>Week</button>
          </div>

          <div className="date-navigation">
            <button className="round-button" type="button" onClick={() => moveDate(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous day'}>‹</button>
            <div>
              <p>{selectedDate === today ? 'Today' : formatWeekday(selectedDate)}</p>
              <h1>{view === 'week' ? weekRangeLabel : formatLongDate(selectedDate)}</h1>
            </div>
            <button className="round-button" type="button" onClick={() => moveDate(1)} aria-label={view === 'week' ? 'Next week' : 'Next day'}>›</button>
          </div>

          {view === 'week' && (
            <div className="week-strip" aria-label="Choose a day">
              {weekDays.map((date) => {
                const count = weekOccurrences.filter((item) => item.date === date).length
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

        <DaySchedule occurrences={dayOccurrences} freeSlots={freeSlots} onDelete={setDeleteTarget} />
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className="nav-item is-active" type="button" onClick={showToday}>
          <span aria-hidden="true">▦</span>
          <small>Schedule</small>
        </button>
        <button className="nav-item" type="button" onClick={() => setOpenModal('import')}>
          <span aria-hidden="true">▣</span>
          <small>Import</small>
        </button>
        <button className="add-button" type="button" onClick={() => setOpenModal('add')} aria-label="Add a schedule">
          <span aria-hidden="true">＋</span>
        </button>
        <button className="nav-item" type="button" onClick={showWeek}>
          <span aria-hidden="true">▤</span>
          <small>Week</small>
        </button>
        <button className="nav-item" type="button" onClick={() => setOpenModal('settings')}>
          <span aria-hidden="true">⚙</span>
          <small>Settings</small>
        </button>
      </nav>

      {openModal === 'add' && (
        <Modal title="Add schedule" onClose={() => setOpenModal(null)}>
          <ScheduleForm
            initial={{ firstDate: selectedDate }}
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

      {openModal === 'settings' && (
        <Modal title="Free-time settings" onClose={() => setOpenModal(null)}>
          <SettingsForm
            preferences={preferences}
            onCancel={() => setOpenModal(null)}
            onSave={(next) => {
              setPreferences(next)
              setOpenModal(null)
              setToast('Settings saved')
            }}
          />
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
            {deleteTarget.type !== 'GSLC' && (
              <button className="delete-option" type="button" onClick={removeOccurrence}>
                <strong>Remove this occurrence</strong>
                <span>Keep the rest of the recurring schedule</span>
              </button>
            )}
            <button className="delete-option delete-option--danger" type="button" onClick={removeSeries}>
              <strong>{deleteTarget.type === 'GSLC' ? 'Remove schedule' : 'Remove entire series'}</strong>
              <span>{deleteTarget.type === 'GSLC' ? 'Delete this one-time class' : 'Delete all remaining sessions'}</span>
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
