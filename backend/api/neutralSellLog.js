const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const LOG_PATH = path.join(__dirname, '../neutral_sell_log.jsonl');

function readEntries() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

// GET /api/neutral-sell-log — raw entries (optionally filtered).
// Query: backtestId, strategy, category, marketId, sinceMs (ms epoch lower bound on `time`)
router.get('/neutral-sell-log', (req, res) => {
  try {
    let entries = readEntries();
    const { backtestId, strategy, category, marketId, sinceMs } = req.query || {};
    if (backtestId) entries = entries.filter((e) => String(e.backtestId) === String(backtestId));
    if (strategy) entries = entries.filter((e) => String(e.strategy || '').toLowerCase() === String(strategy).toLowerCase());
    if (category) entries = entries.filter((e) => String(e.category || '').toUpperCase() === String(category).toUpperCase());
    if (marketId) entries = entries.filter((e) => String(e.marketId) === String(marketId));
    if (sinceMs) {
      const cutoff = Number(sinceMs);
      if (Number.isFinite(cutoff)) {
        entries = entries.filter((e) => {
          const t = e?.time ? new Date(e.time).getTime() : 0;
          return t >= cutoff;
        });
      }
    }
    res.json({ data: entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read log file', detail: String(err?.message || err) });
  }
});

// GET /api/neutral-sell-log/stats — aggregate counts for digest / dashboard.
// Buckets by category, strategy, market, and holding-time histogram.
router.get('/neutral-sell-log/stats', (req, res) => {
  try {
    const entries = readEntries();
    const { sinceMs, backtestId } = req.query || {};
    let filtered = entries;
    if (backtestId) filtered = filtered.filter((e) => String(e.backtestId) === String(backtestId));
    if (sinceMs) {
      const cutoff = Number(sinceMs);
      if (Number.isFinite(cutoff)) {
        filtered = filtered.filter((e) => {
          const t = e?.time ? new Date(e.time).getTime() : 0;
          return t >= cutoff;
        });
      }
    }

    const byCategory = {};
    const byStrategy = {};
    const byMarket = {};
    const byReason = {};
    // Holding-time histogram (BREAKEVEN only) in ms buckets.
    const histBuckets = [
      { label: 'instant (<1s)', max: 1_000 },
      { label: '<1min', max: 60_000 },
      { label: '<1h', max: 3_600_000 },
      { label: '<1d', max: 86_400_000 },
      { label: '>=1d', max: Infinity },
    ];
    const holdingHistogram = histBuckets.map((b) => ({ label: b.label, count: 0 }));
    const backtestIds = new Set();

    for (const e of filtered) {
      const cat = e.category || e.type || 'UNKNOWN';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const strat = e.strategy || 'unknown';
      byStrategy[strat] = (byStrategy[strat] || 0) + 1;
      const mid = e.marketId || 'unknown';
      byMarket[mid] = (byMarket[mid] || 0) + 1;
      const reason = e.reason || 'unspecified';
      byReason[reason] = (byReason[reason] || 0) + 1;
      if (e.backtestId != null) backtestIds.add(e.backtestId);
      if (e.category === 'BREAKEVEN' && Number.isFinite(e.holdingMsToFirstExit)) {
        const hold = Number(e.holdingMsToFirstExit);
        const idx = histBuckets.findIndex((b) => hold < b.max);
        if (idx >= 0) holdingHistogram[idx].count += 1;
      }
    }

    res.json({
      total: filtered.length,
      uniqueBacktests: backtestIds.size,
      byCategory,
      byStrategy,
      byMarket,
      byReason,
      holdingHistogram,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute stats', detail: String(err?.message || err) });
  }
});

module.exports = router;

