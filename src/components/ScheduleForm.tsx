import { useState, type FormEvent } from 'react'
import { getTodayString, normalizeSessionNumber } from '../lib/schedule'
import type { ClassType } from '../types'

export interface ScheduleFormValues {
  name: string
  type: ClassType
  date: string
  startTime: string
  endTime: string
  sessionNumber?: number
}

interface ScheduleFormProps {
  onSave: (values: ScheduleFormValues) => void
  onCancel: () => void
  initial?: Partial<ScheduleFormValues>
  submitLabel?: string
  /** Message from the parent, e.g. when the schedule already exists. */
  externalError?: string
}

const TYPE_COPY: Record<ClassType, { title: string; short: string }> = {
  LEC: { title: 'LEC', short: 'Lecture' },
  LAB: { title: 'LAB', short: 'Lab' },
  GSLC: { title: 'GSLC', short: 'Self-learning' },
  CUSTOM: { title: 'Custom', short: 'My own' },
}

export function ScheduleForm({
  onSave,
  onCancel,
  initial,
  submitLabel = 'Add schedule',
  externalError = '',
}: ScheduleFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<ClassType>(initial?.type ?? 'LEC')
  const [date, setDate] = useState(initial?.date ?? getTodayString())
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:40')
  const [session, setSession] = useState(
    initial?.sessionNumber ? String(initial.sessionNumber) : '',
  )
  const [error, setError] = useState('')

  const isCustom = type === 'CUSTOM'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError(isCustom ? 'Enter a name for this schedule.' : 'Enter the mata kuliah name.')
      return
    }
    if (!date) {
      setError('Choose the date of this schedule.')
      return
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setError('End time must be after start time.')
      return
    }

    onSave({
      name: cleanName,
      type,
      date,
      startTime,
      endTime,
      sessionNumber: isCustom ? undefined : normalizeSessionNumber(session),
    })
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>{isCustom ? 'Schedule name' : 'Mata kuliah'}</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isCustom ? 'e.g. Gym, Work shift, Organization' : 'e.g. Computer Networks'}
          autoComplete="off"
        />
      </label>

      <fieldset className="field type-picker">
        <legend>Type</legend>
        <div className="segmented-control segmented-control--quad">
          {(Object.keys(TYPE_COPY) as ClassType[]).map((option) => (
            <button
              className={type === option ? 'is-active' : ''}
              key={option}
              type="button"
              onClick={() => setType(option)}
            >
              <strong>{TYPE_COPY[option].title}</strong>
              <small>{TYPE_COPY[option].short}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
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

      {!isCustom && (
        <label className="field">
          <span>Session number (optional)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            value={session}
            placeholder="e.g. 7"
            onChange={(event) => setSession(event.target.value)}
          />
        </label>
      )}

      <p className="form-hint">
        Saved on {date || 'the chosen date'} only. Nothing repeats automatically, so add each
        class on the date it actually happens.
      </p>
      {(error || externalError) && (
        <p className="form-error" role="alert">{error || externalError}</p>
      )}

      <div className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
