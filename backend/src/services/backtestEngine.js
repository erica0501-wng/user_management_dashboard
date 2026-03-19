const prisma = require('../prisma');

/**
 * Built-in trading strategies
 */
const STRATEGIES = {
  /**
   * Momentum strategy: Buy when price is moving up, sell when moving down
   */
  momentum: {
    name: 'Momentum Strategy',
    description: 'Trades based on price momentum',
    defaultParams: {
      buyThreshold: 0.02,      // Buy when price rises 2%
      sellThreshold: 0.02,     // Sell when price drops 2%
      positionSize: 1000       // Position size per trade
    },
    execute: function(prev, current, params) {
      if (!prev || !current) return { action: 'HOLD' };
      
      const prevPrice = Array.isArray(prev.outcomePrices) 
        ? prev.outcomePrices[0] 
        : parseFloat(prev.outcomePrices?.[Object.keys(prev.outcomePrices)[0]] || 0.5);
      
      const currPrice = Array.isArray(current.outcomePrices) 
        ? current.outcomePrices[0] 
        : parseFloat(current.outcomePrices?.[Object.keys(current.outcomePrices)[0]] || 0.5);

      if (prevPrice === 0) return { action: 'HOLD' };
      
      const priceMomentum = (currPrice - prevPrice) / prevPrice;
      
      if (priceMomentum > params.buyThreshold) {
        return { 
          action: 'BUY', 
          amount: params.positionSize, 
          price: currPrice,
          signal: `Price momentum +${(priceMomentum * 100).toFixed(2)}%`
        };
      } else if (priceMomentum < -params.sellThreshold) {
        return { 
          action: 'SELL', 
          amount: params.positionSize, 
          price: currPrice,
          signal: `Price momentum ${(priceMomentum * 100).toFixed(2)}%`
        };
      }
      return { action: 'HOLD' };
    }
  },

  /**
   * Mean Reversion: Buy when price is low, sell when price is high
   */
  meanReversion: {
    name: 'Mean Reversion Strategy',
    description: 'Trades based on mean reversion principle',
    defaultParams: {
      period: 20,              // 20-period lookback
      buyThreshold: 0.3,       // Buy when price in bottom 30%
      sellThreshold: 0.7,      // Sell when price in top 70%
      positionSize: 1000
    },
    execute: function(history, current, params) {
      if (!history || history.length < params.period) return { action: 'HOLD' };
      
      const recentPrices = history.slice(-params.period).map(snapshot => {
        if (Array.isArray(snapshot.outcomePrices)) {
          return snapshot.outcomePrices[0];
        }
        return parseFloat(snapshot.outcomePrices?.[Object.keys(snapshot.outcomePrices)[0]] || 0.5);
      });

      const minPrice = Math.min(...recentPrices);
      const maxPrice = Math.max(...recentPrices);
      const range = maxPrice - minPrice;

      const currPrice = Array.isArray(current.outcomePrices) 
        ? current.outcomePrices[0] 
        : parseFloat(current.outcomePrices?.[Object.keys(current.outcomePrices)[0]] || 0.5);

      const percentile = range > 0 ? (currPrice - minPrice) / range : 0.5;

      if (percentile < params.buyThreshold) {
        return { 
          action: 'BUY', 
          amount: params.positionSize, 
          price: currPrice,
          signal: `Price in lower percentile (${(percentile * 100).toFixed(1)}%)`
        };
      } else if (percentile > params.sellThreshold) {
        return { 
          action: 'SELL', 
          amount: params.positionSize, 
          price: currPrice,
          signal: `Price in upper percentile (${(percentile * 100).toFixed(1)}%)`
        };
      }
      return { action: 'HOLD' };
    }
  },

  /**
   * Volatility: Trade based on bid-ask spread (from order book)
   */
  volatility: {
    name: 'Volatility Strategy',
    description: 'Trades based on market volatility (spread)',
    defaultParams: {
      spreadThreshold: 0.05,   // 5% spread threshold
      positionSize: 1000
    },
    execute: function(prev, current, params) {
      if (!current) return { action: 'HOLD' };
      
      // For this strategy, we'd need order book data
      // Simplified version: use price range as proxy for volatility
      return { action: 'HOLD' };
    }
  }
};

/**
 * Run backtest on a market group using specified strategy
 */
async function runBacktest(groupName, strategyName = 'momentum', params = {}, options = {}) {
  try {
    const strategy = STRATEGIES[strategyName];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    // Merge default params with provided params
    const finalParams = { ...strategy.defaultParams, ...params };

    // Fetch backtest data
    const { snapshots, marketCount, snapshotCount } = await require('./marketGrouping')
      .getGroupBacktestData(groupName, options);

    if (snapshots.length < 2) {
      throw new Error(`Insufficient data for backtest: ${snapshotCount} snapshots`);
    }

    console.log(`\n=== BACKTEST STARTED ===`);
    console.log(`Strategy: ${strategy.name}`);
    console.log(`Market Group: ${groupName}`);
    console.log(`Markets: ${marketCount}, Snapshots: ${snapshotCount}`);
    console.log(`Params:`, finalParams);
    console.log(`Duration: ${snapshots[0].intervalStart} to ${snapshots[snapshots.length - 1].intervalStart}\n`);

    // Initialize portfolio
    const initialCapital = finalParams.positionSize * 10; // Default: 10x position size = capital
    let cashBalance = initialCapital;
    let position = 0;        // Current holding size
    let avgEntryPrice = 0;   // Average entry price
    const trades = [];
    let maxBalance = initialCapital;
    let minBalance = initialCapital;
    let maxDrawdown = 0;

    // Run strategy on each snapshot
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const current = snapshots[i];

      // For momentum: just need previous and current
      // For mean reversion: provide full history
      let signal;
      if (strategyName === 'meanReversion') {
        signal = strategy.execute(snapshots.slice(0, i), current, finalParams);
      } else {
        signal = strategy.execute(prev, current, finalParams);
      }

      if (signal.action === 'BUY' && cashBalance >= signal.amount) {
        // Execute BUY
        cashBalance -= signal.amount;
        position += signal.amount;
        avgEntryPrice = (avgEntryPrice + signal.price) / 2;
        
        trades.push({
          time: current.intervalStart,
          action: 'BUY',
          price: signal.price,
          amount: signal.amount,
          signal: signal.signal || 'Buy signal triggered',
          cashBalance,
          position
        });
      } else if (signal.action === 'SELL' && position > 0) {
        // Execute SELL
        const profit = (signal.price - avgEntryPrice) * position;
        cashBalance += signal.price * position;
        
        trades.push({
          time: current.intervalStart,
          action: 'SELL',
          price: signal.price,
          amount: position,
          profit,
          signal: signal.signal || 'Sell signal triggered',
          cashBalance,
          position: 0
        });

        position = 0;
        avgEntryPrice = 0;
      }

      // Track portfolio value
      const portfolioValue = cashBalance + (position * current.outcomePrices?.[0] || 0);
      maxBalance = Math.max(maxBalance, portfolioValue);
      minBalance = Math.min(minBalance, portfolioValue);
      maxDrawdown = Math.max(maxDrawdown, maxBalance - minBalance);
    }

    // Calculate final metrics
    const finalPrice = Array.isArray(snapshots[snapshots.length - 1].outcomePrices)
      ? snapshots[snapshots.length - 1].outcomePrices[0]
      : 0.5;
    const finalValue = cashBalance + (position * finalPrice);
    const pnl = finalValue - initialCapital;
    const roi = (pnl / initialCapital) * 100;

    const winningTrades = trades.filter(t => t.action === 'SELL' && t.profit > 0).length;
    const losingTrades = trades.filter(t => t.action === 'SELL' && t.profit <= 0).length;
    const totalTrades = trades.filter(t => t.action === 'SELL').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const backtest = {
      groupName,
      strategyName,
      startTime: snapshots[0].intervalStart,
      endTime: snapshots[snapshots.length - 1].intervalStart,
      initialCapital,
      finalValue,
      pnl,
      roi,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      maxDrawdown,
      trades,
      params: finalParams,
      metrics: {
        sharpeRatio: calculateSharpeRatio(trades),
        profitFactor: calculateProfitFactor(trades)
      }
    };

    // Save to database
    const savedBacktest = await prisma.backtest.create({
      data: {
        group: { connect: { name: groupName } },
        strategyName,
        startTime: snapshots[0].intervalStart,
        endTime: snapshots[snapshots.length - 1].intervalStart,
        initialCapital,
        finalValue,
        pnl,
        roi,
        winRate,
        totalTrades,
        winningTrades,
        losingTrades,
        maxDrawdown,
        params: finalParams,
        tradeHistory: trades
      }
    });

    // Print results
    console.log(`=== BACKTEST RESULTS ===`);
    console.log(`Initial Capital: $${initialCapital.toFixed(2)}`);
    console.log(`Final Value:     $${finalValue.toFixed(2)}`);
    console.log(`P&L:             $${pnl.toFixed(2)}`);
    console.log(`ROI:             ${roi.toFixed(2)}%`);
    console.log(`Total Trades:    ${totalTrades} (${winningTrades} wins, ${losingTrades} losses)`);
    console.log(`Win Rate:        ${winRate.toFixed(2)}%`);
    console.log(`Max Drawdown:    ${maxDrawdown.toFixed(2)}%`);
    console.log(`Profit Factor:   ${backtest.metrics.profitFactor.toFixed(2)}`);
    console.log(`Sharpe Ratio:    ${backtest.metrics.sharpeRatio.toFixed(2)}\n`);

    return {
      ...backtest,
      backtestId: savedBacktest.id
    };
  } catch (error) {
    console.error('Backtest error:', error);
    throw error;
  }
}

/**
 * Calculate Sharpe Ratio (simple version)
 */
function calculateSharpeRatio(trades) {
  const returns = trades
    .filter(t => t.action === 'SELL')
    .map(t => t.profit || 0);

  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return stdDev === 0 ? 0 : avgReturn / stdDev;
}

/**
 * Calculate Profit Factor (gross profit / gross loss)
 */
function calculateProfitFactor(trades) {
  const wins = trades
    .filter(t => t.action === 'SELL' && t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0);

  const losses = Math.abs(trades
    .filter(t => t.action === 'SELL' && t.profit < 0)
    .reduce((sum, t) => sum + t.profit, 0));

  return losses === 0 ? (wins > 0 ? 99.99 : 0) : wins / losses;
}

/**
 * Get backtest results for a group
 */
async function getBacktestResults(groupName, limit = 10) {
  try {
    const backtests = await prisma.backtest.findMany({
      where: {
        group: { name: groupName }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return backtests;
  } catch (error) {
    console.error('Error fetching backtest results:', error);
    throw error;
  }
}

/**
 * Get best backtest performance across all strategies
 */
async function getBestBacktest(groupName) {
  try {
    const backtest = await prisma.backtest.findFirst({
      where: {
        group: { name: groupName }
      },
      orderBy: { roi: 'desc' },
      include: { group: true }
    });
    return backtest;
  } catch (error) {
    console.error('Error fetching best backtest:', error);
    throw error;
  }
}

module.exports = {
  STRATEGIES,
  runBacktest,
  getBacktestResults,
  getBestBacktest,
  calculateSharpeRatio,
  calculateProfitFactor
};
