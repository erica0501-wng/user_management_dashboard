import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import {
  getArchiveGaps,
  getArchiveQualityReports,
  getArchiveStatus,
  getReplaySlice,
  getReplayWindows,
  runArchiveQualityReport,
} from "../services/polymarketArchive"

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

const formatDateTime = (value) => {
  if (!value) return "N/A"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

const buildCoverageTone = (value) => {
  if (value >= 90) return "bg-emerald-500"
  if (value >= 60) return "bg-amber-500"
  return "bg-rose-500"
}

const metricCards = (status) => [
  {
    label: "Market coverage",
    value: formatPercent(status?.summary?.marketCoveragePct),
    helper: `${status?.summary?.marketSnapshotCount || 0} snapshots`,
  },
  {
    label: "Order book coverage",
    value: formatPercent(status?.summary?.orderBookCoveragePct),
    helper: `${status?.summary?.orderBookSnapshotCount || 0} snapshots`,
  },
  {
    label: "Tracked markets",
    value: status?.summary?.distinctMarkets || 0,
    helper: `${status?.summary?.distinctTokens || 0} tokens`,
  },
  {
    label: "Archive freshness",
    value:
      status?.summary?.staleMinutes === null || status?.summary?.staleMinutes === undefined
        ? "N/A"
        : `${status.summary.staleMinutes}m`,
    helper: status?.summary?.latestSnapshotAt
      ? `Latest ${formatDateTime(status.summary.latestSnapshotAt)}`
      : "No snapshots yet",
  },
]

export default function PolymarketArchive() {
  const [windowHours, setWindowHours] = useState(24)
  const [minCoveragePct, setMinCoveragePct] = useState(90)
  const [gapType, setGapType] = useState("market")
  const [archiveApiAvailable, setArchiveApiAvailable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(null)
  const [gaps, setGaps] = useState([])
  const [replayWindows, setReplayWindows] = useState([])
  const [replaySlice, setReplaySlice] = useState(null)
  const [qualityReports, setQualityReports] = useState([])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const loadArchiveHealth = async ({ silent = false, force = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError("")

      if (archiveApiAvailable === false && !force) {
        return
      }

      const statusResult = await getArchiveStatus({ windowHours })
      setStatus(statusResult)
      setArchiveApiAvailable(true)

      const requests = [
        {
          key: "gaps",
          promise: getArchiveGaps({
            type: gapType,
            windowHours,
            limit: 8,
            maxMissingPerKey: 6,
            useObservedSpan: true,
          }),
        },
        {
          key: "windows",
          promise: getReplayWindows({ windowHours, minCoveragePct }),
        },
        {
          key: "slice",
          promise: getReplaySlice({ windowHours, minCoveragePct, maxIntervals: 300 }),
        },
        {
          key: "quality",
          promise: getArchiveQualityReports({ limit: 10, windowHours }),
        },
      ]

      const settled = await Promise.allSettled(requests.map((request) => request.promise))
      const failures = []

      settled.forEach((result, index) => {
        const requestKey = requests[index].key

        if (result.status === "fulfilled") {
          if (requestKey === "gaps") {
            setGaps(result.value.gaps || [])
          } else if (requestKey === "windows") {
            setReplayWindows(result.value.replayWindows || [])
          } else if (requestKey === "slice") {
            setReplaySlice(result.value)
          } else if (requestKey === "quality") {
            setQualityReports(result.value.reports || [])
          }
          return
        }

        const reason = result.reason
        if (requestKey === "slice" && reason?.status === 404) {
          setReplaySlice(null)
          return
        }

        failures.push(reason?.message || `${requestKey} load failed`)
      })

      if (failures.length > 0) {
        setError(failures.join(" | "))
      }
    } catch (loadError) {
      if (loadError?.status === 404) {
        setArchiveApiAvailable(false)
        setStatus(null)
        setGaps([])
        setReplayWindows([])
        setReplaySlice(null)
        setQualityReports([])
        setError(
          "Archive API is not available on the current backend deployment. Redeploy backend to include /polymarket/archive/* routes."
        )
      } else {
        setError(loadError.message || "Failed to load archive health")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadArchiveHealth()
  }, [windowHours, minCoveragePct, gapType])

  const handleGenerateQualityReport = async () => {
    try {
      if (archiveApiAvailable === false) {
        setError(
          "Archive API is not available on the current backend deployment. Redeploy backend first."
        )
        return
      }

      setIsGeneratingReport(true)
      setError("")
      await runArchiveQualityReport(windowHours)
      await loadArchiveHealth({ silent: true })
    } catch (runError) {
      setError(runError.message || "Failed to generate quality report")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const cards = metricCards(status)

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
            <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  Polymarket archive health
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Replay readiness for your trading stack
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    This page turns the new backend archive endpoints into an operational view: freshness,
                    missing buckets, replayable windows, and the exact replay slice shape your archive pipeline emits.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/polymarket"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                  >
                    Back to markets
                  </Link>
                  <button
                    onClick={() => loadArchiveHealth({ silent: true })}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    {refreshing ? "Refreshing..." : "Refresh health"}
                  </button>
                  <button
                    onClick={handleGenerateQualityReport}
                    disabled={isGeneratingReport}
                    className="rounded-xl border border-cyan-300/50 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGeneratingReport ? "Generating..." : "Run quality report"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Controls
                  </h2>
                  <span className="text-xs text-slate-400">Live from backend</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Window hours</span>
                    <select
                      value={windowHours}
                      onChange={(event) => setWindowHours(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {[6, 12, 24, 48].map((value) => (
                        <option key={value} value={value}>
                          {value}h
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Replay threshold</span>
                    <select
                      value={minCoveragePct}
                      onChange={(event) => setMinCoveragePct(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {[70, 80, 90, 100].map((value) => (
                        <option key={value} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Gap lens</span>
                    <select
                      value={gapType}
                      onChange={(event) => setGapType(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="market">Market snapshots</option>
                      <option value="orderbook">Order books</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
              {error}
            </section>
          ) : null}

          {archiveApiAvailable === false ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm">
                  Backend is running but does not include Archive Health endpoints yet.
                </p>
                <button
                  onClick={() => loadArchiveHealth({ silent: true, force: true })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  Retry detection
                </button>
              </div>
            </section>
          ) : null}

          {loading ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
              ))}
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <article key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-4 text-3xl font-bold text-slate-900">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </article>
              ))}
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Coverage and freshness</h2>
                  <p className="text-sm text-slate-500">Snapshot completeness across the selected archive window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {status?.intervalMinutes || 5} minute buckets
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Market coverage</span>
                    <span>{formatPercent(status?.summary?.marketCoveragePct)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${buildCoverageTone(status?.summary?.marketCoveragePct)}`}
                      style={{ width: `${Math.min(status?.summary?.marketCoveragePct || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Order book coverage</span>
                    <span>{formatPercent(status?.summary?.orderBookCoveragePct)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${buildCoverageTone(status?.summary?.orderBookCoveragePct)}`}
                      style={{ width: `${Math.min(status?.summary?.orderBookCoveragePct || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest snapshot</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatDateTime(status?.summary?.latestSnapshotAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest quality report</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatDateTime(status?.latestQualityReport?.generatedAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {status?.latestQualityReport?.notes || "No warnings in latest report"}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Replay slice preview</h2>
                <p className="text-sm text-slate-500">Exact payload shape emitted by archive replay slicing</p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Source window</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {replaySlice?.sourceWindow || "N/A"}
                    </p>
                    {!replaySlice ? (
                      <p className="mt-1 text-xs text-slate-500">No replayable slice for current threshold</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Populated intervals</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {replaySlice?.range?.populatedIntervals || 0}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950 p-4 text-slate-100">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slice range</p>
                  <div className="mt-3 space-y-2 font-mono text-xs">
                    <div>start: {replaySlice?.range?.start || "N/A"}</div>
                    <div>end: {replaySlice?.range?.end || "N/A"}</div>
                    <div>marketSnapshots: {replaySlice?.counts?.marketSnapshots || 0}</div>
                    <div>orderBookSnapshots: {replaySlice?.counts?.orderBookSnapshots || 0}</div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Largest current gaps</h2>
                  <p className="text-sm text-slate-500">The worst archive holes in the selected window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {gapType}
                </span>
              </div>

              <div className="space-y-3">
                {gaps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    No missing buckets detected for this filter.
                  </div>
                ) : (
                  gaps.map((gap) => (
                    <div key={gap.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {gapType === "orderbook"
                              ? gap.tokenId || gap.marketId || gap.key
                              : gap.question || gap.marketId || gap.tokenId}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {gapType === "orderbook"
                              ? `${gap.marketId ? `Market ${gap.marketId} • ` : ""}${gap.outcome || "Unknown outcome"}`
                              : `${gap.marketId ? `Market ${gap.marketId}` : gap.key}${gap.outcome ? ` • ${gap.outcome}` : ""}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-rose-600">{gap.missingIntervalsCount}</p>
                          <p className="text-xs text-slate-500">missing buckets</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <span>Coverage</span>
                        <span>{formatPercent(gap.coveragePct)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${buildCoverageTone(gap.coveragePct)}`}
                          style={{ width: `${Math.min(gap.coveragePct, 100)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Sample missing intervals: {(gap.missingIntervals || []).join(", ") || "None"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Replay windows</h2>
                <p className="text-sm text-slate-500">Contiguous windows that already meet your coverage threshold</p>
              </div>

              <div className="space-y-3">
                {replayWindows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    No replayable window yet. Let the archiver run longer.
                  </div>
                ) : (
                  replayWindows.map((window) => (
                    <div key={`${window.start}-${window.end}`} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDateTime(window.start)} to {formatDateTime(window.end)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {window.buckets} buckets ready for replay
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-slate-200">
                          <p className="text-xs text-slate-500">Min coverage</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatPercent(Math.min(window.minMarketCoveragePct, window.minOrderBookCoveragePct))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section>
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent quality reports</h2>
                  <p className="text-sm text-slate-500">Latest persisted health snapshots for this window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {qualityReports.length} records
                </span>
              </div>

              {qualityReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No quality report yet. Click "Run quality report" to generate one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-3 py-3">Generated</th>
                        <th className="px-3 py-3">Window</th>
                        <th className="px-3 py-3">Market Coverage</th>
                        <th className="px-3 py-3">Order Book Coverage</th>
                        <th className="px-3 py-3">Freshness</th>
                        <th className="px-3 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityReports.map((report) => (
                        <tr key={report.id} className="border-b border-slate-100 text-sm text-slate-700">
                          <td className="px-3 py-3">{formatDateTime(report.generatedAt)}</td>
                          <td className="px-3 py-3">{report.windowHours}h</td>
                          <td className="px-3 py-3">{formatPercent(report.marketCoveragePct)}</td>
                          <td className="px-3 py-3">{formatPercent(report.orderBookCoveragePct)}</td>
                          <td className="px-3 py-3">
                            {report.staleMinutes === null || report.staleMinutes === undefined
                              ? "N/A"
                              : `${report.staleMinutes}m`}
                          </td>
                          <td className="px-3 py-3">{report.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}