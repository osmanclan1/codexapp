export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateISO(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export function formatICSDate(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, '')
  return iso.slice(0, 15) + 'Z'
}

export function getWeekRangeLabel(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`
}
