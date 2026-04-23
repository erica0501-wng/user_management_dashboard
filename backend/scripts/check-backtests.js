const p = require('../src/prisma')
;(async () => {
  const c = await p.backtest.count()
  const rows = await p.backtest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, strategyName: true, roi: true, totalTrades: true, createdAt: true, group: { select: { name: true } } }
  })
  console.log('Total backtest rows in DB:', c)
  console.table(rows.map(x => ({ id: x.id, group: x.group?.name, strat: x.strategyName, roi: x.roi, trades: x.totalTrades, when: x.createdAt.toISOString() })))
  await p.$disconnect()
})()
