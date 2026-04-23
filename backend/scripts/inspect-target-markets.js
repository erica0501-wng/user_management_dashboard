require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGETS = [
  { name: 'Elon Tweets', pattern: /elon|musk|twitter|tesla|spacex|xai|doge/i },
  { name: 'Economic Policy', pattern: /economic|policy|fed|federal reserve|interest rate|inflation|tariff|trade war|recession|gdp|treasury|powell|rate cut/i },
  { name: 'NBA', pattern: /nba|basketball|playoff|finals|warriors|lakers|celtics|knicks|nuggets|heat/i },
  { name: 'Movies', pattern: /movie|film|box office|oscar|cinema|sequel|marvel|disney|netflix film|theatrical/i },
];

(async () => {
  console.log('--- Polymarket archive snapshot summary ---');
  const total = await prisma.polymarketMarketSnapshot.count();
  console.log('total snapshots:', total);

  const distinctMarkets = await prisma.polymarketMarketSnapshot.findMany({
    distinct: ['marketId'],
    select: { marketId: true, question: true, category: true, eventStartAt: true, eventEndAt: true, closed: true, closedTime: true },
  });
  console.log('distinct markets:', distinctMarkets.length);

  const start = new Date('2026-03-01T00:00:00Z');
  const end = new Date('2026-04-01T00:00:00Z');
  console.log('\n--- Per target match counts (whole DB) ---');
  for (const t of TARGETS) {
    const matched = distinctMarkets.filter(m => t.pattern.test(`${m.question} ${m.category || ''}`));
    const closedInMar = matched.filter(m => {
      const d = m.closedTime || m.eventEndAt;
      return d && d >= start && d < end;
    });
    console.log(`\n${t.name}: total markets=${matched.length}, closed in Mar 2026=${closedInMar.length}`);
    console.log('  examples:', matched.slice(0, 5).map(m => `[${m.category || '?'}] ${m.question}`));
  }

  const groups = await prisma.marketGroup.findMany({ select: { name: true, markets: true } });
  console.log('\n--- Existing MarketGroups ---');
  groups.forEach(g => console.log(`  ${g.name}: ${g.markets?.length || 0} markets`));

  const backtests = await prisma.backtest.count();
  console.log('\nBacktest rows in DB:', backtests);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
