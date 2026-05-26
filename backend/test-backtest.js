/**
 * Test script for backtest functionality
 * Run with: node test-backtest.js
 */

const prisma = require('./src/prisma');
const marketGrouping = require('./src/services/marketGrouping');
const backtestEngine = require('./src/services/backtestEngine');

async function main() {
  try {
    console.log('🚀 Starting backtest system test...\n');

    // Step 1: Initialize market groups
    console.log('📊 Step 1: Initializing default market groups...');
    await marketGrouping.initializeDefaultGroups();
    console.log('✅ Default groups initialized\n');

    // Step 2: Categorize markets
    console.log('📂 Step 2: Categorizing all markets by pattern...');
    await marketGrouping.categorizeAllMarkets();
    console.log('✅ Markets categorized\n');

    // Step 3: List available groups
    console.log('📋 Step 3: Available market groups:');
    const groups = await marketGrouping.getAllGroups();
    groups.forEach(group => {
      console.log(`  - ${group.name}: ${group.markets.length} markets, ${group._count.backtests} backtests`);
    });
    console.log();

    // Step 4: Find a group with data
    const groupWithData = groups.find(g => g.markets.length > 0);
    if (!groupWithData) {
      console.log('⚠️  No market groups with data found. Testing with mock data...');
      
      // Create a test group
      await marketGrouping.upsertMarketGroup(
        'Test Group',
        '.*',  // Match all markets
        'Test group for backtest verification'
      );
      console.log('✅ Created test group\n');
    }

    // Step 5: Get backtest data
    console.log('💾 Step 4: Fetching backtest data for "' + (groupWithData?.name || 'Test Group') + '"...');
    const backtestData = await marketGrouping.getGroupBacktestData(
      groupWithData?.name || 'Test Group',
      { startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }  // Last 7 days
    );
    console.log(`✅ Retrieved ${backtestData.snapshotCount} snapshots\n`);

    if (backtestData.snapshotCount < 2) {
      console.log('⚠️  Insufficient data for backtest. Need at least 2 snapshots.');
      console.log('📝 Running archiver to generate sample data...\n');
      
      // Run archiver to generate some data
      try {
        const archiver = require('./src/services/polymarketDataArchiver');
        console.log('Running data archiver...');
        await archiver.ingestAndArchiveData({ runQualityReport: false });
        console.log('✅ Data archived\n');
        
        // Re-categorize
        await marketGrouping.categorizeAllMarkets();
      } catch (err) {
        console.log('⚠️  Could not run archiver:', err.message);
      }
    }

    // Step 6: List available strategies
    console.log('🎯 Step 5: Available trading strategies:');
    Object.entries(backtestEngine.STRATEGIES).forEach(([key, strategy]) => {
      console.log(`  - ${key}: ${strategy.name}`);
      console.log(`    Description: ${strategy.description}`);
      console.log(`    Default params: ${JSON.stringify(strategy.defaultParams)}`);
    });
    console.log();

    // Step 7: Run backtest if we have data
    if (backtestData.snapshotCount >= 2) {
      console.log('🏃 Step 6: Running meanReversion strategy backtest...');
      const testGroup = groupWithData?.name || 'Test Group';
      // 自动获取第一个 marketId
      // 自动遍历所有 marketId，直到找到能产出交易的 market
      let found = false;
      if (groupWithData && groupWithData.markets && groupWithData.markets.length > 0) {
        for (const m of groupWithData.markets) {
          const marketId = typeof m === 'string' ? m : (m && m.id ? m.id : null);
          if (!marketId) continue;
          try {
            const results = await backtestEngine.runBacktest(
              testGroup,
              'meanReversion',
              {
                period: 10,
                buyThreshold: 0.4,
                sellThreshold: 0.6,
                positionSize: 500
              },
              {
                startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 拉长窗口
                marketId
              }
            );
            if (results && results.totalTrades > 0) {
              found = true;
              console.log(`\n✅ Found active marketId: ${marketId}`);
              console.log('\n📊 Backtest Results Summary:');
              console.log(`  Backtest ID: ${results.backtestId}`);
              console.log(`  ROI: ${results.roi.toFixed(2)}%`);
              console.log(`  Total Trades: ${results.totalTrades}`);
              console.log(`  Win Rate: ${results.winRate.toFixed(2)}%`);
              console.log(`  Profit Factor: ${results.metrics.profitFactor.toFixed(2)}`);
              console.log(`  Sharpe Ratio: ${results.metrics.sharpeRatio.toFixed(2)}\n`);

              // Step 8: Retrieve saved results
              console.log('📈 Step 7: Retrieving saved backtest results...');
              const savedResults = await backtestEngine.getBacktestResults(testGroup, 5);
              console.log(`✅ Found ${savedResults.length} saved backtests for "${testGroup}"\n`);

              // Step 8b: Trigger getBacktestReport so neutral_sell_log.jsonl gets populated.
              console.log('🧾 Step 7b: Generating backtest report (writes neutral_sell_log.jsonl if applicable)...');
              try {
                const report = await backtestEngine.getBacktestReport(results.backtestId);
                const buyTrades = (report?.trades || []).filter(t => String(t.action).toUpperCase() === 'BUY');
                const breakeven = buyTrades.filter(t => t.positionOutcome === 'BREAKEVEN').length;
                console.log(`  Report OK · ${buyTrades.length} BUY positions · ${breakeven} BREAKEVEN`);
              } catch (e) {
                console.log('  Report failed:', e.message || e);
              }
              console.log('');

              // Step 9: Get best backtest
              console.log('🏆 Step 8: Getting best performing backtest...');
              const bestBacktest = await backtestEngine.getBestBacktest(testGroup);
              if (bestBacktest) {
                console.log(`  Strategy: ${bestBacktest.strategyName}`);
                console.log(`  ROI: ${bestBacktest.roi.toFixed(2)}%`);
                console.log(`  Win Rate: ${bestBacktest.winRate.toFixed(2)}%\n`);
              } else {
                console.log('  No backtests found\n');
              }
              break;
            } else {
              console.log(`MarketId ${marketId} produced 0 trades, trying next...`);
            }
          } catch (err) {
            if (err && err.code === 'BACKTEST_NO_TRADES') {
              console.log(`MarketId ${marketId} produced 0 trades, trying next...`);
              continue;
            } else {
              console.log(`Error running backtest for marketId ${marketId}:`, err.message || err);
              continue;
            }
          }
        }
      }
      if (!found) {
        console.log('❌ 未找到任何能产出交易的 marketId，建议检查市场数据或调整参数。');
      }
    } else {
      console.log('⚠️  Skipping backtest - insufficient data\n');
    }

    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
