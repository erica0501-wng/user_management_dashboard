// Quick inspect: show snapshot count, distinct intervals, price range for a market group / specific market
require('dotenv').config();
const prisma = require('../src/prisma');

function extractYes(p) {
  if (Array.isArray(p)) return Number(p[0]);
  if (typeof p === 'string') { try { return Number(JSON.parse(p)[0]); } catch { return NaN; } }
  return NaN;
}

async function inspectMarket(query) {
  const sample = await prisma.polymarketMarketSnapshot.findFirst({
    where: { question: { contains: query, mode: 'insensitive' } },
    orderBy: { intervalStart: 'desc' }
  });
  if (!sample) { console.log(`\n❌ Not found: ${query}`); return; }
  const all = await prisma.polymarketMarketSnapshot.findMany({
    where: { marketId: sample.marketId },
    orderBy: { intervalStart: 'asc' }
  });
  console.log(`\n=== ${sample.question}  (marketId=${sample.marketId}) ===`);
  console.log(`Category: ${sample.category} | Closed: ${sample.closed} | endDate: ${sample.endDate}`);
  console.log(`Snapshots: ${all.length}`);
  const distinct = new Set(all.map(s => s.intervalStart.getTime())).size;
  console.log(`Distinct intervals: ${distinct}`);
  if (all.length === 0) return;
  const first = all[0], last = all[all.length - 1];
  console.log(`First: ${first.intervalStart.toISOString()}  prices=${JSON.stringify(first.outcomePrices)}`);
  console.log(`Last:  ${last.intervalStart.toISOString()}   prices=${JSON.stringify(last.outcomePrices)}`);
  const yes = all.map(s => extractYes(s.outcomePrices)).filter(n => !isNaN(n));
  if (yes.length > 0) {
    const min = Math.min(...yes), max = Math.max(...yes);
    const spread = max - min;
    console.log(`YES price range: ${min.toFixed(4)} → ${max.toFixed(4)}  spread=${spread.toFixed(4)}`);
    if (distinct < 2) console.log('⚠️  Only 1 interval — most strategies need >= 2');
    if (spread < 0.005) console.log('⚠️  Spread < 0.5% — momentum threshold (0.005) cannot fire');
    if (spread < 0.05) console.log('⚠️  Spread < 5% — meanReversion has no room (40th/60th percentile too narrow)');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node inspect-backtest.js "<market name or id>"');
    console.log('Examples:');
    console.log('  node inspect-backtest.js "Xi Jinping"');
    console.log('  node inspect-backtest.js "Carolina Hurricanes"');
    return;
  }
  for (const a of args) await inspectMarket(a);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
