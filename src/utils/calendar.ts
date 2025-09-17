import type { ScheduleEvent } from '../types'
import { formatICSDate } from './date'

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function buildICS(events: ScheduleEvent[]): string {
  const timestamp = formatICSDate(new Date())
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'PRODID:-//Student Schedule Studio//EN']

  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}`)
    lines.push(`DTSTAMP:${timestamp}`)
    lines.push(`DTSTART:${formatICSDate(new Date(event.date))}`)
    lines.push(`DTEND:${formatICSDate(new Date(event.endDate))}`)
    lines.push(`SUMMARY:${escapeICS(event.title)}`)
    lines.push(`DESCRIPTION:${escapeICS(event.description || event.sourceLine)}`)
    lines.push('BEGIN:VALARM')
    lines.push('TRIGGER:-P1D')
    lines.push('ACTION:DISPLAY')
    lines.push('DESCRIPTION:Reminder')
    lines.push('END:VALARM')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\n')
}

export function downloadICSFile(events: ScheduleEvent[]): void {
  if (events.length === 0) return
  const icsContent = buildICS(events)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'course-schedule.ics'
  link.click()
  URL.revokeObjectURL(url)
}
