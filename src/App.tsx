import { useEffect, useMemo, useState } from 'react'
import { DaySchedule } from './components/DaySchedule'
import { Modal } from './components/Modal'
import { ScheduleForm, type ScheduleFormValues } from './components/ScheduleForm'
import { ScreenshotImport, type ImportOutcome } from './components/ScreenshotImport'
import { SettingsForm } from './components/SettingsForm'
import {
  addDays,
  calculateFreeSlots,
  createSeries,
  findDuplicateOccurrence,
  formatLongDate,
  formatShortDate,
  formatWeekday,
  getOccurrences,
  getTodayString,
  getWeekDays,
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
type OpenModal = 'add' | 'import' | 'settings' | 'removeAll' | null

function App() {
  const today = getTodayString()
  const [series, setSeries] = useState<ScheduleSeries[]>(loadSchedules)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [view, setView] = useState<ViewMode>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleOccurrence | null>(null)
  const [addError, setAddError] = useState('')
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
  const totalOccurrences = useMemo(() => getOccurrences(series).length, [series])
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
    const candidate = createSeries(values)
    const duplicate = findDuplicateOccurrence(candidate, series)
    if (duplicate) {
      setAddError(
        `“${duplicate.name}” is already in your timetable on ${formatLongDate(duplicate.date)} at ${duplicate.startTime}–${duplicate.endTime}, so nothing was added.`,
      )
      return
    }

    setAddError('')
    setSeries((current) => [...current, candidate])
    setSelectedDate(values.firstDate)
    setOpenModal(null)
    setToast(`${values.name} added`)
  }

  function importSchedules(drafts: ImportDraft[]): ImportOutcome {
    const accepted: ScheduleSeries[] = []
    const skipped: Array<{ name: string; date: string }> = []

    for (const draft of drafts) {
      const candidate = createSeries({ ...draft, firstDate: draft.date })
      const duplicate = findDuplicateOccurrence(candidate, [...series, ...accepted])
      if (duplicate) {
        skipped.push({ name: duplicate.name, date: duplicate.date })
      } else {
        accepted.push(candidate)
      }
    }

    if (!accepted.length) return { importedCount: 0, skipped }

    setSeries((current) => [...current, ...accepted])
    setSelectedDate(accepted[0].firstDate)
    setOpenModal(null)
    setToast(
      skipped.length
        ? `${accepted.length} imported · ${skipped.length} already existed`
        : `${accepted.length} class${accepted.length === 1 ? '' : 'es'} imported`,
    )
    return { importedCount: accepted.length, skipped }
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

  function removeAllSchedules() {
    const removedCount = series.length
    setSeries([])
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

      {openModal === 'settings' && (
        <Modal title="Free-time settings" onClose={() => setOpenModal(null)}>
          <SettingsForm
            preferences={preferences}
            scheduleCount={series.length}
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
                {series.length} saved schedule{series.length === 1 ? '' : 's'} and{' '}
                {totalOccurrences} upcoming occurrence{totalOccurrences === 1 ? '' : 's'} will be
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
            {deleteTarget.isRecurring && (
              <button className="delete-option" type="button" onClick={removeOccurrence}>
                <strong>Remove this occurrence</strong>
                <span>Keep the rest of the repeating schedule</span>
              </button>
            )}
            <button className="delete-option delete-option--danger" type="button" onClick={removeSeries}>
              <strong>{deleteTarget.isRecurring ? 'Remove entire series' : 'Remove schedule'}</strong>
              <span>
                {deleteTarget.isRecurring
                  ? 'Delete every remaining occurrence'
                  : 'Delete this one-time schedule'}
              </span>
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
