import { createWorker, OEM, PSM } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import { makeId, normalizeStartingSession, toLocalDateString } from './schedule'
import type { ClassType, ImportDraft } from '../types'

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  januari: 1,
  februari: 2,
  maret: 3,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  oktober: 10,
  desember: 12,
}

function parseScreenshotDate(text: string): string | null {
  const monthNames = Object.keys(MONTHS).join('|')
  const match = text.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\s+(20\\d{2})\\b`, 'i'),
  )
  if (!match) return null

  const day = Number(match[1])
  const month = MONTHS[match[2].toLowerCase()]
  const year = Number(match[3])
  if (!month || day < 1 || day > 31) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function normalizeTime(hours: string, minutes: string): string | null {
  const hour = Number(hours)
  const minute = Number(minutes)
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function extractTimeRange(text: string): { startTime: string; endTime: string } | null {
  const match = text.match(
    /\b(\d{1,2})\s*[:.]\s*(\d{2})\s*[-–—~]\s*(\d{1,2})\s*[:.]\s*(\d{2})\b/i,
  )
  if (!match) return null
  const startTime = normalizeTime(match[1], match[2])
  const endTime = normalizeTime(match[3], match[4])
  if (!startTime || !endTime || endTime <= startTime) return null
  return { startTime, endTime }
}

function cleanCourseName(block: string, marker: RegExpMatchArray): string {
  const markerEnd = marker[0].length
  const beforeTime = block.split(/\b\d{1,2}\s*[:.]\s*\d{2}\s*[-–—~]/)[0]
  const afterMarker = beforeTime.slice(markerEnd)
  const lines = afterMarker
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[•·|]+\s*/, ''))
    .filter(Boolean)

  const noise = /^(onsite\s+class|online\s+class|f2f|session\s*\d+|gslc|lec|lab)$/i
  const candidate = lines.find(
    (line) =>
      !noise.test(line) &&
      !/^\d+$/.test(line) &&
      !/^(today|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b/i.test(line),
  )

  if (!candidate) return 'Untitled class'
  return candidate
    .replace(/\s+(onsite|online)\s+class.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function parseScheduleText(text: string, fallbackDate: string): ImportDraft[] {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/\n{3,}/g, '\n\n')
  const date = parseScreenshotDate(normalized) ?? fallbackDate
  const markerPattern = /\b([A-Z]{1,5}\d{1,3})\s*-\s*(LAB|LEC)\b/gi
  const matches = Array.from(normalized.matchAll(markerPattern))

  return matches.flatMap((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? normalized.length
    const block = normalized.slice(start, end)
    const time = extractTimeRange(block)
    if (!time) return []

    const detectedType: ClassType = /\bGSLC\b/i.test(block)
      ? 'GSLC'
      : match[2].toUpperCase() === 'LAB'
        ? 'LAB'
        : 'LEC'
    const sessionMatch = block.match(/\bSession\s*(\d{1,2})\b/i)
    const startingSession = normalizeStartingSession(
      detectedType,
      sessionMatch ? Number(sessionMatch[1]) : 1,
    )

    return [
      {
        id: makeId(),
        name: cleanCourseName(block, match),
        type: detectedType,
        date,
        startTime: time.startTime,
        endTime: time.endTime,
        startingSession,
      },
    ]
  })
}

async function imageToHighContrastCanvas(file: File): Promise<HTMLCanvasElement> {
  const image = new Image()
  const objectUrl = URL.createObjectURL(file)

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('This image could not be opened.'))
      image.src = objectUrl
    })

    // Keep memory use predictable on iPhones while retaining enough detail for
    // the relatively large text in campus schedule screenshots.
    const targetWidth = Math.min(Math.max(image.naturalWidth, 1200), 1800)
    const scale = targetWidth / image.naturalWidth
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Image processing is not available in this browser.')

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    let sampleTotal = 0
    let samples = 0

    for (let index = 0; index < pixels.data.length; index += 400) {
      sampleTotal +=
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114
      samples += 1
    }
    const darkBackground = sampleTotal / Math.max(samples, 1) < 128

    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance =
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114
      const isText = darkBackground ? luminance > 145 : luminance < 170
      const value = isText ? 0 : 255
      pixels.data[index] = value
      pixels.data[index + 1] = value
      pixels.data[index + 2] = value
      pixels.data[index + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function draftKey(draft: ImportDraft): string {
  return [
    draft.name.trim().toLowerCase().replace(/\s+/g, ' '),
    draft.type,
    draft.date,
    draft.startTime,
    draft.endTime,
  ].join('|')
}

/** Reads one or more screenshots with a single reader instance. */
export async function recognizeScheduleImages(
  files: File[],
  onProgress: (progress: number, status: string) => void,
): Promise<{ text: string; drafts: ImportDraft[] }> {
  onProgress(0.02, 'Preparing private OCR…')

  // Updated per image so the progress bar keeps moving during long reads.
  let reportPageProgress: (progress: number) => void = () => {}

  const workerPromise = createWorker(
    'eng',
    OEM.LSTM_ONLY,
    {
      // Self-hosting the worker and non-SIMD core avoids cross-origin worker
      // loading failures in iOS Safari and allows importing after installation.
      workerPath: workerUrl,
      workerBlobURL: false,
      corePath: coreUrl,
      langPath: `${import.meta.env.BASE_URL}ocr`,
      logger: (message) => {
        if (message.status === 'recognizing text') {
          reportPageProgress(message.progress)
        } else {
          onProgress(Math.max(0.02, message.progress * 0.15), 'Loading text reader…')
        }
      },
    },
  )
  let startupTimeout = 0
  const timeoutPromise = new Promise<never>((_, reject) => {
    startupTimeout = window.setTimeout(
      () => reject(new Error('The text reader took too long to start. Close the app, reopen it, and try again.')),
      45_000,
    )
  })
  const worker = await Promise.race([workerPromise, timeoutPromise]).finally(() => {
    window.clearTimeout(startupTimeout)
  })

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    })

    const today = toLocalDateString(new Date())
    const texts: string[] = []
    const drafts: ImportDraft[] = []
    const seen = new Set<string>()

    for (const [index, file] of files.entries()) {
      const label = files.length > 1 ? `image ${index + 1} of ${files.length}` : 'your screenshot'
      const share = 0.85 / files.length
      const base = 0.15 + index * share
      onProgress(base, `Reading ${label}…`)
      reportPageProgress = (progress) =>
        onProgress(base + progress * share, `Reading ${label}…`)

      const canvas = await imageToHighContrastCanvas(file)
      const result = await worker.recognize(canvas)
      const text = result.data.text
      texts.push(files.length > 1 ? `--- ${file.name || label} ---\n${text}` : text)

      for (const draft of parseScheduleText(text, today)) {
        const key = draftKey(draft)
        if (seen.has(key)) continue
        seen.add(key)
        drafts.push(draft)
      }

      onProgress(base + share, `Read ${label}`)
    }

    drafts.sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime),
    )

    return { text: texts.join('\n\n'), drafts }
  } finally {
    await worker.terminate()
  }
}
