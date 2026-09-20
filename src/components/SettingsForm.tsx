import { useState, type FormEvent } from 'react'
import type { UserPreferences } from '../types'

interface SettingsFormProps {
  preferences: UserPreferences
  onSave: (preferences: UserPreferences) => void
  onCancel: () => void
}

export function SettingsForm({ preferences, onSave, onCancel }: SettingsFormProps) {
  const [dayStart, setDayStart] = useState(preferences.dayStart)
  const [dayEnd, setDayEnd] = useState(preferences.dayEnd)
  const [minimumFreeMinutes, setMinimumFreeMinutes] = useState(preferences.minimumFreeMinutes)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (dayEnd <= dayStart) {
      setError('Your day must end after it starts.')
      return
    }
    onSave({ dayStart, dayEnd, minimumFreeMinutes })
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <p className="settings-intro">Free time is calculated inside these hours. You can change them whenever your routine changes.</p>
      <div className="two-columns">
        <label className="field">
          <span>My day starts</span>
          <input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} />
        </label>
        <label className="field">
          <span>My day ends</span>
          <input type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Minimum free block</span>
        <select value={minimumFreeMinutes} onChange={(event) => setMinimumFreeMinutes(Number(event.target.value))}>
          <option value={15}>15 minutes</option>
          <option value={20}>20 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>1 hour</option>
        </select>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="privacy-note">
        <span aria-hidden="true">⌁</span>
        <p><strong>Private by design</strong>Your schedules stay in this browser on this iPhone.</p>
      </div>
      <div className="install-note">
        <span aria-hidden="true">⇧</span>
        <p><strong>Install on iPhone</strong>Open in Safari, tap Share, then “Add to Home Screen.”</p>
      </div>
      <div className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="submit">Save settings</button>
      </div>
    </form>
  )
}
