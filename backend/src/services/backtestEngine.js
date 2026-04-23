const prisma = require('../prisma');
const discord = require('./discordNotifier');

function getPrimaryPrice(snapshot) {
  if (!snapshot) return 0;

  if (Array.isArray(snapshot.outcomePrices)) {
    const value = Number(snapshot.outcomePrices[0]);
    return Number.isFinite(value) ? value : 0;
  }

  const outcomePrices = snapshot.outcomePrices || {};
  const firstKey = Object.keys(outcomePrices)[0];
  const value = Number(firstKey ? outcomePrices[firstKey] : 0.5);
  return Number.isFinite(value) ? value : 0;
}

function getYesNoPrices(snapshot) {
  if (!snapshot) {
    return { yesPrice: null, noPrice: null };
  }

  const normalizeOutcomeLabel = (value) => String(value || '').trim().toLowerCase();

  const toNumeric = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 1 ? numberValue : null;
  };

  const normalizeOutcomes = () => {
    if (Array.isArray(snapshot.outcomes)) {
      return snapshot.outcomes.map((item) => String(item || ''));
    }

    if (typeof snapshot.outcomes === 'string') {
      try {
        const parsed = JSON.parse(snapshot.outcomes);
        return Array.isArray(parsed) ? parsed.map((item) => String(item || '')) : [];
      } catch {
        return [];
      }
    }

    return [];
  };

  const outcomes = normalizeOutcomes();

  if (Array.isArray(snapshot.outcomePrices)) {
    const outcomePrices = snapshot.outcomePrices.map((value) => toNumeric(value));
    const yesIndex = outcomes.findIndex((label) => normalizeOutcomeLabel(label) === 'yes');
    const noIndex = outcomes.findIndex((label) => normalizeOutcomeLabel(label) === 'no');

    const rawYes = yesIndex >= 0 ? outcomePrices[yesIndex] : outcomePrices[0];
    const rawNo = noIndex >= 0 ? outcomePrices[noIndex] : outcomePrices[1];

    const yesValue = rawYes;
    const noValue = rawNo;

    const completedYes = yesValue ?? (noValue !== null ? 1 - noValue : null);
    const completedNo = noValue ?? (yesValue !== null ? 1 - yesValue : null);

    return {
      yesPrice: toNumeric(completedYes),
      noPrice: toNumeric(completedNo),
    };
  }

  const outcomePrices = snapshot.outcomePrices || {};
  const keys = Object.keys(outcomePrices);
  const lowerKeyMap = new Map(keys.map((key) => [normalizeOutcomeLabel(key), key]));

  let yesValue = null;
  let noValue = null;

  if (lowerKeyMap.has('yes')) {
    yesValue = toNumeric(outcomePrices[lowerKeyMap.get('yes')]);
  }
  if (lowerKeyMap.has('no')) {
    noValue = toNumeric(outcomePrices[lowerKeyMap.get('no')]);
  }

  if (yesValue === null || noValue === null) {
    const values = Object.values(outcomePrices).map((value) => toNumeric(value));
    const fallbackYes = yesValue ?? values[0] ?? null;
    const fallbackNo = noValue ?? values[1] ?? null;
    yesValue = fallbackYes;
    noValue = fallbackNo;
  }

  const completedYes = yesValue ?? (noValue !== null ? 1 - noValue : null);
  const completedNo = noValue ?? (yesValue !== null ? 1 - yesValue : null);

  return {
    yesPrice: toNumeric(completedYes),
    noPrice: toNumeric(completedNo),
  };
}

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
      buyThreshold: 0.005,     // Buy when price rises 0.5% (adjusted for low-volatility markets)
      sellThreshold: 0.005,    // Sell when price drops 0.5%
      positionSize: 1000       // Position size per trade
    },
    execute: function(prev, current, params) {
      if (!prev || !current) return { action: 'HOLD' };
      if (prev.marketId !== current.marketId) return { action: 'HOLD' };

      const prevPrice = getPrimaryPrice(prev);
      const currPrice = getPrimaryPrice(current);

      if (prevPrice <= 0 || currPrice <= 0) return { action: 'HOLD' };
      
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
      period: 10,              // 10-period lookback (adjusted from 20 for more responsive signals)
      buyThreshold: 0.4,       // Buy when price in bottom 40% (adjusted from 30%)
      sellThreshold: 0.6,      // Sell when price in top 60% (adjusted from 70%)
      positionSize: 1000
    },
    execute: function(history, current, params) {
      if (!history || history.length < params.period) return { action: 'HOLD' };

      const currentMarketHistory = history.filter(
        (snapshot) => snapshot.marketId === current.marketId
      );

      if (currentMarketHistory.length < params.period) {
        return { action: 'HOLD' };
      }

      const recentPrices = currentMarketHistory
        .slice(-params.period)
        .map((snapshot) => getPrimaryPrice(snapshot))
        .filter((price) => price > 0);

      if (recentPrices.length < Math.max(2, Math.floor(params.period / 2))) {
        return { action: 'HOLD' };
      }

      const minPrice = Math.min(...recentPrices);
      const maxPrice = Math.max(...recentPrices);
      const range = maxPrice - minPrice;

      const currPrice = getPrimaryPrice(current);

      if (currPrice <= 0) return { action: 'HOLD' };

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
      spreadThreshold: 0.002,  // Volatility threshold (adjusted from 0.01 for low-volatility markets)
      positionSize: 1000
    },
    execute: function(prev, current, params) {
      if (!prev || !current) return { action: 'HOLD' };
      if (prev.marketId !== current.marketId) return { action: 'HOLD' };

      const prevPrice = getPrimaryPrice(prev);
      const currPrice = getPrimaryPrice(current);

      if (prevPrice <= 0 || currPrice <= 0) return { action: 'HOLD' };

      const absReturn = Math.abs((currPrice - prevPrice) / prevPrice);

      if (absReturn < params.spreadThreshold) {
        return { action: 'HOLD' };
      }

      if (currPrice > prevPrice) {
        return {
          action: 'BUY',
          amount: params.positionSize,
          price: currPrice,
          signal: `High volatility breakout +${(absReturn * 100).toFixed(2)}%`
        };
      }

      if (currPrice < prevPrice) {
        return {
          action: 'SELL',
          amount: params.positionSize,
          price: currPrice,
          signal: `High volatility reversal -${(absReturn * 100).toFixed(2)}%`
        };
      }

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

    const normalizedMarketId = String(options?.marketId || '').trim();

    // Merge default params with provided params and persist marketId for later result enrichment.
    const finalParams = normalizedMarketId
      ? { ...strategy.defaultParams, ...params, marketId: normalizedMarketId }
      : { ...strategy.defaultParams, ...params };

    // Fetch backtest data
    const { snapshots, marketCount, snapshotCount } = await require('./marketGrouping')
      .getGroupBacktestData(groupName, options);

    const snapshotsByMarket = new Map();
    const distinctIntervals = new Set();
    const pricesByMarket = new Map();
    for (const snapshot of snapshots) {
      const marketId = String(snapshot.marketId || '');
      if (!marketId) continue;
      snapshotsByMarket.set(marketId, (snapshotsByMarket.get(marketId) || 0) + 1);
      if (snapshot.intervalStart) {
        distinctIntervals.add(new Date(snapshot.intervalStart).toISOString());
      }

      const price = getPrimaryPrice(snapshot);
      if (price > 0) {
        if (!pricesByMarket.has(marketId)) {
          pricesByMarket.set(marketId, []);
        }
        pricesByMarket.get(marketId).push(price);
      }
    }

    const marketsWithHistory = Array.from(snapshotsByMarket.values()).filter((count) => count >= 2).length;
    const marketsWithMeaningfulMovement = Array.from(pricesByMarket.values()).filter((prices) => {
      if (!Array.isArray(prices) || prices.length < 2) {
        return false;
      }

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      return (maxPrice - minPrice) >= 0.005;
    }).length;

    if (snapshots.length < 2) {
      throw new Error(`Insufficient data for backtest: ${snapshotCount} snapshots`);
    }

    if (distinctIntervals.size < 2 || marketsWithHistory === 0) {
      throw new Error(
        `Insufficient data for backtest: time-series depth is too shallow (distinctIntervals=${distinctIntervals.size}, marketsWithHistory=${marketsWithHistory}).`
      );
    }

    const hasMeaningfulMovement = marketsWithMeaningfulMovement > 0;
    if (!hasMeaningfulMovement) {
      console.warn(
        `[warn] Backtest ${groupName}/${strategyName} has flat history in current window. Proceeding with low-signal data.`
      );
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
    const positionsByMarket = new Map(); // marketId -> { shares, costBasis }
    const latestPriceByMarket = new Map();
    const trades = [];
    let peakPortfolioValue = initialCapital;
    let maxDrawdown = 0;

    // Track last snapshot per market to avoid cross-market signal contamination.
    const lastSnapshotByMarket = new Map();

    // Run strategy on each snapshot
    for (let i = 0; i < snapshots.length; i++) {
      const current = snapshots[i];
      const prevSameMarket = lastSnapshotByMarket.get(current.marketId) || null;

      // For momentum: just need previous and current
      // For mean reversion: provide full history
      let signal;
      if (strategyName === 'meanReversion') {
        signal = strategy.execute(snapshots.slice(0, i), current, finalParams);
      } else {
        signal = strategy.execute(prevSameMarket, current, finalParams);
      }

      const signalPrice = Number(signal.price);
      const signalAmount = Number(signal.amount || finalParams.positionSize || 0);

      const existingPosition = positionsByMarket.get(current.marketId) || {
        shares: 0,
        costBasis: 0
      };

      if (
        signal.action === 'BUY' &&
        signalAmount > 0 &&
        signalPrice > 0 &&
        cashBalance > 0
      ) {
        const tradeAmount = Math.min(signalAmount, cashBalance);
        const sharesBought = tradeAmount / signalPrice;

        // Execute BUY
        cashBalance -= tradeAmount;

        const nextPosition = {
          shares: existingPosition.shares + sharesBought,
          costBasis: existingPosition.costBasis + tradeAmount
        };
        positionsByMarket.set(current.marketId, nextPosition);

        const avgEntryPrice = nextPosition.shares > 0 ? nextPosition.costBasis / nextPosition.shares : 0;

        trades.push({
          time: current.intervalStart,
          marketId: current.marketId,
          action: 'BUY',
          price: signalPrice,
          amount: tradeAmount,
          shares: sharesBought,
          avgEntryPrice,
          signal: signal.signal || 'Buy signal triggered',
          cashBalance,
          positionShares: nextPosition.shares,
          positionCostBasis: nextPosition.costBasis
        });
      } else if (signal.action === 'SELL' && signalPrice > 0 && existingPosition.shares > 0) {
        const sharesToSell = existingPosition.shares;
        const proceeds = sharesToSell * signalPrice;
        const profit = proceeds - existingPosition.costBasis;

        // Execute SELL
        cashBalance += proceeds;

        trades.push({
          time: current.intervalStart,
          marketId: current.marketId,
          action: 'SELL',
          price: signalPrice,
          amount: proceeds,
          shares: sharesToSell,
          profit,
          signal: signal.signal || 'Sell signal triggered',
          cashBalance,
          positionShares: 0,
          positionCostBasis: 0
        });

        positionsByMarket.delete(current.marketId);
      }

      // Track portfolio value
      const currentPrice = getPrimaryPrice(current);
      if (currentPrice > 0) {
        latestPriceByMarket.set(current.marketId, currentPrice);
      }

      const openPositionsValue = Array.from(positionsByMarket.entries()).reduce((sum, [marketId, position]) => {
        const markedPrice = latestPriceByMarket.get(marketId) || (position.shares > 0 ? position.costBasis / position.shares : 0);
        return sum + position.shares * markedPrice;
      }, 0);

      const portfolioValue = cashBalance + openPositionsValue;

      if (portfolioValue > peakPortfolioValue) {
        peakPortfolioValue = portfolioValue;
      }

      const drawdownPct = peakPortfolioValue > 0
        ? ((peakPortfolioValue - portfolioValue) / peakPortfolioValue) * 100
        : 0;

      maxDrawdown = Math.max(maxDrawdown, drawdownPct);

      lastSnapshotByMarket.set(current.marketId, current);
    }

    // Auto-close any remaining open positions at the end so metrics include realized outcomes.
    const terminalSnapshot = snapshots[snapshots.length - 1];
    const terminalPrice = getPrimaryPrice(terminalSnapshot);
    for (const [marketId, position] of Array.from(positionsByMarket.entries())) {
      if (!position || position.shares <= 0) {
        positionsByMarket.delete(marketId);
        continue;
      }

      const marketTerminalSnapshot = lastSnapshotByMarket.get(marketId) || terminalSnapshot;
      const markedPrice = latestPriceByMarket.get(marketId) || terminalPrice;
      const exitPrice = getPrimaryPrice(marketTerminalSnapshot) || markedPrice;

      if (exitPrice <= 0) {
        continue;
      }

      const proceeds = position.shares * exitPrice;
      const profit = proceeds - position.costBasis;

      cashBalance += proceeds;
      trades.push({
        time: marketTerminalSnapshot.intervalStart,
        marketId,
        action: 'SELL',
        price: exitPrice,
        amount: proceeds,
        shares: position.shares,
        profit,
        signal: 'Auto-close at end of backtest window',
        cashBalance,
        positionShares: 0,
        positionCostBasis: 0
      });

      positionsByMarket.delete(marketId);
    }

    // Calculate final metrics
    const finalPrice = terminalPrice;
    const remainingOpenValue = Array.from(positionsByMarket.entries()).reduce((sum, [marketId, position]) => {
      const markedPrice = latestPriceByMarket.get(marketId) || finalPrice || (position.shares > 0 ? position.costBasis / position.shares : 0);
      return sum + position.shares * markedPrice;
    }, 0);
    const finalValue = cashBalance + remainingOpenValue;
    const pnl = finalValue - initialCapital;
    const roi = (pnl / initialCapital) * 100;

    const winningTrades = trades.filter(t => t.action === 'SELL' && t.profit > 0).length;
    const losingTrades = trades.filter(t => t.action === 'SELL' && t.profit < 0).length;
    const totalTrades = trades.filter(t => t.action === 'SELL').length;
    const decisiveTrades = winningTrades + losingTrades;
    const winRate = decisiveTrades > 0 ? (winningTrades / decisiveTrades) * 100 : 0;

    if (totalTrades === 0) {
      const reasonParts = [
        `markets=${marketCount}`,
        `snapshots=${snapshotCount}`,
        `distinctIntervals=${distinctIntervals.size}`,
        `marketsWithMeaningfulMovement=${marketsWithMeaningfulMovement}`,
      ];
      const hint = !hasMeaningfulMovement
        ? 'Selected market has flat price history in the chosen window — strategy thresholds were never crossed. Try a more volatile market, a longer window, or lower the buy/sell threshold.'
        : 'Strategy thresholds were not crossed in this window. Try a different strategy, a longer window, or lower the buy/sell threshold.';
      const error = new Error(`Backtest produced 0 trades (${reasonParts.join(', ')}). ${hint}`);
      error.code = 'BACKTEST_NO_TRADES';
      throw error;
    }

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
      dataHealth: {
        distinctIntervals: distinctIntervals.size,
        marketsWithHistory,
        marketsWithMeaningfulMovement,
        lowSignalData: !hasMeaningfulMovement
      },
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

    // Await Discord notification — on Vercel serverless, fire-and-forget
    // promises are killed when the lambda response is returned. Awaiting
    // ensures the webhook actually fires before the function exits.
    const notificationMarketId = String(finalParams?.marketId || '').trim();
    let notificationMarketQuestion = null;
    if (notificationMarketId) {
      const liveMarket = await fetchMarketMetadata(notificationMarketId).catch(() => null);
      notificationMarketQuestion =
        liveMarket?.question ||
        liveMarket?.title ||
        snapshots.find((s) => String(s.marketId) === notificationMarketId)?.question ||
        null;
    }

    try {
      await discord.notifyBacktestCompleted({
        groupName,
        strategyName,
        backtest: savedBacktest,
        marketId: notificationMarketId || null,
        marketQuestion: notificationMarketQuestion,
      })
    } catch (err) {
      console.error('[discord] notifyBacktestCompleted failed:', err?.message || err)
    }

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
    const where = groupName
      ? {
          group: { name: groupName }
        }
      : undefined;

    const backtests = await prisma.backtest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        strategyName: true,
        startTime: true,
        endTime: true,
        initialCapital: true,
        finalValue: true,
        pnl: true,
        roi: true,
        winRate: true,
        totalTrades: true,
        winningTrades: true,
        losingTrades: true,
        maxDrawdown: true,
        params: true,
        tradeHistory: true,
        createdAt: true,
        group: {
          select: {
            name: true
          }
        }
      }
    });

    const extractMarketIdFromBacktest = (backtest) => {
      let params = {};
      if (backtest?.params && typeof backtest.params === 'object') {
        params = backtest.params;
      } else if (typeof backtest?.params === 'string') {
        try {
          const parsed = JSON.parse(backtest.params);
          if (parsed && typeof parsed === 'object') {
            params = parsed;
          }
        } catch {
          params = {};
        }
      }

      const paramMarketId = String(params?.marketId || '').trim();
      if (paramMarketId) {
        return paramMarketId;
      }

      const trades = normalizeTradeHistory(backtest?.tradeHistory);
      const firstTradeWithMarket = trades.find((trade) => String(trade?.marketId || '').trim());
      return String(firstTradeWithMarket?.marketId || '').trim();
    };

    const marketIds = [...new Set(backtests.map((item) => extractMarketIdFromBacktest(item)).filter(Boolean))];

    const marketSnapshots = marketIds.length > 0
      ? await prisma.polymarketMarketSnapshot.findMany({
          where: {
            marketId: { in: marketIds }
          },
          orderBy: {
            intervalStart: 'desc'
          },
          distinct: ['marketId'],
          select: {
            marketId: true,
            question: true,
            category: true
          }
        })
      : [];

    const marketSnapshotById = new Map(marketSnapshots.map((market) => [String(market.marketId), market]));

    return backtests.map((item) => {
      const marketId = extractMarketIdFromBacktest(item);
      const marketSnapshot = marketSnapshotById.get(String(marketId));

      return {
        ...item,
        marketId: marketId || null,
        marketQuestion: marketSnapshot?.question || null,
        marketCategory: marketSnapshot?.category || null,
        tradeHistory: undefined
      };
    });
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
      select: {
        id: true,
        strategyName: true,
        startTime: true,
        endTime: true,
        initialCapital: true,
        finalValue: true,
        pnl: true,
        roi: true,
        winRate: true,
        totalTrades: true,
        winningTrades: true,
        losingTrades: true,
        maxDrawdown: true,
        params: true,
        createdAt: true,
        group: {
          select: {
            name: true
          }
        }
      }
    });
    return backtest;
  } catch (error) {
    console.error('Error fetching best backtest:', error);
    throw error;
  }
}

function buildFallbackMarketImage(question, category, marketId) {
  const label = String(question || category || `Market ${marketId}`)
    .trim()
    .slice(0, 80)
    .replace(/\s+/g, ' ');

  return `https://via.placeholder.com/1200x400.png?text=${encodeURIComponent(label || 'Polymarket Market')}`;
}

async function fetchMarketMetadata(marketId) {
  const normalizedMarketId = String(marketId || '').trim();
  if (!normalizedMarketId) {
    return null;
  }

  try {
    const response = await fetch(`https://gamma-api.polymarket.com/markets/${encodeURIComponent(normalizedMarketId)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const market = await response.json();
    const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
    const outcomePrices = Array.isArray(market?.outcomePrices) ? market.outcomePrices : [];

    return {
      marketId: String(market?.id || normalizedMarketId),
      title: market?.title || market?.question || null,
      question: market?.question || market?.title || null,
      description: market?.description || null,
      image: market?.image || market?.icon || null,
      category: market?.category || market?.subcategory || null,
      outcomes,
      outcomePrices,
      endDate: market?.endDate || market?.end_date_iso || market?.closesAt || null
    };
  } catch (error) {
    return null;
  }
}

function normalizeTradeHistory(tradeHistory) {
  if (Array.isArray(tradeHistory)) {
    return tradeHistory;
  }

  if (typeof tradeHistory === 'string') {
    try {
      const parsed = JSON.parse(tradeHistory);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function getBacktestReport(backtestId) {
  const id = Number(backtestId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid backtest id');
  }

  const backtest = await prisma.backtest.findUnique({
    where: { id },
    include: { group: true }
  });

  if (!backtest) {
    return null;
  }

  const tradeHistory = normalizeTradeHistory(backtest.tradeHistory);
  const marketIds = [...new Set(tradeHistory.map((trade) => String(trade?.marketId || '').trim()).filter(Boolean))];

  const marketPriceSnapshots = marketIds.length > 0
    ? await prisma.polymarketMarketSnapshot.findMany({
        where: {
          marketId: { in: marketIds },
          intervalStart: {
            gte: backtest.startTime || undefined,
            lte: backtest.endTime || undefined
          }
        },
        orderBy: {
          intervalStart: 'asc'
        },
        select: {
          marketId: true,
          intervalStart: true,
          outcomes: true,
          outcomePrices: true
        }
      })
    : [];

  const marketSnapshots = marketIds.length > 0
    ? await prisma.polymarketMarketSnapshot.findMany({
        where: {
          marketId: { in: marketIds }
        },
        orderBy: {
          intervalStart: 'desc'
        },
        distinct: ['marketId'],
        select: {
          marketId: true,
          question: true,
          category: true,
          intervalStart: true
        }
      })
    : [];

  const marketDetails = await Promise.all(
    marketSnapshots.map(async (market) => {
      const liveMarket = await fetchMarketMetadata(market.marketId);
      const question = liveMarket?.question || market.question || null;
      const category = liveMarket?.category || market.category || null;

      return {
        marketId: market.marketId,
        title: liveMarket?.title || question,
        question,
        description: liveMarket?.description || null,
        category,
        image: liveMarket?.image || buildFallbackMarketImage(question, category, market.marketId),
        outcomes: liveMarket?.outcomes || [],
        outcomePrices: liveMarket?.outcomePrices || [],
        endDate: liveMarket?.endDate || null,
        intervalStart: market.intervalStart
      };
    })
  );

  const marketById = new Map(marketDetails.map((market) => [market.marketId, market]));
  const marketPriceSeries = marketPriceSnapshots.reduce((acc, snapshot) => {
    const marketId = String(snapshot?.marketId || '').trim();
    if (!marketId) {
      return acc;
    }

    const { yesPrice, noPrice } = getYesNoPrices(snapshot);
    const fallbackPrice = getPrimaryPrice(snapshot);

    if (!Number.isFinite(fallbackPrice) || fallbackPrice <= 0) {
      return acc;
    }

    if (!acc[marketId]) {
      acc[marketId] = [];
    }

    acc[marketId].push({
      time: snapshot.intervalStart,
      price: fallbackPrice,
      yesPrice,
      noPrice
    });

    return acc;
  }, {});

  const trades = tradeHistory.map((trade, index) => {
    const marketId = String(trade?.marketId || '');
    const market = marketById.get(marketId);

    return {
      index: index + 1,
      time: trade?.time || null,
      action: trade?.action || null,
      marketId,
      marketQuestion: market?.question || null,
      marketCategory: market?.category || null,
      price: Number(trade?.price || 0),
      amount: Number(trade?.amount || 0),
      shares: Number(trade?.shares || 0),
      profit: trade?.profit !== undefined && trade?.profit !== null ? Number(trade.profit) : null,
      signal: trade?.signal || null,
      cashBalance: Number(trade?.cashBalance || 0),
      positionShares: Number(trade?.positionShares || 0)
    };
  });

  const buyCount = trades.filter((trade) => trade.action === 'BUY').length;
  const sellCount = trades.filter((trade) => trade.action === 'SELL').length;
  const winningSellCount = trades.filter((trade) => trade.action === 'SELL' && Number(trade.profit || 0) > 0).length;
  const losingSellCount = trades.filter((trade) => trade.action === 'SELL' && Number(trade.profit || 0) <= 0).length;

  return {
    backtest: {
      id: backtest.id,
      createdAt: backtest.createdAt,
      strategyName: backtest.strategyName,
      groupName: backtest.group?.name || null,
      startTime: backtest.startTime,
      endTime: backtest.endTime,
      initialCapital: backtest.initialCapital,
      finalValue: backtest.finalValue,
      pnl: backtest.pnl,
      roi: backtest.roi,
      winRate: backtest.winRate,
      maxDrawdown: backtest.maxDrawdown,
      params: backtest.params,
      totalTrades: backtest.totalTrades,
      winningTrades: backtest.winningTrades,
      losingTrades: backtest.losingTrades
    },
    summary: {
      transactionCount: trades.length,
      buyCount,
      sellCount,
      winningSellCount,
      losingSellCount,
      uniqueMarkets: marketIds.length
    },
    markets: marketDetails,
    marketPriceSeries,
    trades
  };
}

module.exports = {
  STRATEGIES,
  runBacktest,
  getBacktestResults,
  getBestBacktest,
  getBacktestReport,
  calculateSharpeRatio,
  calculateProfitFactor
};
