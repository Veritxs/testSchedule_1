import { useMemo, useState, type FormEvent } from 'react'
import {
  CUSTOM_REPEAT_LABELS,
  defaultCustomEndDate,
  getTodayString,
  normalizeStartingSession,
  TYPE_RULES,
} from '../lib/schedule'
import type { ClassType, CustomRepeat } from '../types'

export interface ScheduleFormValues {
  name: string
  type: ClassType
  firstDate: string
  startTime: string
  endTime: string
  startingSession: number
  repeat?: CustomRepeat
  endDate?: string
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
  LEC: { title: 'LEC', short: 'Weekly · 13' },
  LAB: { title: 'LAB', short: '2 weeks · 6' },
  GSLC: { title: 'GSLC', short: 'One time' },
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
  const [firstDate, setFirstDate] = useState(initial?.firstDate ?? getTodayString())
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:40')
  const [startingSession, setStartingSession] = useState(initial?.startingSession ?? 1)
  const [repeat, setRepeat] = useState<CustomRepeat>(initial?.repeat ?? 'weekly')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [error, setError] = useState('')

  const isCustom = type === 'CUSTOM'
  const rule = TYPE_RULES[type]
  const effectiveEndDate = endDate || defaultCustomEndDate(firstDate)

  const recurrenceText = useMemo(() => {
    if (isCustom) {
      if (repeat === 'once') return 'This personal schedule is saved only on the selected date.'
      return `${CUSTOM_REPEAT_LABELS[repeat]} from the selected date until ${effectiveEndDate}. No class sessions are counted.`
    }
    if (type === 'GSLC') return 'This is saved only on the selected date.'
    const remaining = rule.totalSessions - normalizeStartingSession(type, startingSession) + 1
    return `${rule.label}. Starting at Session ${startingSession}, ${remaining} occurrence${remaining === 1 ? '' : 's'} will be added.`
  }, [effectiveEndDate, isCustom, repeat, rule, startingSession, type])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError(isCustom ? 'Enter a name for this schedule.' : 'Enter the mata kuliah name.')
      return
    }
    if (!firstDate) {
      setError('Choose the date of this schedule.')
      return
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setError('End time must be after start time.')
      return
    }
    if (isCustom && repeat !== 'once' && endDate && endDate < firstDate) {
      setError('The repeat end date cannot be before the start date.')
      return
    }

    onSave({
      name: cleanName,
      type,
      firstDate,
      startTime,
      endTime,
      startingSession: normalizeStartingSession(type, startingSession),
      ...(isCustom
        ? {
            repeat,
            ...(repeat === 'once' ? {} : { endDate: effectiveEndDate }),
          }
        : {}),
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
              onClick={() => {
                setType(option)
                if (option === 'GSLC' || option === 'CUSTOM') setStartingSession(1)
              }}
            >
              <strong>{TYPE_COPY[option].title}</strong>
              <small>{TYPE_COPY[option].short}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{type === 'GSLC' || (isCustom && repeat === 'once') ? 'Date' : isCustom ? 'Starting date' : 'Date of this session'}</span>
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

      {isCustom && (
        <label className="field">
          <span>Repeat</span>
          <select
            value={repeat}
            onChange={(event) => setRepeat(event.target.value as CustomRepeat)}
          >
            {(Object.keys(CUSTOM_REPEAT_LABELS) as CustomRepeat[]).map((option) => (
              <option value={option} key={option}>{CUSTOM_REPEAT_LABELS[option]}</option>
            ))}
          </select>
        </label>
      )}

      {isCustom && repeat !== 'once' && (
        <label className="field">
          <span>Repeat until</span>
          <input
            type="date"
            min={firstDate}
            value={effectiveEndDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      )}

      {!isCustom && type !== 'GSLC' && (
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
