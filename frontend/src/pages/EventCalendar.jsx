import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks
} from "date-fns"

import Sidebar from "../components/Sidebar"
import { CATEGORY_FILTERS, getPolymarketCategoryMeta, getPolymarketMarketMeta } from "../utils/polymarketMarketMeta"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"
const CALENDAR_CACHE_TTL_MS = 90 * 1000
const TRACKABLE_CATEGORY_OPTIONS = CATEGORY_FILTERS.filter((item) => item.id !== "all")
const DEFAULT_TRACKED_CATEGORIES = TRACKABLE_CATEGORY_OPTIONS.map((item) => item.id)

function buildDayKey(value) {
  return format(value, "yyyy-MM-dd")
}

function formatEventTime(value) {
  if (!value) return "No time"
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return "No time"
  return format(parsed, "p")
}

function hasBacktest(metrics) {
  return Boolean(metrics && metrics.totalBacktests > 0)
}

function hasTradableBacktest(metrics) {
  return Boolean(hasBacktest(metrics) && metrics.totalTrades > 0)
}

function formatBacktestDate(value) {
  if (!value) return "N/A"
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return "N/A"
  return format(parsed, "MMM d, yyyy p")
}

function getCalendarEventMeta(event = {}) {
  return getPolymarketMarketMeta(
    event,
    "Polymarket Event"
  )
}

export default function EventCalendar() {
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState("month")
  const [focusDate, setFocusDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [includePast, setIncludePast] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_TRACKED_CATEGORIES)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState("")
  const [reportData, setReportData] = useState(null)
  const [reportEvent, setReportEvent] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchCalendarEvents() {
      try {
        setLoading(true)
        setError("")

        const token = localStorage.getItem("token")
        const params = new URLSearchParams({
          categories: selectedCategories.join(","),
          includePast: includePast ? "true" : "false",
            upcomingLimit: "300",
            pastLimit: "0"
          })
          const cacheKey = `calendar-events:${params.toString()}`
          const rawCached = sessionStorage.getItem(cacheKey)
        if (rawCached) {
          try {
            const parsedCached = JSON.parse(rawCached)
            if (
              parsedCached?.expiresAt > Date.now() &&
              Array.isArray(parsedCached?.events)
            ) {
              setEvents(parsedCached.events)
              setLoading(false)
              return
            }
          } catch {
            // Ignore malformed cache and continue with network request.
          }
        }

        const response = await fetch(`${API_BASE}/polymarket/calendar-events?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load calendar events")
        }

        const data = await response.json()
        const fetchedEvents = Array.isArray(data.events) ? data.events : []
        setEvents(fetchedEvents)
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS,
            events: fetchedEvents
          })
        )
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Failed to load events")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarEvents()

    return () => controller.abort()
  }, [includePast, selectedCategories])

  const calendarRange = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(focusDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(focusDate, { weekStartsOn: 1 })
      return {
        start: weekStart,
        end: weekEnd,
        days: eachDayOfInterval({ start: weekStart, end: weekEnd })
      }
    }

    const monthStart = startOfMonth(focusDate)
    const monthEnd = endOfMonth(focusDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    return {
      start: calendarStart,
      end: calendarEnd,
      days: eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }
  }, [focusDate, viewMode])

  const eventsByDay = useMemo(() => {
    const grouped = new Map()

    for (const event of events) {
      if (!event?.eventDate) continue
      const eventDate = parseISO(event.eventDate)
      if (Number.isNaN(eventDate.getTime())) continue

      const dayKey = buildDayKey(eventDate)
      const existing = grouped.get(dayKey) || []
      existing.push(event)
      existing.sort((firstEvent, secondEvent) =>
        new Date(firstEvent.eventDate).getTime() - new Date(secondEvent.eventDate).getTime()
      )
      grouped.set(dayKey, existing)
    }

    return grouped
  }, [events])

  const selectedDayEvents = useMemo(() => {
    const dayKey = buildDayKey(selectedDay)
    return eventsByDay.get(dayKey) || []
  }, [eventsByDay, selectedDay])

  const pastEvents = useMemo(() => {
    return events
      .filter((event) => event.status === "past")
      .sort((firstEvent, secondEvent) => new Date(secondEvent.eventDate) - new Date(firstEvent.eventDate))
      .slice(0, 8)
  }, [events])

  const pastEventCount = useMemo(() => {
    return events.filter((event) => event.status === "past").length
  }, [events])

  const backtestedEventCount = useMemo(() => {
    return events.filter(
      (event) => event.status === "past" && hasBacktest(event.backtestMetrics)
    ).length
  }, [events])

  const handlePeriodStep = (direction) => {
    if (viewMode === "week") {
      setFocusDate((currentDate) => (direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)))
      return
    }

    setFocusDate((currentDate) => (direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1)))
  }

  const toggleCategory = (categoryId) => {
    setSelectedCategories((currentCategories) => {
      if (currentCategories.includes(categoryId)) {
        if (currentCategories.length === 1) {
          return currentCategories
        }
        return currentCategories.filter((category) => category !== categoryId)
      }

      return [...currentCategories, categoryId]
    })
  }

  const openAnalysis = (event) => {
    if (!event?.analysisPath) {
      navigate("/polymarket")
      return
    }

    navigate(event.analysisPath)
  }

  const openBacktestReport = async (event, backtestId) => {
    if (!backtestId) return

    setReportEvent(event)
    setReportModalOpen(true)
    setReportLoading(true)
    setReportError("")
    setReportData(null)

    try {
      const response = await fetch(`${API_BASE}/polymarket/backtest/report/${backtestId}`)
      if (!response.ok) {
        throw new Error("Failed to load backtest report")
      }
      const data = await response.json()
      setReportData(data.report || null)
    } catch (fetchError) {
      setReportError(fetchError.message || "Failed to load report")
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="ml-64 flex-1 p-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Events Calendar</h1>
            <p className="mt-2 text-slate-600">
              Track upcoming and previous events using the same market category groups as Polymarket.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                viewMode === "week"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Week View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                viewMode === "month"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Month View
            </button>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {TRACKABLE_CATEGORY_OPTIONS.map((categoryOption) => {
                const category = getPolymarketCategoryMeta(categoryOption.id)
                return (
                <button
                  key={categoryOption.id}
                  type="button"
                  onClick={() => toggleCategory(categoryOption.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selectedCategories.includes(categoryOption.id)
                      ? `${category.chip} border-current`
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {category.label}
                </button>
              )})}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(event) => setIncludePast(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Include previous events
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Past Events</div>
              <div className="text-lg font-semibold text-slate-900">{pastEventCount}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">Backtested Events</div>
              <div className="text-lg font-semibold text-emerald-800">{backtestedEventCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Coverage</div>
              <div className="text-lg font-semibold text-slate-900">
                {pastEventCount > 0 ? `${((backtestedEventCount / pastEventCount) * 100).toFixed(1)}%` : "0.0%"}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">
              {viewMode === "week"
                ? `Week of ${format(calendarRange.start, "MMM d, yyyy")}`
                : format(focusDate, "MMMM yyyy")}
            </h2>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePeriodStep("prev")}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setFocusDate(new Date())}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePeriodStep("next")}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Backtest indicator: top-right percentage on a date means that day has past events with backtests.
            Green &gt;= 60%, Amber &gt;= 50%, Red &lt; 50%.
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
              <div key={dayName} className="py-2">
                {dayName}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500">Loading calendar events...</div>
          ) : error ? (
            <div className="py-16 text-center text-rose-600">{error}</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {calendarRange.days.map((day) => {
                const dayKey = buildDayKey(day)
                const dayEvents = eventsByDay.get(dayKey) || []
                const isCurrentMonth = isSameMonth(day, focusDate)
                const isSelected = isSameDay(day, selectedDay)

                    // Calculate backtest metrics for this day
                    const pastEventsOnDay = dayEvents.filter(e => e.status === "past")
                    const backtestMetricsOnDay = pastEventsOnDay
                      .filter(e => hasTradableBacktest(e.backtestMetrics))
                      .map(e => e.backtestMetrics)
                
                    const avgWinRateOnDay = backtestMetricsOnDay.length > 0
                      ? backtestMetricsOnDay.reduce((sum, m) => sum + m.avgWinRate, 0) / backtestMetricsOnDay.length
                      : null
                
                    // Color coding based on win rate
                    const getBacktestColor = (winRate) => {
                      if (!winRate) return ""
                      if (winRate >= 60) return "bg-emerald-100 border-emerald-300"
                      if (winRate >= 50) return "bg-amber-100 border-amber-300"
                      return "bg-rose-100 border-rose-300"
                    }
                
                    const getBacktestText = (winRate) => {
                      if (!winRate) return ""
                      if (winRate >= 60) return "text-emerald-700"
                      if (winRate >= 50) return "text-amber-700"
                      return "text-rose-700"
                    }

                    return (
                      <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[110px] rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-900/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                        } ${isCurrentMonth ? "opacity-100" : "opacity-55"} ${avgWinRateOnDay ? getBacktestColor(avgWinRateOnDay) : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold ${
                          isToday(day)
                            ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white"
                            : "text-slate-800"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                          <div className="flex gap-1 items-center">
                            {dayEvents.length > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {dayEvents.length}
                              </span>
                            )}
                            {avgWinRateOnDay !== null && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getBacktestText(avgWinRateOnDay)} bg-white`}>
                                {avgWinRateOnDay.toFixed(0)}%
                              </span>
                            )}
                          </div>
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const eventMeta = getCalendarEventMeta(event)
                        const category = getPolymarketCategoryMeta(eventMeta.categoryId)
                        return (
                          <div
                            key={event.id}
                            className={`truncate rounded-md border px-2 py-1 text-[11px] ${category.chip}`}
                            title={eventMeta.displayName}
                          >
                            {eventMeta.displayName}
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[11px] text-slate-500">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">
              {format(selectedDay, "EEEE, MMM d")}
            </h3>

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No events in selected categories on this day.</p>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((event) => {
                  const eventMeta = getCalendarEventMeta(event)
                  const category = getPolymarketCategoryMeta(eventMeta.categoryId)
                  const isPastEvent = event.status === "past"
                  const hasBacktestData = hasBacktest(event.backtestMetrics)
                  const primaryBacktestId = event.backtestMetrics?.matchedBacktestIds?.[0]

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openAnalysis(event)}
                        className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-slate-400 transition"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className={`rounded-full border px-2 py-0.5 ${category.chip}`}>{category.label}</span>
                        <span className={`rounded-full px-2 py-0.5 ${isPastEvent ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                          {isPastEvent ? "Past" : "Upcoming"}
                        </span>
                        <span className="text-slate-500">{formatEventTime(event.eventDate)}</span>
                      </div>

                      <div className="mt-2 flex gap-3">
                        <img
                          src={eventMeta.imageUrl}
                          alt={eventMeta.displayName}
                          className="h-12 w-20 rounded-md object-cover"
                        />
                        <p className="line-clamp-2 font-medium text-slate-800">{eventMeta.displayName}</p>
                      </div>

                        {isPastEvent && hasBacktestData && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                            <div className="text-xs font-semibold text-slate-900">📊 Backtest Results:</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-600">Win Rate:</span>
                                <div className={`text-sm font-bold ${event.backtestMetrics.avgWinRate >= 50 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {hasTradableBacktest(event.backtestMetrics) ? `${event.backtestMetrics.avgWinRate.toFixed(1)}%` : "--"}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-600">Avg ROI:</span>
                                <div className={`text-sm font-bold ${event.backtestMetrics.avgRoi >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {hasTradableBacktest(event.backtestMetrics)
                                    ? `${event.backtestMetrics.avgRoi > 0 ? "+" : ""}${event.backtestMetrics.avgRoi.toFixed(2)}%`
                                    : "--"}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-600">Best ROI:</span>
                                <div className="text-sm font-bold text-emerald-600">
                                  {hasTradableBacktest(event.backtestMetrics) ? `+${event.backtestMetrics.bestRoi.toFixed(2)}%` : "--"}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-600">Worst ROI:</span>
                                <div className={`text-sm font-bold ${event.backtestMetrics.worstRoi >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {hasTradableBacktest(event.backtestMetrics)
                                    ? `${event.backtestMetrics.worstRoi > 0 ? "+" : ""}${event.backtestMetrics.worstRoi.toFixed(2)}%`
                                    : "--"}
                                </div>
                              </div>
                            </div>
                            <div className="pt-1 text-xs text-slate-500">
                              {event.backtestMetrics.totalBacktests} backtest{event.backtestMetrics.totalBacktests !== 1 ? "s" : ""} • {event.backtestMetrics.totalTrades} total trades • {event.backtestMetrics.strategies.join(", ")}
                            </div>
                            {primaryBacktestId && (
                              <button
                                type="button"
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation()
                                  openBacktestReport(event, primaryBacktestId)
                                }}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                View Backtest Report
                              </button>
                            )}
                          </div>
                        )}

                      <div className="mt-2 text-xs text-slate-500">
                        {event.topOutcome && event.topProbability !== null
                          ? `Market leaning ${event.topOutcome} (${event.topProbability}%)`
                          : "Open analysis"}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Previous Events</h3>

            {pastEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No previous events loaded.</p>
            ) : (
              <div className="space-y-3">
                {pastEvents.map((event) => {
                  const eventMeta = getCalendarEventMeta(event)
                  const category = getPolymarketCategoryMeta(eventMeta.categoryId)
                  const hasBacktestData = hasBacktest(event.backtestMetrics)
                  const hasTradableData = hasTradableBacktest(event.backtestMetrics)
                  const primaryBacktestId = event.backtestMetrics?.matchedBacktestIds?.[0]
                  const winRateStatus = hasBacktestData
                    ? hasTradableData
                      ? event.backtestMetrics.avgWinRate >= 60
                        ? "success"
                        : event.backtestMetrics.avgWinRate >= 50
                        ? "neutral"
                        : "warning"
                      : "neutral"
                    : null
                  
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openAnalysis(event)}
                        className={`w-full rounded-lg border  p-3 text-left transition ${
                          hasBacktestData
                            ? winRateStatus === "success"
                              ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                              : winRateStatus === "neutral"
                              ? "border-amber-200 bg-amber-50 hover:border-amber-400"
                              : "border-rose-200 bg-rose-50 hover:border-rose-400"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${category.chip}`}>{category.label}</span>
                            {hasBacktestData && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                winRateStatus === "success"
                                  ? "bg-emerald-200 text-emerald-800"
                                  : winRateStatus === "neutral"
                                  ? "bg-amber-200 text-amber-800"
                                  : "bg-rose-200 text-rose-800"
                              }`}>
                                ✓ Backtested
                              </span>
                            )}
                            {!hasBacktestData && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                Not backtested
                              </span>
                            )}
                          </div>
                        <span className="text-xs text-slate-500">{format(parseISO(event.eventDate), "MMM d, yyyy")}</span>
                      </div>
                        <div className="mb-2 flex gap-3">
                          <img
                            src={eventMeta.imageUrl}
                            alt={eventMeta.displayName}
                            className="h-12 w-20 rounded-md object-cover"
                          />
                          <p className={`line-clamp-2 text-sm font-medium ${
                          hasBacktestData
                            ? hasTradableData
                              ? winRateStatus === "success"
                                ? "text-emerald-900"
                                : winRateStatus === "neutral"
                                ? "text-amber-900"
                                : "text-rose-900"
                              : "text-amber-900"
                            : "text-slate-800"
                        }`}>
                            {eventMeta.displayName}
                          </p>
                        </div>
                      
                      {hasBacktestData && (
                          <div className="mt-2 space-y-2 border-t border-current border-opacity-10 pt-2">
                            <div className="flex items-end justify-between gap-3">
                              <div className="flex gap-4">
                                <div>
                                  <span className="block text-xs opacity-75 mb-0.5">Win Rate</span>
                                  <span className={`text-lg font-bold ${
                                    hasTradableData
                                      ? event.backtestMetrics.avgWinRate >= 60 ? "text-emerald-600"
                                        : event.backtestMetrics.avgWinRate >= 50 ? "text-amber-600"
                                        : "text-rose-600"
                                      : "text-slate-500"
                                  }`}>
                                    {hasTradableData ? `${event.backtestMetrics.avgWinRate.toFixed(0)}%` : "--"}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-xs opacity-75 mb-0.5">Avg ROI</span>
                                  <span className={`text-lg font-bold ${hasTradableData ? (event.backtestMetrics.avgRoi >= 0 ? "text-emerald-600" : "text-rose-600") : "text-slate-500"}`}>
                                    {hasTradableData
                                      ? `${event.backtestMetrics.avgRoi > 0 ? "+" : ""}${event.backtestMetrics.avgRoi.toFixed(1)}%`
                                      : "--"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs opacity-75">{event.backtestMetrics.totalBacktests} backtest{event.backtestMetrics.totalBacktests !== 1 ? "s" : ""}</div>
                                <div className="text-xs opacity-75">{event.backtestMetrics.totalTrades} trades</div>
                              </div>
                            </div>
                            <div className="text-xs opacity-60">
                              Strategies: {event.backtestMetrics.strategies.join(", ")}
                            </div>
                            {primaryBacktestId && (
                              <button
                                type="button"
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation()
                                  openBacktestReport(event, primaryBacktestId)
                                }}
                                className="mt-1 rounded-md border border-current border-opacity-30 bg-white/80 px-2.5 py-1 text-xs font-semibold"
                              >
                                View Backtest Report
                              </button>
                            )}
                          </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {reportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Backtest Report</h2>
                  <p className="text-sm text-slate-500">{reportEvent?.question || "Selected event"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReportModalOpen(false)
                    setReportData(null)
                    setReportError("")
                    setReportEvent(null)
                  }}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
                {reportLoading ? (
                  <div className="py-10 text-center text-slate-500">Loading report...</div>
                ) : reportError ? (
                  <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{reportError}</div>
                ) : !reportData ? (
                  <div className="py-10 text-center text-slate-500">No report data available.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-6">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Model</div>
                        <div className="font-semibold text-slate-900">{reportData.backtest.strategyName}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Group</div>
                        <div className="font-semibold text-slate-900">{reportData.backtest.groupName || "N/A"}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Run At</div>
                        <div className="font-semibold text-slate-900 text-xs">{formatBacktestDate(reportData.backtest.createdAt)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Closed Trades</div>
                        <div className="font-semibold text-slate-900">{reportData.backtest.totalTrades}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Win Rate</div>
                        <div className="font-semibold text-emerald-700">{reportData.backtest.winRate.toFixed(2)}%</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">ROI</div>
                        <div className={`font-semibold ${reportData.backtest.roi >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {reportData.backtest.roi > 0 ? "+" : ""}
                          {reportData.backtest.roi.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200">
                      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
                        Trade Log ({reportData.summary.transactionCount} transactions)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left">
                            <tr>
                              <th className="px-3 py-2 font-semibold text-slate-700">#</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Time</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Action</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Market</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Price</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Amount</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">P/L</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportData.trades.map((trade) => (
                              <tr key={`${trade.index}-${trade.time}-${trade.action}`} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-600">{trade.index}</td>
                                <td className="px-3 py-2 text-slate-600 text-xs">{formatBacktestDate(trade.time)}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${trade.action === "BUY" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                    {trade.action}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="max-w-[280px] truncate font-medium text-slate-800" title={trade.marketQuestion || trade.marketId}>
                                    {trade.marketQuestion || trade.marketId}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{trade.marketId}</div>
                                </td>
                                <td className="px-3 py-2 text-slate-700">${Number(trade.price || 0).toFixed(4)}</td>
                                <td className="px-3 py-2 text-slate-700">${Number(trade.amount || 0).toFixed(2)}</td>
                                <td className={`px-3 py-2 font-semibold ${trade.profit === null ? "text-slate-400" : trade.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {trade.profit === null ? "--" : `${trade.profit > 0 ? "+" : ""}$${Number(trade.profit).toFixed(2)}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
