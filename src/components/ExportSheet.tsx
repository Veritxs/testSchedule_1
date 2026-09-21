import { useState } from 'react'
import { buildShareUrl, encodeSharedWeek } from '../lib/share'
import { renderWeekImage } from '../lib/weekImage'
import type { ScheduleEntry } from '../types'

interface ExportSheetProps {
  entries: ScheduleEntry[]
  weekDays: string[]
  weekStart: string
  weekLabel: string
  dayStart: string
  dayEnd: string
  onClose: () => void
}

export function ExportSheet({
  entries,
  weekDays,
  weekStart,
  weekLabel,
  dayStart,
  dayEnd,
  onClose,
}: ExportSheetProps) {
  const [title, setTitle] = useState('My study week')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const shareUrl = buildShareUrl(encodeSharedWeek(entries, weekStart, title.trim() || 'My study week'))
  const fileName = `waktuku-${weekDays[0]}.png`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setStatus('Link copied — paste it to your study group.')
    } catch {
      setStatus('Copy failed. Long-press the link below to copy it.')
    }
  }

  async function shareLink() {
    if (!navigator.share) {
      void copyLink()
      return
    }
    try {
      await navigator.share({ title: title.trim() || 'My study week', url: shareUrl })
    } catch {
      /* user dismissed the share sheet */
    }
  }

  async function downloadImage() {
    setBusy(true)
    setStatus('Drawing your week…')
    try {
      const blob = await renderWeekImage(entries, weekDays, title.trim() || 'My study week', dayStart, dayEnd)
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title.trim() || 'My study week' })
        setStatus('')
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        URL.revokeObjectURL(url)
        setStatus('Image saved to your downloads.')
      }
    } catch {
      setStatus('Could not create the image. Try the link instead.')
    } finally {
      setBusy(false)
    }
  }

  if (!entries.length) {
    return (
      <div className="form-stack">
        <p className="muted-message">This week has no schedules yet, so there is nothing to share.</p>
        <button className="button button--ghost button--full" type="button" onClick={onClose}>Close</button>
      </div>
    )
  }

  return (
    <div className="form-stack">
      <label className="field">
        <span>Title for the shared week</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} autoComplete="off" />
      </label>

      <p className="form-hint">
        Sharing the week of {weekLabel} with {entries.length} class{entries.length === 1 ? '' : 'es'}.
        Others open a read-only page — they cannot change your schedule, and only this week is included.
      </p>

      <div className="export-actions">
        <button className="button button--primary" type="button" onClick={shareLink}>Share link</button>
        <button className="button button--ghost" type="button" onClick={copyLink}>Copy link</button>
      </div>
      <button className="button button--ghost button--full" type="button" disabled={busy} onClick={downloadImage}>
        {busy ? 'Preparing image…' : 'Save as image (PNG)'}
      </button>

      <input className="share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />

      {status && <p className="export-status" role="status">{status}</p>}

      <button className="button button--ghost button--full" type="button" onClick={onClose}>Done</button>
    </div>
  )
}
