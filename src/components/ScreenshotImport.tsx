import { useEffect, useRef, useState } from 'react'
import { getTodayString, makeId, normalizeStartingSession, TYPE_RULES } from '../lib/schedule'
import { recognizeScheduleImages } from '../lib/ocr'
import type { ClassType, ImportDraft } from '../types'

export interface ImportOutcome {
  importedCount: number
  replacedCount: number
  skipped: Array<{ name: string; date: string }>
}

interface ScreenshotImportProps {
  onImport: (drafts: ImportDraft[]) => ImportOutcome
  onCancel: () => void
}

function emptyDraft(): ImportDraft {
  return {
    id: makeId(),
    name: '',
    type: 'LEC',
    date: getTodayString(),
    startTime: '09:00',
    endTime: '10:40',
    startingSession: 1,
  }
}

export function ScreenshotImport({ onImport, onCancel }: ScreenshotImportProps) {
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [rawText, setRawText] = useState('')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [hasScanned, setHasScanned] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  function chooseFiles(nextFiles: File[]) {
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setFiles(nextFiles)
    setPreviewUrls(nextFiles.map((item) => URL.createObjectURL(item)))
    setDrafts([])
    setRawText('')
    setError('')
    setHasScanned(false)
    setProgress(0)
  }

  async function scanScreenshots() {
    if (!files.length) return
    setError('')
    setStatus(files.length > 1 ? `Preparing ${files.length} screenshots…` : 'Preparing screenshot…')
    setProgress(0.02)
    try {
      const result = await recognizeScheduleImages(files, (nextProgress, nextStatus) => {
        setProgress(nextProgress)
        setStatus(nextStatus)
      })
      setRawText(result.text)
      setDrafts(result.drafts.length ? result.drafts : [emptyDraft()])
      setHasScanned(true)
      setProgress(1)
      setStatus('Review the result')
      if (!result.drafts.length) {
        setError('No complete classes were detected. A blank row was added so you can enter it manually.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The screenshots could not be read.')
      setStatus('')
      setProgress(0)
    }
  }

  function updateDraft(id: string, changes: Partial<ImportDraft>) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft
        const next = { ...draft, ...changes }
        if (changes.type) {
          next.startingSession = normalizeStartingSession(
            changes.type,
            changes.type === 'GSLC' ? 1 : next.startingSession,
          )
        }
        return next
      }),
    )
  }

  function finishImport() {
    const valid = drafts.filter(
      (draft) =>
        draft.name.trim() &&
        draft.date &&
        draft.startTime &&
        draft.endTime > draft.startTime,
    )
    if (!valid.length) {
      setError('Complete at least one class with a name, date, and valid time.')
      return
    }

    const outcome = onImport(valid.map((draft) => ({ ...draft, name: draft.name.trim() })))
    if (outcome.importedCount === 0 && outcome.replacedCount === 0) {
      const names = Array.from(new Set(outcome.skipped.map((item) => item.name))).join(', ')
      setError(
        `Nothing was added. ${names} already exists in your timetable at the same time, so it was skipped.`,
      )
    }
  }

  if (!hasScanned) {
    return (
      <div className="import-flow">
        <button className="upload-zone" type="button" onClick={() => inputRef.current?.click()}>
          {previewUrls.length ? (
            <>
              <div className={`preview-grid${previewUrls.length > 1 ? ' preview-grid--multi' : ''}`}>
                {previewUrls.map((url, index) => (
                  <img src={url} alt={`Selected screenshot ${index + 1}`} key={url} />
                ))}
              </div>
              <small>
                {previewUrls.length === 1
                  ? 'Tap to choose different screenshots'
                  : `${previewUrls.length} screenshots selected · tap to change`}
              </small>
            </>
          ) : (
            <>
              <span className="upload-icon" aria-hidden="true">▣</span>
              <strong>Choose screenshots</strong>
              <small>Pick one or several from your iPhone Photos</small>
            </>
          )}
        </button>
        <input
          className="visually-hidden"
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => chooseFiles(Array.from(event.target.files ?? []))}
        />

        <div className="privacy-note">
          <span aria-hidden="true">⌁</span>
          <p><strong>Processed on your device</strong>The image is not uploaded to an account or timetable server.</p>
        </div>

        {status && (
          <div className="ocr-progress" aria-live="polite">
            <div><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p>{status} {Math.round(progress * 100)}%</p>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
          <button
            className="button button--primary"
            type="button"
            disabled={!files.length || Boolean(status)}
            onClick={scanScreenshots}
          >
            {status ? 'Reading…' : files.length > 1 ? `Read ${files.length} screenshots` : 'Read screenshot'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="import-flow">
      <div className="review-intro">
        <div>
          <p className="eyebrow">Check before saving</p>
          <h3>{drafts.length} class{drafts.length === 1 ? '' : 'es'} found</h3>
        </div>
        <button className="text-button" type="button" onClick={() => chooseFiles([])}>Start over</button>
      </div>

      {error && <p className="import-warning" role="alert">{error}</p>}

      <div className="import-list">
        {drafts.map((draft, index) => {
          const total = TYPE_RULES[draft.type].totalSessions
          return (
            <article className="import-card" key={draft.id}>
              <header>
                <strong>Class {index + 1}</strong>
                <button type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}>Remove</button>
              </header>
              <label className="field">
                <span>Mata kuliah</span>
                <input value={draft.name} onChange={(event) => updateDraft(draft.id, { name: event.target.value })} />
              </label>
              <div className="import-grid import-grid--three">
                <label className="field">
                  <span>Type</span>
                  <select value={draft.type} onChange={(event) => updateDraft(draft.id, { type: event.target.value as ClassType })}>
                    <option value="LEC">LEC</option>
                    <option value="LAB">LAB</option>
                    <option value="GSLC">GSLC</option>
                  </select>
                </label>
                {draft.type !== 'GSLC' && (
                  <label className="field">
                    <span>Current session</span>
                    <select value={draft.startingSession} onChange={(event) => updateDraft(draft.id, { startingSession: Number(event.target.value) })}>
                      {Array.from({ length: total }, (_, session) => session + 1).map((session) => (
                        <option value={session} key={session}>{session}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field import-date">
                  <span>Date</span>
                  <input type="date" value={draft.date} onChange={(event) => updateDraft(draft.id, { date: event.target.value })} />
                </label>
              </div>
              <div className="two-columns">
                <label className="field">
                  <span>Starts</span>
                  <input type="time" value={draft.startTime} onChange={(event) => updateDraft(draft.id, { startTime: event.target.value })} />
                </label>
                <label className="field">
                  <span>Ends</span>
                  <input type="time" value={draft.endTime} onChange={(event) => updateDraft(draft.id, { endTime: event.target.value })} />
                </label>
              </div>
              <p className="detected-rule">{TYPE_RULES[draft.type].label}</p>
            </article>
          )
        })}
      </div>

      <button className="add-row-button" type="button" onClick={() => setDrafts((current) => [...current, emptyDraft()])}>＋ Add missing class</button>

      {rawText && (
        <details className="ocr-details">
          <summary>See text read from screenshot</summary>
          <pre>{rawText}</pre>
        </details>
      )}

      <div className="form-actions sticky-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="button" onClick={finishImport}>Import {drafts.length || ''}</button>
      </div>
    </div>
  )
}
