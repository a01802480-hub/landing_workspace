/**
 * Google Calendar Widget — embedded calendar view with offline fallback.
 *
 * Primary storage: browser localStorage (always works, no backend needed).
 * Secondary: backend calendar API (syncs when available).
 *
 * To connect to real Google Calendar:
 *   1. Set up Google Cloud project, enable Calendar API
 *   2. Set GOOGLE_CALENDAR_CREDENTIALS env var on backend
 *   3. Set CALENDAR_MODE=google on backend
 *   4. Click "Connect Google Calendar" in this widget
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import { WidgetShell } from './WidgetShell'
import {
  fetchEvents,
  createEvent as apiCreateEvent,
  deleteEvent as apiDeleteEvent,
  fetchCalendarConfig,
  fetchAuthUrl,
  type CalendarEvent,
  type EventColor,
  type CalendarConfig,
} from '../../services/calendar'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const EVENT_COLORS: Record<EventColor, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
}

const DOT_COLORS: Record<EventColor, string> = {
  indigo: 'bg-indigo-400', emerald: 'bg-emerald-400', blue: 'bg-blue-400',
  amber: 'bg-amber-400', purple: 'bg-purple-400', rose: 'bg-rose-400',
}

const COLOR_OPTIONS: EventColor[] = ['indigo', 'emerald', 'blue', 'amber', 'purple', 'rose']

// ─── LocalStorage event store (works 100% offline) ──────────────────────
const LOCAL_STORE_KEY = 'biostream-calendar-events'

function loadLocalEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return getSeedEvents()
}

function saveLocalEvents(events: CalendarEvent[]): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(events))
  } catch { /* quota exceeded — silently ignore */ }
}

function getSeedEvents(): CalendarEvent[] {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const d = (offset: number) => {
    const dt = new Date(now)
    dt.setDate(dt.getDate() + offset)
    return dt.toISOString().split('T')[0]
  }
  const events: CalendarEvent[] = [
    { id: 'seed_1', title: 'Sequence alignment review', description: 'Review Clustal Omega results', start: `${today}T10:00:00`, end: `${today}T11:00:00`, location: 'Lab', color: 'indigo', all_day: false },
    { id: 'seed_2', title: 'UniProt database search', description: 'Search homologs via BLAST', start: `${today}T14:00:00`, end: `${today}T15:30:00`, location: '', color: 'emerald', all_day: false },
    { id: 'seed_3', title: 'BLAST query batch run', description: '50 sequences', start: `${d(1)}T09:00:00`, end: `${d(1)}T12:00:00`, location: '', color: 'blue', all_day: false },
    { id: 'seed_4', title: 'Protein structure analysis', description: 'AlphaFold predictions', start: `${d(2)}T14:00:00`, end: `${d(2)}T16:00:00`, location: 'Bioinformatics Lab', color: 'amber', all_day: false },
    { id: 'seed_5', title: 'Weekly lab meeting', description: 'GWAS results discussion', start: `${d(3)}T11:00:00`, end: `${d(3)}T12:00:00`, location: 'Conference Room A', color: 'purple', all_day: false },
    { id: 'seed_6', title: 'GWAS results review', description: 'Review findings', start: `${d(5)}T15:30:00`, end: `${d(5)}T17:00:00`, location: '', color: 'rose', all_day: false },
  ]
  saveLocalEvents(events)
  return events
}

// ─── Component ───────────────────────────────────────────────────────────
export function GoogleCalendarWidget({ onRemove }: { onRemove?: () => void }) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadLocalEvents())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState(false)

  // --- Try backend sync on mount (non-blocking, falls back to localStorage) ---
  useEffect(() => {
    let cancelled = false
    fetchCalendarConfig()
      .then(cfg => { if (!cancelled) { setConfig(cfg); setBackendAvailable(true) } })
      .catch(() => { if (!cancelled) { setConfig({ mode: 'local', authorized: true, auth_url: '', calendar_id: 'local' }); setBackendAvailable(false) } })
    return () => { cancelled = true }
  }, [])

  // --- Load events: try backend, fall back to localStorage ---
  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!backendAvailable) {
        // Offline: load directly from localStorage
        setEvents(loadLocalEvents())
        setLoading(false)
        return
      }
      const tMin = new Date(currentYear, currentMonth, 1).toISOString()
      const tMax = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59).toISOString()
      const response = await fetchEvents(tMin, tMax, 200)
      setEvents(response.events)
      // Also sync to localStorage so offline mode has latest data
      saveLocalEvents(response.events)
    } catch (err: any) {
      console.warn('Calendar: backend fetch failed, using localStorage:', err.message)
      setEvents(loadLocalEvents())
    } finally {
      setLoading(false)
    }
  }, [currentMonth, currentYear, backendAvailable])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // --- Handle Google OAuth connect ---
  const handleConnectGoogle = async () => {
    try {
      const { auth_url } = await fetchAuthUrl()
      if (auth_url) window.open(auth_url, '_blank', 'width=600,height=700')
    } catch (err: any) {
      setError(err.message)
    }
  }

  // --- Calendar math ---
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate()

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const calendarDays = useMemo(() => {
    const days: Array<{day: number; month: 'prev' | 'current' | 'next'; isToday: boolean; dateStr: string}> = []
    // Previous month fill
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const date = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, d)
      days.push({ day: d, month: 'prev', isToday: false, dateStr: date.toISOString().split('T')[0] })
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i)
      days.push({
        day: i,
        month: 'current',
        isToday: i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear(),
        dateStr: date.toISOString().split('T')[0],
      })
    }
    // Next month fill
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, i)
      days.push({ day: i, month: 'next', isToday: false, dateStr: date.toISOString().split('T')[0] })
    }
    return days
  }, [currentMonth, currentYear, firstDay, daysInMonth, prevMonthDays, today])

  const getEventsForDay = (dateStr: string, month: 'prev' | 'current' | 'next') => {
    if (month !== 'current') return []
    return events.filter(e => {
      const eventDate = e.all_day ? e.start.split('T')[0] : e.start.split('T')[0]
      return eventDate === dateStr
    })
  }

  // --- Add event ---
  const handleAddEvent = async (title: string) => {
    if (!title.trim() || addingEvent) return
    setAddingEvent(true)
    try {
      const now = new Date()
      const start = new Date(currentYear, currentMonth, now.getDate(), 10, 0, 0).toISOString()
      const end = new Date(currentYear, currentMonth, now.getDate(), 11, 0, 0).toISOString()
      const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]
      const newEvent: CalendarEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: title.trim(),
        description: '',
        start, end, location: '',
        color: randomColor,
        all_day: false,
      }

      if (backendAvailable) {
        try {
          await apiCreateEvent({ title: title.trim(), start, end, color: randomColor })
          await loadEvents()
          return
        } catch (err: any) {
          console.warn('Calendar: backend create failed, saving locally:', err.message)
        }
      }

      // Local fallback
      const all = loadLocalEvents()
      all.push(newEvent)
      saveLocalEvents(all)
      setEvents(all)
    } finally {
      setAddingEvent(false)
    }
  }

  // --- Delete event ---
  const handleDeleteEvent = async (eventId: string) => {
    if (backendAvailable) {
      try {
        await apiDeleteEvent(eventId)
      } catch (err: any) {
        console.warn('Calendar: backend delete failed, removing locally:', err.message)
      }
    }
    // Always remove from local state
    const updated = events.filter(e => e.id !== eventId)
    setEvents(updated)
    saveLocalEvents(updated)
  }

  return (
    <WidgetShell
      title="Calendar"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
      color="rose"
      onRemove={onRemove}
      onRefresh={loadEvents}
      actions={
        <div className="flex items-center gap-1">
          {/* Google Calendar connect button */}
          {config?.mode === 'google' && !config?.authorized && (
            <button
              onClick={handleConnectGoogle}
              className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-white text-rose-600 shadow-sm hover:bg-rose-50 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect
            </button>
          )}
          {(['month','week','agenda'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${view === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      {/* Error banner */}
      {error && (
        <div className="px-2 py-1.5 bg-red-50 border-b border-red-100 text-[10px] text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-medium" title="Dismiss error" aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-rose-400 border-t-transparent" />
        </div>
      )}

      {/* Mode badge */}
      {config?.mode === 'google' && config?.authorized && (
        <div className="px-2 py-0.5 bg-rose-50 border-b border-rose-100 text-[9px] text-rose-500 flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-rose-400" />
          Google Calendar synced
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
        <button onClick={prevMonth} className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500" title="Previous month" aria-label="Previous month">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-[11px] font-semibold text-slate-700">{MONTHS[currentMonth]} {currentYear}</span>
        <button onClick={nextMonth} className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500" title="Next month" aria-label="Next month">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {view === 'month' && (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 px-1 py-1 border-b border-slate-50">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[9px] font-semibold text-slate-400 uppercase py-0.5">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px px-1 py-0.5">
            {calendarDays.map((d, i) => {
              const dayEvents = getEventsForDay(d.dateStr, d.month)
              return (
                <div
                  key={i}
                  className={`
                    aspect-square flex flex-col items-center justify-start p-0.5 rounded-sm text-[10px] cursor-default relative
                    ${d.month === 'current' ? 'text-slate-700' : 'text-slate-300'}
                    ${d.isToday ? 'bg-indigo-50 ring-1 ring-indigo-200 font-bold' : 'hover:bg-slate-50'}
                  `}
                  title={dayEvents.map(e => e.title).join('\n')}
                >
                  <span className={d.isToday ? 'text-indigo-600' : ''}>{d.day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <div key={j} className={`w-1 h-1 rounded-full ${DOT_COLORS[ev.color] || 'bg-indigo-400'}`} />
                      ))}
                    </div>
                  )}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] text-slate-400">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'agenda' && (
        <div className="p-2 space-y-1 overflow-y-auto max-h-48">
          {events
            .filter(e => {
              const eventDate = new Date(e.start)
              const cmStart = new Date(currentYear, currentMonth, 1)
              const cmEnd = new Date(currentYear, currentMonth + 2, 0)
              return eventDate >= cmStart && eventDate <= cmEnd
            })
            .slice(0, 15)
            .map((ev, i) => (
              <div key={ev.id || i} className={`flex items-center gap-2 px-2 py-1.5 rounded border group ${EVENT_COLORS[ev.color] || EVENT_COLORS.indigo} text-[10px] relative`}>
                <div className="font-semibold text-slate-700 w-8 text-center shrink-0">
                  {new Date(ev.start).getDate()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{ev.title}</div>
                  {!ev.all_day && (
                    <div className="text-[9px] opacity-70">
                      {new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {ev.end && ` — ${new Date(ev.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  )}
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id) }}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                  title="Delete event"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          {events.length === 0 && !loading && (
            <p className="text-[10px] text-slate-400 text-center py-4">No events this month</p>
          )}
        </div>
      )}

      {view === 'week' && (
        <div className="p-2 overflow-y-auto max-h-48">
          <div className="space-y-1">
            {DAYS.map((day, i) => {
              const dayNum = today.getDate() - today.getDay() + i
              const dateStr = new Date(today.getFullYear(), today.getMonth(), dayNum).toISOString().split('T')[0]
              const dayEvents = events.filter(e => {
                const eventDate = e.all_day ? e.start.split('T')[0] : e.start.split('T')[0]
                return eventDate === dateStr
              })
              return (
                <div key={day} className="flex items-start gap-2 text-[10px] group">
                  <div className="w-14 text-right shrink-0 font-semibold text-slate-500 pt-0.5">
                    {day} {dayNum}
                  </div>
                  <div className="flex-1">
                    {dayEvents.map((ev, j) => (
                      <div key={ev.id || j} className={`px-2 py-0.5 rounded border mb-0.5 flex items-center justify-between ${EVENT_COLORS[ev.color] || EVENT_COLORS.indigo}`}>
                        <div>
                          {!ev.all_day && ev.start && (
                            <span className="font-medium">
                              {new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' — '}
                            </span>
                          )}
                          {ev.title}
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 ml-1 shrink-0"
                          title="Delete event"
                          aria-label="Delete event"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    {dayEvents.length === 0 && <div className="text-slate-300 py-0.5">—</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add event quick input */}
      <div className="border-t border-slate-100 px-2 py-1.5 flex gap-1">
        <input
          type="text"
          placeholder={addingEvent ? 'Adding...' : '+ Add event...'}
          disabled={addingEvent}
          className="flex-1 text-[10px] px-2 py-1 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-rose-300 outline-none transition-colors disabled:opacity-50"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.currentTarget.value.trim() && !addingEvent) {
              handleAddEvent(e.currentTarget.value.trim())
              e.currentTarget.value = ''
            }
          }}
        />
      </div>
    </WidgetShell>
  )
}

export default GoogleCalendarWidget
