import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { parseSchedule } from './utils/parseSchedule'
import { downloadICSFile } from './utils/calendar'
import { sampleSchedule } from './sampleSchedule'
import type { ReminderSetting, ScheduleEvent } from './types'
import {
  formatDateDisplay,
  formatTimeDisplay,
  getWeekRangeLabel,
  isSameDay,
  startOfWeek,
} from './utils/date'

const reminderOptions = [
  { label: 'No reminder', value: 0 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '6 hours before', value: 360 },
  { label: '1 day before', value: 1440 },
  { label: '3 days before', value: 4320 },
]

const typeLabels: Record<ScheduleEvent['type'], string> = {
  class: 'Class session',
  assignment: 'Assignment & practice',
  exam: 'Exam',
  milestone: 'Project milestone',
  other: 'Other',
}

type ReminderState = Record<string, ReminderSetting>

const INPUT_KEY = 'student-studio-input'
const EVENTS_KEY = 'student-studio-events'
const YEAR_KEY = 'student-studio-year'
const REMINDER_KEY = 'student-studio-reminders'

function App() {
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

  const [inputText, setInputText] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(INPUT_KEY) ?? ''
  })

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(() => {
    if (typeof window === 'undefined') return currentYear
    const stored = window.localStorage.getItem(YEAR_KEY)
    if (!stored) return currentYear
    const parsed = Number.parseInt(stored, 10)
    return Number.isFinite(parsed) ? parsed : currentYear
  })

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = window.localStorage.getItem(EVENTS_KEY)
    if (!stored) return []
    try {
      const parsed = JSON.parse(stored) as ScheduleEvent[]
      return parsed ?? []
    } catch (error) {
      console.warn('Unable to read stored events', error)
      return []
    }
  })

  const [reminders, setReminders] = useState<ReminderState>(() => {
    if (typeof window === 'undefined') return {}
    const stored = window.localStorage.getItem(REMINDER_KEY)
    if (!stored) return {}
    try {
      const parsed = JSON.parse(stored) as ReminderState
      return parsed ?? {}
    } catch (error) {
      console.warn('Unable to read stored reminders', error)
      return {}
    }
  })

  const [selectedWeek, setSelectedWeek] = useState<Date>(() => startOfWeek(new Date(), 1))
  const [error, setError] = useState<string | null>(null)
  const [hasInitializedWeek, setHasInitializedWeek] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (!notificationsSupported) return 'default'
    return Notification.permission
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(INPUT_KEY, inputText)
  }, [inputText])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(YEAR_KEY, String(year))
  }, [year])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders))
  }, [reminders])

  useEffect(() => {
    if (hasInitializedWeek || events.length === 0) return
    const first = events[0]
    setSelectedWeek(startOfWeek(new Date(first.date), 1))
    setHasInitializedWeek(true)
  }, [events, hasInitializedWeek])

  useEffect(() => {
    if (!notificationsSupported) return
    const runCheck = () => {
      if (Notification.permission !== 'granted') {
        return
      }
      setReminders((current) => {
        const updated: ReminderState = { ...current }
        let changed = false
        const now = Date.now()

        for (const [eventId, setting] of Object.entries(current)) {
          if (setting.leadMinutes <= 0) continue
          const event = events.find((item) => item.id === eventId)
          if (!event) continue
          const eventTime = new Date(event.date).getTime()
          if (eventTime < now) continue
          const leadMs = setting.leadMinutes * 60_000
          const reminderTime = eventTime - leadMs
          if (now >= reminderTime && now <= eventTime) {
            const lastTriggered = setting.lastTriggered
              ? new Date(setting.lastTriggered).getTime()
              : 0
            if (lastTriggered < reminderTime) {
              new Notification(event.title, {
                body: `${formatDateDisplay(new Date(event.date))} · ${formatTimeDisplay(new Date(event.date))}\n${event.description}`,
              })
              updated[eventId] = {
                ...setting,
                lastTriggered: new Date().toISOString(),
              }
              changed = true
            }
          }
        }

        return changed ? updated : current
      })
    }

    const interval = window.setInterval(runCheck, 60_000)
    runCheck()
    return () => window.clearInterval(interval)
  }, [events, notificationsSupported])

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    return events
      .filter((event) => new Date(event.date).getTime() >= now)
      .slice(0, 8)
  }, [events])

  const groupedEvents = useMemo(() => {
    const groups: Record<ScheduleEvent['type'], ScheduleEvent[]> = {
      class: [],
      assignment: [],
      exam: [],
      milestone: [],
      other: [],
    }
    for (const event of events) {
      groups[event.type].push(event)
    }
    return groups
  }, [events])

  const weeklyEvents = useMemo(() => {
    const start = startOfWeek(selectedWeek, 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return events.filter((event) => {
      const date = new Date(event.date)
      return date >= start && date < end
    })
  }, [events, selectedWeek])

  const stats = useMemo(() => {
    const counts = Object.fromEntries(
      (Object.keys(typeLabels) as ScheduleEvent['type'][]).map((key) => [
        key,
        groupedEvents[key].length,
      ]),
    ) as Record<ScheduleEvent['type'], number>
    return {
      total: events.length,
      ...counts,
    }
  }, [events.length, groupedEvents])

  const handleParse = () => {
    try {
      const parsed = parseSchedule(inputText, year)
      if (parsed.length === 0) {
        setError('We could not find any recognisable dates. Try cleaning up the text or adding month names.')
        setEvents([])
        return
      }
      setEvents(parsed)
      setError(null)
      const reference = parsed[0]
      setSelectedWeek(startOfWeek(new Date(reference.date), 1))
      setHasInitializedWeek(true)
    } catch (parseError) {
      console.error(parseError)
      setError('Something went wrong while parsing. Please try a simpler chunk of the schedule.')
    }
  }

  const handleClear = () => {
    setInputText('')
    setEvents([])
    setReminders({})
    setError(null)
    setHasInitializedWeek(false)
  }

  const handleReminderChange = async (eventId: string, leadMinutes: number) => {
    if (!notificationsSupported) {
      alert('Browser notifications are not supported here, but you can still export the calendar to stay on track.')
      return
    }

    if (leadMinutes === 0) {
      setReminders((current) => {
        const next = { ...current }
        delete next[eventId]
        return next
      })
      return
    }

    if (Notification.permission === 'default') {
      const permissionResult = await Notification.requestPermission()
      setNotificationPermission(permissionResult)
      if (permissionResult !== 'granted') {
        return
      }
    } else if (Notification.permission === 'denied') {
      setNotificationPermission('denied')
      return
    }

    setReminders((current) => ({
      ...current,
      [eventId]: {
        eventId,
        leadMinutes,
        lastTriggered: current[eventId]?.lastTriggered,
      },
    }))
  }

  const changeWeek = (direction: number) => {
    setSelectedWeek((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + direction * 7)
      return startOfWeek(next, 1)
    })
  }

  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(selectedWeek)
    day.setDate(day.getDate() + index)
    return day
  })

  return (
    <div className="app-shell">
      <header>
        <h1>Student Schedule Studio</h1>
        <p>
          Paste any chaotic syllabus schedule and watch it become a structured dashboard with a weekly layout,
          reminders, and a downloadable calendar file.
        </p>
      </header>

      <main>
        <section className="panel">
          <h2>Paste your schedule</h2>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="Drop in the table or outline from your syllabus."
          />
          <div className="control-row">
            <label htmlFor="year">Term year</label>
            <input
              id="year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number.parseInt(event.target.value, 10) || currentYear)}
            />
            <small className="helper">We will roll over into the next year if your schedule crosses December.</small>
          </div>
          {error ? <div className="error-text">{error}</div> : null}
          <div className="button-row">
            <button className="primary" type="button" onClick={handleParse}>
              Build dashboard
            </button>
            <button className="secondary" type="button" onClick={handleClear}>
              Clear all
            </button>
            <button className="secondary" type="button" onClick={() => setInputText(sampleSchedule)}>
              Use sample schedule
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Schedule dashboard</h2>
          {events.length === 0 ? (
            <div className="notice">
              Paste a schedule above to unlock the planner. We will keep everything in your browser — no accounts needed.
            </div>
          ) : (
            <div className="dashboard">
              <div className="card">
                <h3>Upcoming highlights</h3>
                <EventList
                  events={upcomingEvents}
                  emptyLabel="Nothing upcoming — enjoy the calm!"
                  reminders={reminders}
                  onReminderChange={handleReminderChange}
                  notificationsSupported={notificationsSupported}
                  notificationPermission={notificationPermission}
                />
              </div>
              <div className="card">
                <h3>Assignments & practice</h3>
                <EventList
                  events={groupedEvents.assignment}
                  emptyLabel="No assignments detected."
                  reminders={reminders}
                  onReminderChange={handleReminderChange}
                  notificationsSupported={notificationsSupported}
                  notificationPermission={notificationPermission}
                />
              </div>
              <div className="card">
                <h3>Exams & major checkpoints</h3>
                <EventList
                  events={[...groupedEvents.exam, ...groupedEvents.milestone]}
                  emptyLabel="No major exams or milestones yet."
                  reminders={reminders}
                  onReminderChange={handleReminderChange}
                  notificationsSupported={notificationsSupported}
                  notificationPermission={notificationPermission}
                />
              </div>
              <div className="card">
                <h3>Export & stats</h3>
                <p className="event-meta">Total items: {stats.total}</p>
                <ul className="event-meta" style={{ paddingLeft: '1rem', margin: 0 }}>
                  <li>Classes: {stats.class}</li>
                  <li>Assignments: {stats.assignment}</li>
                  <li>Exams: {stats.exam}</li>
                  <li>Milestones: {stats.milestone}</li>
                </ul>
                <button
                  className="primary"
                  type="button"
                  onClick={() => downloadICSFile(events)}
                  disabled={events.length === 0}
                >
                  Export to calendar (.ics)
                </button>
                {!notificationsSupported && (
                  <small className="helper">
                    Browser notifications are not available here, but calendar exports include a 1-day reminder.
                  </small>
                )}
                {notificationsSupported && notificationPermission === 'denied' ? (
                  <small className="helper">Notifications are blocked. Enable them in your browser settings to use reminders.</small>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="panel weekly-view">
          <div className="week-nav">
            <h2>Weekly layout</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => changeWeek(-1)}>
                ◀ Previous
              </button>
              <button type="button" onClick={() => setSelectedWeek(startOfWeek(today, 1))}>
                This week
              </button>
              <button type="button" onClick={() => changeWeek(1)}>
                Next ▶
              </button>
            </div>
          </div>
          <div className="event-meta">{getWeekRangeLabel(selectedWeek)}</div>
          {weeklyEvents.length === 0 ? (
            <div className="notice">
              No events on the selected week. Jump to another week or add more detail to your schedule.
            </div>
          ) : null}
          <div className="week-grid">
            {weekDays.map((day) => {
              const dayEvents = weeklyEvents.filter((event) => isSameDay(new Date(event.date), day))
              return (
                <div className="week-day" key={day.toISOString()}>
                  <h4>
                    {day.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h4>
                  <div className="day-events">
                    {dayEvents.length === 0 ? (
                      <span className="event-meta">No items</span>
                    ) : (
                      dayEvents.map((event) => (
                        <div className="chip" key={event.id}>
                          <strong>{event.title}</strong>
                          <span>
                            {formatTimeDisplay(new Date(event.date))} · {typeLabels[event.type]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

interface EventListProps {
  events: ScheduleEvent[]
  emptyLabel: string
  reminders: ReminderState
  onReminderChange: (eventId: string, leadMinutes: number) => void
  notificationsSupported: boolean
  notificationPermission: NotificationPermission
}

function EventList({
  events,
  emptyLabel,
  reminders,
  onReminderChange,
  notificationsSupported,
  notificationPermission,
}: EventListProps) {
  if (events.length === 0) {
    return <span className="event-meta">{emptyLabel}</span>
  }

  return (
    <div className="event-list">
      {events.map((item) => (
        <EventCard
          key={item.id}
          event={item}
          reminder={reminders[item.id]}
          onReminderChange={onReminderChange}
          notificationsSupported={notificationsSupported}
          notificationPermission={notificationPermission}
        />
      ))}
    </div>
  )
}

interface EventCardProps {
  event: ScheduleEvent
  reminder?: ReminderSetting
  onReminderChange: (eventId: string, leadMinutes: number) => void
  notificationsSupported: boolean
  notificationPermission: NotificationPermission
}

function EventCard({
  event: scheduleEvent,
  reminder,
  onReminderChange,
  notificationsSupported,
  notificationPermission,
}: EventCardProps) {
  const eventDate = new Date(scheduleEvent.date)
  const reminderValue = reminder?.leadMinutes ?? 0

  return (
    <div className="event-card">
      <div className="event-header">
        <h4 className="event-title">{scheduleEvent.title}</h4>
        <span className={`badge ${scheduleEvent.type}`}>{typeLabels[scheduleEvent.type]}</span>
      </div>
      <div className="event-meta">
        {formatDateDisplay(eventDate)} · {formatTimeDisplay(eventDate)}
      </div>
      <div className="event-meta">{scheduleEvent.description}</div>
      <div className="reminder-row">
        <label htmlFor={`reminder-${scheduleEvent.id}`} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
          Reminder
        </label>
        <select
          id={`reminder-${scheduleEvent.id}`}
          value={reminderValue}
          onChange={(changeEvent) =>
            onReminderChange(
              scheduleEvent.id,
              Number.parseInt(changeEvent.currentTarget.value, 10),
            )
          }
        >
          {reminderOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!notificationsSupported ? (
          <span className="event-meta">Uses ICS alarm instead</span>
        ) : null}
        {notificationsSupported && notificationPermission === 'denied' ? (
          <span className="event-meta">Enable notifications to activate reminders.</span>
        ) : null}
      </div>
    </div>
  )
}

export default App
