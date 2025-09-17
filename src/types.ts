export type EventCategory = 'class' | 'assignment' | 'exam' | 'milestone' | 'other'

export interface ScheduleEvent {
  id: string
  date: string
  endDate: string
  title: string
  description: string
  type: EventCategory
  sourceLine: string
}

export interface ReminderSetting {
  eventId: string
  leadMinutes: number
  lastTriggered?: string
}
