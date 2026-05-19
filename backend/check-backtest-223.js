// Audit backtest #223 to verify all reported numbers tally with the raw trade history.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const id = parseInt(process.argv[2] || '223', 10);
    const bt = await prisma.backtest.findUnique({
      where: { id },
      include: { group: true }
    });
    if (!bt) {
      console.log(`Backtest ${id} not found`);
      return;
    }

    let trades = bt.tradeHistory;
    if (typeof trades === 'string') trades = JSON.parse(trades);
    if (!Array.isArray(trades)) trades = [];

    const buys = trades.filter(t => t.action === 'BUY');
    const sells = trades.filter(t => t.action === 'SELL');
    const wins = sells.filter(t => Number(t.profit || 0) > 0);
    const losses = sells.filter(t => Number(t.profit || 0) < 0);
    const breakeven = sells.filter(t => Number(t.profit || 0) === 0);
    const sumSellProfit = sells.reduce((s, t) => s + Number(t.profit || 0), 0);
    const grossGain = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
    const grossLoss = losses.reduce((s, t) => s + Number(t.profit || 0), 0);

    const marketIds = [...new Set(trades.map(t => String(t.marketId)))];

    console.log('=== STORED METRICS ===');
    console.log('id:', bt.id, '| group:', bt.group?.name, '| strategy:', bt.strategyName);
    console.log('marketId:', bt.marketId);
    console.log('totalTrades :', bt.totalTrades);
    console.log('winningTrades:', bt.winningTrades);
    console.log('losingTrades :', bt.losingTrades);
    console.log('winRate     :', bt.winRate?.toFixed(4), '%');
    console.log('initialCapital:', bt.initialCapital);
    console.log('finalValue  :', bt.finalValue);
    console.log('pnl         :', bt.pnl);
    console.log('roi         :', bt.roi?.toFixed(4), '%');

    console.log('\n=== COMPUTED FROM TRADES ===');
    console.log('transactions (BUY+SELL):', trades.length);
    console.log('  BUYs :', buys.length);
    console.log('  SELLs:', sells.length, '  <- this is "totalTrades"');
    console.log('  Winning SELLs :', wins.length);
    console.log('  Losing SELLs  :', losses.length);
    console.log('  Breakeven SELLs:', breakeven.length);
    console.log('  W + L + BE    :', wins.length + losses.length + breakeven.length);
    console.log('Win rate (W/(W+L)) :', ((wins.length / (wins.length + losses.length || 1)) * 100).toFixed(4), '%');
    console.log('Gross gain :', grossGain.toFixed(4));
    console.log('Gross loss :', grossLoss.toFixed(4));
    console.log('Sum SELL.profit (realized net):', sumSellProfit.toFixed(4));
    console.log('Stored pnl                   :', Number(bt.pnl).toFixed(4));
    console.log('Diff (residual unrealized)   :', (Number(bt.pnl) - sumSellProfit).toFixed(4));
    console.log('Distinct marketIds in trades:', marketIds.length, '->', marketIds.slice(0, 5).join(', '));

    console.log('\n=== TALLY CHECKS ===');
    const tally = (label, ok) => console.log((ok ? '✅' : '❌') + ' ' + label);
    tally(`SELL count == stored totalTrades (${sells.length} == ${bt.totalTrades})`, sells.length === bt.totalTrades);
    tally(`Wins == stored winningTrades (${wins.length} == ${bt.winningTrades})`, wins.length === bt.winningTrades);
    tally(`Losses == stored losingTrades (${losses.length} == ${bt.losingTrades})`, losses.length === bt.losingTrades);
    tally(`W + L + BE == SELL count (${wins.length}+${losses.length}+${breakeven.length} == ${sells.length})`,
      wins.length + losses.length + breakeven.length === sells.length);
    const winRateCalc = (wins.length / ((wins.length + losses.length) || 1)) * 100;
    tally(`Win rate matches (calc ${winRateCalc.toFixed(4)} vs stored ${Number(bt.winRate).toFixed(4)})`,
      Math.abs(winRateCalc - Number(bt.winRate)) < 0.01);
    tally(`pnl == finalValue - initialCapital (${(bt.finalValue - bt.initialCapital).toFixed(4)} vs ${Number(bt.pnl).toFixed(4)})`,
      Math.abs((bt.finalValue - bt.initialCapital) - bt.pnl) < 0.01);
    tally(`pnl == sum(SELL.profit) (within $0.01) — perfect when no residual open positions`,
      Math.abs(Number(bt.pnl) - sumSellProfit) < 0.01);

    console.log('\n=== FIRST/LAST TRADES ===');
    const fmt = t => `${t.action.padEnd(4)} m=${String(t.marketId).slice(-6)} t=${t.time} px=${Number(t.price).toFixed(4)} amt=${Number(t.amount).toFixed(2)} profit=${t.profit !== undefined && t.profit !== null ? Number(t.profit).toFixed(2) : '-'}`;
    trades.slice(0, 3).forEach((t, i) => console.log(`#${i + 1}`.padEnd(5), fmt(t)));
    console.log('  ...');
    trades.slice(-3).forEach((t, i) => console.log(`#${trades.length - 2 + i}`.padEnd(5), fmt(t)));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
