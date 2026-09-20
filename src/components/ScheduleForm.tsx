import { useMemo, useState, type FormEvent } from 'react'
import { getTodayString, normalizeStartingSession, TYPE_RULES } from '../lib/schedule'
import type { ClassType } from '../types'

export interface ScheduleFormValues {
  name: string
  type: ClassType
  firstDate: string
  startTime: string
  endTime: string
  startingSession: number
}

interface ScheduleFormProps {
  onSave: (values: ScheduleFormValues) => void
  onCancel: () => void
  initial?: Partial<ScheduleFormValues>
  submitLabel?: string
}

const TYPE_COPY: Record<ClassType, { title: string; short: string }> = {
  LEC: { title: 'LEC', short: 'Weekly' },
  LAB: { title: 'LAB', short: 'Every 2 weeks' },
  GSLC: { title: 'GSLC', short: 'One time' },
}

export function ScheduleForm({
  onSave,
  onCancel,
  initial,
  submitLabel = 'Add schedule',
}: ScheduleFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<ClassType>(initial?.type ?? 'LEC')
  const [firstDate, setFirstDate] = useState(initial?.firstDate ?? getTodayString())
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:40')
  const [startingSession, setStartingSession] = useState(initial?.startingSession ?? 1)
  const [error, setError] = useState('')

  const rule = TYPE_RULES[type]
  const recurrenceText = useMemo(() => {
    if (type === 'GSLC') return 'This is saved only on the selected date.'
    const remaining = rule.totalSessions - normalizeStartingSession(type, startingSession) + 1
    return `${rule.label}. Starting at Session ${startingSession}, ${remaining} occurrence${remaining === 1 ? '' : 's'} will be added.`
  }, [rule, startingSession, type])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Enter the mata kuliah name.')
      return
    }
    if (!firstDate) {
      setError('Choose the date of this session.')
      return
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setError('End time must be after start time.')
      return
    }

    onSave({
      name: cleanName,
      type,
      firstDate,
      startTime,
      endTime,
      startingSession: normalizeStartingSession(type, startingSession),
    })
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Mata kuliah</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Computer Networks"
          autoComplete="off"
        />
      </label>

      <fieldset className="field type-picker">
        <legend>Class type</legend>
        <div className="segmented-control">
          {(Object.keys(TYPE_COPY) as ClassType[]).map((option) => (
            <button
              className={type === option ? 'is-active' : ''}
              key={option}
              type="button"
              onClick={() => {
                setType(option)
                if (option === 'GSLC') setStartingSession(1)
              }}
            >
              <strong>{TYPE_COPY[option].title}</strong>
              <small>{TYPE_COPY[option].short}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{type === 'GSLC' ? 'Date' : 'Date of this session'}</span>
        <input type="date" value={firstDate} onChange={(event) => setFirstDate(event.target.value)} />
      </label>

      <div className="two-columns">
        <label className="field">
          <span>Starts</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label className="field">
          <span>Ends</span>
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
      </div>

      {type !== 'GSLC' && (
        <label className="field">
          <span>Session on this date</span>
          <select
            value={startingSession}
            onChange={(event) => setStartingSession(Number(event.target.value))}
          >
            {Array.from({ length: rule.totalSessions }, (_, index) => index + 1).map((session) => (
              <option value={session} key={session}>Session {session}</option>
            ))}
          </select>
        </label>
      )}

      <p className="form-hint">{recurrenceText}</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
