import { formatWeekday, minutesFromTime, parseLocalDate } from './schedule'
import type { ScheduleEntry } from '../types'

const TYPE_COLORS: Record<string, { bar: string; fill: string; text: string }> = {
  LEC: { bar: '#ed704f', fill: '#fdeae3', text: '#b6472c' },
  LAB: { bar: '#3f7fc1', fill: '#e4eefa', text: '#2b5a8f' },
  GSLC: { bar: '#9152c4', fill: '#f2e8fb', text: '#6b3a94' },
  CUSTOM: { bar: '#1f8a8a', fill: '#e0f2f1', text: '#136463' },
}

/** Renders the shown week to a PNG blob so it can be shared or saved. */
export function renderWeekImage(
  entries: ScheduleEntry[],
  weekDays: string[],
  title: string,
  dayStart: string,
  dayEnd: string,
): Promise<Blob> {
  const scale = 2
  const gutter = 54
  const headerHeight = 96
  const dayColWidth = 150
  const width = gutter + dayColWidth * 7
  const startMin = Math.min(
    minutesFromTime(dayStart),
    ...entries.map((e) => minutesFromTime(e.startTime)),
  )
  const endMin = Math.max(
    minutesFromTime(dayEnd),
    ...entries.map((e) => minutesFromTime(e.endTime)),
  )
  const firstHour = Math.floor(startMin / 60)
  const lastHour = Math.ceil(endMin / 60)
  const pxPerMin = 1.1
  const gridTop = firstHour * 60
  const bodyHeight = (lastHour * 60 - gridTop) * pxPerMin
  const height = headerHeight + bodyHeight + 40

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.textBaseline = 'top'

  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#17231d'
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillText(title, 16, 18)
  ctx.fillStyle = '#6e756f'
  ctx.font = '500 13px system-ui, sans-serif'
  const rangeLabel = `${weekDays[0]} – ${weekDays[6]}`
  ctx.fillText(rangeLabel, 16, 46)

  const bodyTop = headerHeight

  // Hour lines and labels.
  ctx.strokeStyle = '#e7e3da'
  ctx.lineWidth = 1
  ctx.fillStyle = '#9aa09a'
  ctx.font = '500 11px system-ui, sans-serif'
  for (let hour = firstHour; hour <= lastHour; hour += 1) {
    const y = bodyTop + (hour * 60 - gridTop) * pxPerMin
    ctx.beginPath()
    ctx.moveTo(gutter, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    ctx.fillText(`${String(hour).padStart(2, '0')}:00`, 10, y - 6)
  }

  // Day headers and vertical separators.
  weekDays.forEach((date, index) => {
    const x = gutter + index * dayColWidth
    ctx.strokeStyle = '#e7e3da'
    ctx.beginPath()
    ctx.moveTo(x, bodyTop - 26)
    ctx.lineTo(x, bodyTop + bodyHeight)
    ctx.stroke()
    ctx.fillStyle = '#17231d'
    ctx.font = '700 13px system-ui, sans-serif'
    ctx.fillText(formatWeekday(date, true), x + 8, bodyTop - 42)
    ctx.fillStyle = '#6e756f'
    ctx.font = '500 11px system-ui, sans-serif'
    const d = parseLocalDate(date)
    ctx.fillText(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`, x + 8, bodyTop - 26)
  })

  // Event blocks.
  weekDays.forEach((date, index) => {
    const dayEntries = entries.filter((e) => e.date === date)
    const x = gutter + index * dayColWidth
    for (const entry of dayEntries) {
      const top = bodyTop + (minutesFromTime(entry.startTime) - gridTop) * pxPerMin
      const blockHeight = Math.max(
        (minutesFromTime(entry.endTime) - minutesFromTime(entry.startTime)) * pxPerMin,
        26,
      )
      const colors = TYPE_COLORS[entry.type] ?? TYPE_COLORS.LEC
      ctx.fillStyle = colors.fill
      roundRect(ctx, x + 3, top + 1, dayColWidth - 6, blockHeight - 3, 6)
      ctx.fill()
      ctx.fillStyle = colors.bar
      roundRect(ctx, x + 3, top + 1, 3, blockHeight - 3, 2)
      ctx.fill()

      ctx.fillStyle = colors.text
      ctx.font = '700 11px system-ui, sans-serif'
      wrapText(ctx, entry.name, x + 11, top + 6, dayColWidth - 18, 13, 3)
      ctx.fillStyle = colors.text
      ctx.font = '500 10px system-ui, sans-serif'
      ctx.globalAlpha = 0.8
      ctx.fillText(`${entry.startTime}–${entry.endTime}`, x + 11, top + blockHeight - 15)
      ctx.globalAlpha = 1
    }
  })

  ctx.fillStyle = '#9aa09a'
  ctx.font = '500 11px system-ui, sans-serif'
  ctx.fillText('Made with WaktuKu', 16, height - 24)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create the image.'))
    }, 'image/png')
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines - 1) break
    } else {
      current = attempt
    }
  }
  if (current && lines.length < maxLines) lines.push(current)

  lines.forEach((line, index) => {
    let out = line
    if (index === maxLines - 1 && ctx.measureText(line).width > maxWidth) {
      while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
        out = out.slice(0, -1)
      }
      out += '…'
    }
    ctx.fillText(out, x, y + index * lineHeight)
  })
}
