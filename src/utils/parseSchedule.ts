import type { ScheduleEvent, EventCategory } from '../types'
import { addMinutes } from './date'

const monthMap: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const defaultTimes: Record<EventCategory, { hour: number; minute: number; duration: number }> = {
  class: { hour: 9, minute: 0, duration: 75 },
  assignment: { hour: 21, minute: 0, duration: 60 },
  exam: { hour: 9, minute: 0, duration: 120 },
  milestone: { hour: 12, minute: 0, duration: 60 },
  other: { hour: 12, minute: 0, duration: 60 },
}

const deliverableRegex = /\b(?:Lab(?:s)?\s?\d*[A-Za-z]?|Exam(?:s)?\s?\d*|Project\s?\d*|Quiz(?:zes)?\s?\d*|Assignment\s?\d*|Practice|Read(?:ing)?|Chapter\s?\d+|P\d+(?:\([A-Za-z]\))?|HW\s?\d+|ICs?|Milestone|Checkpoint|Presentation|Due)\b/gi

const monthPattern =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi

function sanitizeLine(input: string): string {
  return input
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\bSe\b/gi, 'Sep')
    .replace(/\.{2,}/g, '')
    .trim()
}

function shouldSkipLine(line: string): boolean {
  const lower = line.toLowerCase()
  if (!lower) return true
  if (lower.startsWith('tentative')) return true
  if (lower.startsWith('week dates')) return true
  if (lower.startsWith('week') && !/\d/.test(lower)) return true
  if (lower.startsWith('dates') && !/\d/.test(lower)) return true
  if (lower.startsWith('class activity')) return true
  if (lower.startsWith('labs') && !/\d/.test(lower)) return true
  return false
}

function collectDays(text: string, index: number): { days: number[]; endIndex: number } {
  const days: number[] = []
  let cursor = index
  const dayRegex = /\s*(\d{1,2})(?:st|nd|rd|th)?/gy
  dayRegex.lastIndex = cursor

  while (true) {
    const match = dayRegex.exec(text)
    if (!match) {
      break
    }
    days.push(Number(match[1]))
    cursor = dayRegex.lastIndex

    const connectorRegex = /\s*(?:,|and|&|to|-)\s*/gy
    connectorRegex.lastIndex = cursor
    const connectorMatch = connectorRegex.exec(text)
    if (!connectorMatch) {
      break
    }
    cursor = connectorRegex.lastIndex
    const nextChar = text[cursor]
    if (!nextChar || /[A-Za-z]/.test(nextChar)) {
      break
    }
    dayRegex.lastIndex = cursor
  }

  return { days, endIndex: cursor }
}

function extractDeliverables(text: string): { topic: string; deliverables: string[] } {
  const matches = [...text.matchAll(deliverableRegex)]
  if (matches.length === 0) {
    return { topic: text.trim(), deliverables: [] }
  }

  const deliverables: string[] = []
  const firstIndex = matches[0].index ?? 0
  const topic = text.slice(0, firstIndex).replace(/[-–—,:;]+$/g, '').trim()

  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0
    const end = matches[i + 1]?.index ?? text.length
    const chunk = text.slice(start, end).trim()
    if (chunk) {
      deliverables.push(chunk)
    }
  }

  return { topic, deliverables }
}

function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/^[-–—,:;]+/g, '').trim()
}

function inferEventType(text: string): EventCategory {
  const lower = text.toLowerCase()
  if (/(exam|midterm|quiz|test)/i.test(text)) {
    if (/review/.test(lower) && !/due/.test(lower)) {
      return 'class'
    }
    return 'exam'
  }
  if (/(milestone|presentation|checkpoint|project)/.test(lower)) {
    return 'milestone'
  }
  if (/(lab|assignment|homework|hw|ic\b|due|submission|practice|read|chapter|problem set|p\d+)/.test(lower)) {
    return 'assignment'
  }
  if (/(lecture|class|topic|discussion|review|workshop|intro|session)/.test(lower)) {
    return 'class'
  }
  return 'other'
}

function chooseDateForDeliverable(dates: Date[], type: EventCategory): Date | undefined {
  if (dates.length === 0) return undefined
  if (type === 'exam') {
    return new Date(dates[0])
  }
  return new Date(dates[dates.length - 1])
}

function buildEvent(date: Date, type: EventCategory, text: string, sourceLine: string): ScheduleEvent {
  const timing = defaultTimes[type] ?? defaultTimes.other
  const start = new Date(date)
  start.setHours(timing.hour, timing.minute, 0, 0)
  const end = addMinutes(start, timing.duration)
  const description = normalizeDescription(text)
  const title = description ||
    (type === 'class'
      ? 'Class session'
      : type === 'exam'
        ? 'Exam'
        : type === 'assignment'
          ? 'Assignment'
          : type === 'milestone'
            ? 'Milestone'
            : 'Schedule item')

  return {
    id: createId(),
    date: start.toISOString(),
    endDate: end.toISOString(),
    title,
    description: description || title,
    type,
    sourceLine,
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

export function parseSchedule(rawText: string, baseYear: number): ScheduleEvent[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => sanitizeLine(line))
    .filter((line) => line.length > 0 && !shouldSkipLine(line))

  const events: ScheduleEvent[] = []
  let currentYear = baseYear
  let lastMonthIndex = -1

  for (const originalLine of lines) {
    let working = originalLine
    working = working.replace(/^[-*\u2022]+\s*/, '')
    working = working.replace(/^week\s*\d+\s*/i, '')
    working = working.replace(/^\d+\s+/, '')

    const matches = [...working.matchAll(monthPattern)]
    if (matches.length === 0) {
      continue
    }

    const dates: Date[] = []
    let lastDateEnd = 0
    let tempYear = currentYear
    let tempMonthIndex = lastMonthIndex

    for (const match of matches) {
      const rawMonth = (match[1] ?? match[0]).toLowerCase()
      const normalized = rawMonth.startsWith('sep') ? 'sep' : rawMonth
      const monthIndex = monthMap[normalized]
      if (monthIndex === undefined) {
        continue
      }

      if (tempMonthIndex !== -1 && monthIndex < tempMonthIndex && tempMonthIndex - monthIndex > 6) {
        tempYear += 1
      }
      tempMonthIndex = monthIndex

      const startIndex = (match.index ?? 0) + match[0].length
      const { days, endIndex } = collectDays(working, startIndex)
      if (endIndex > lastDateEnd) {
        lastDateEnd = endIndex
      }
      if (days.length === 0) {
        continue
      }

      for (const day of days) {
        const eventDate = new Date(tempYear, monthIndex, day)
        dates.push(eventDate)
      }
    }

    if (dates.length === 0) {
      continue
    }

    currentYear = tempYear
    lastMonthIndex = tempMonthIndex

    const firstMonthIndex = matches[0].index ?? 0
    const leadingText = working.slice(0, firstMonthIndex).replace(/[-–—,:;]+$/g, '').trim()
    const trailingText = working.slice(lastDateEnd).trim()
    const infoText = [leadingText, trailingText].filter(Boolean).join(' ').trim()
    const baseText = infoText || working.slice(firstMonthIndex).trim()

    const { topic, deliverables } = extractDeliverables(baseText)

    if (topic) {
      for (const date of dates) {
        events.push(buildEvent(date, 'class', topic, originalLine))
      }
    }

    if (deliverables.length === 0 && !topic) {
      for (const date of dates) {
        const type = inferEventType(baseText)
        events.push(buildEvent(date, type === 'class' ? 'class' : type, baseText, originalLine))
      }
      continue
    }

    for (const item of deliverables) {
      const cleaned = normalizeDescription(item)
      if (!cleaned) {
        continue
      }
      let type = inferEventType(cleaned)
      if (type === 'exam' && /review/.test(cleaned.toLowerCase())) {
        type = 'class'
      }
      const chosenDate = chooseDateForDeliverable(dates, type)
      if (!chosenDate) {
        continue
      }
      events.push(buildEvent(chosenDate, type, cleaned, originalLine))
    }
  }

  const uniqueEvents = dedupeEvents(events)

  uniqueEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return uniqueEvents
}

function dedupeEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  const seen = new Map<string, ScheduleEvent>()
  for (const event of events) {
    const key = `${event.title.toLowerCase()}-${event.date}`
    if (!seen.has(key)) {
      seen.set(key, event)
    }
  }
  return Array.from(seen.values())
}
