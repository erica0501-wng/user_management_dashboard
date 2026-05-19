const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const all = await p.backtest.findMany({
    select: { id: true, marketId: true, createdAt: true, group: { select: { name: true } } },
    orderBy: { id: 'asc' }
  });
  const withMid = all.filter(b => b.marketId);
  const without = all.filter(b => !b.marketId);
  console.log('Total backtests:', all.length);
  console.log('With marketId (per-market, NEW):', withMid.length);
  console.log('Without marketId (legacy multi-market):', without.length);
  console.log('\nLegacy IDs:', without.map(b => b.id).join(', '));
  console.log('\nLast 10 backtests:');
  all.slice(-10).forEach(b =>
    console.log(`  #${b.id}  group=${b.group?.name || '?'}  marketId=${b.marketId || '(NULL=legacy)'}`)
  );
  await p.$disconnect();
})();
