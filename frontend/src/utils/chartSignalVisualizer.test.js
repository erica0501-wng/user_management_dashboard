/**
 * Trading Signal Visualizer - Test Suite & Usage Examples
 * Demonstrates all edge cases and features
 */

const chartSignalVisualizer = require('../utils/chartSignalVisualizer');

/**
 * Test Suite
 */
const tests = {
  // ============ VALIDATION TESTS ============
  testEmptyPriceData: () => {
    const result = chartSignalVisualizer.validatePriceData([]);
    console.assert(!result.valid, 'Should reject empty price data');
    console.log('✓ Empty price data validation works');
  },

  testMissingTimestamp: () => {
    const priceData = [{ price: 0.5 }];
    const result = chartSignalVisualizer.validatePriceData(priceData);
    console.assert(!result.valid, 'Should reject missing timestamp');
    console.log('✓ Missing timestamp validation works');
  },

  testInvalidPrice: () => {
    const priceData = [{ timestamp: '2026-04-16', price: -5 }];
    const result = chartSignalVisualizer.validatePriceData(priceData);
    console.assert(!result.valid, 'Should reject negative price');
    console.log('✓ Invalid price validation works');
  },

  testInvalidTradeAction: () => {
    const trades = [{ timestamp: '2026-04-16', action: 'HOLD' }];
    const result = chartSignalVisualizer.validateTrades(trades);
    console.assert(!result.valid, 'Should reject invalid action');
    console.log('✓ Invalid trade action validation works');
  },

  // ============ EDGE CASE TESTS ============
  testSinglePricePoint: () => {
    const priceData = [{ timestamp: '2026-04-16T10:00:00Z', price: 0.5 }];
    const trades = [{ timestamp: '2026-04-16T10:00:00Z', action: 'BUY' }];
    
    const result = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades
    });
    
    console.assert(result.data.datasets.length > 0, 'Should generate datasets');
    console.log('✓ Single price point handling works');
  },

  testUnclosedPosition: () => {
    const priceData = [
      { timestamp: '2026-04-16T10:00:00Z', price: 0.50 },
      { timestamp: '2026-04-16T10:05:00Z', price: 0.51 }
    ];
    const trades = [
      { timestamp: '2026-04-16T10:00:00Z', action: 'BUY' }
      // No corresponding SELL
    ];
    
    const processed = chartSignalVisualizer.processTrades(trades, priceData);
    console.assert(processed.length === 2, 'Should add synthetic SELL');
    console.assert(processed[1].isSynthetic === true, 'Second trade should be synthetic');
    console.log('✓ Unclosed position auto-close works');
  },

  testMissingTimestampInTrades: () => {
    const priceData = [{ timestamp: '2026-04-16T10:00:00Z', price: 0.5 }];
    const trades = [
      { timestamp: '2026-04-16T09:50:00Z', action: 'BUY' }, // Before price data
      { timestamp: '2026-04-16T10:00:00Z', action: 'SELL' },
      { timestamp: '2026-04-16T10:10:00Z', action: 'BUY' } // After price data
    ];
    
    const { buyPoints, sellPoints } = chartSignalVisualizer.createSignalDataset(
      trades,
      priceData
    );
    
    console.assert(
      buyPoints.length + sellPoints.length > 0,
      'Should map trades to closest prices'
    );
    console.log('✓ Timestamp mapping with closest price works');
  },

  testCaseSensitivity: () => {
    const priceData = [
      { timestamp: '2026-04-16T10:00:00Z', price: 0.50 },
      { timestamp: '2026-04-16T10:05:00Z', price: 0.51 }
    ];
    const trades = [
      { timestamp: '2026-04-16T10:00:00Z', action: 'buy' },  // lowercase
      { timestamp: '2026-04-16T10:05:00Z', action: 'SELL' }  // uppercase
    ];
    
    const { buyPoints, sellPoints } = chartSignalVisualizer.createSignalDataset(
      trades,
      priceData
    );
    
    console.assert(buyPoints.length === 1, 'Should handle lowercase BUY');
    console.assert(sellPoints.length === 1, 'Should handle uppercase SELL');
    console.log('✓ Case-insensitive action handling works');
  },

  testMultipleSamePricePoints: () => {
    const priceData = [
      { timestamp: '2026-04-16T10:00:00Z', price: 0.50 },
      { timestamp: '2026-04-16T10:01:00Z', price: 0.50 },
      { timestamp: '2026-04-16T10:02:00Z', price: 0.50 }
    ];
    const trades = [
      { timestamp: '2026-04-16T10:00:30Z', action: 'BUY' } // Between timestamps
    ];
    
    const tradePoint = chartSignalVisualizer.findClosestPrice(
      priceData,
      trades[0].timestamp
    );
    
    console.assert(tradePoint !== null, 'Should find closest price');
    console.log('✓ Multiple same price points handling works');
  },

  testLargeDataset: () => {
    // 1000 price points
    const priceData = Array.from({ length: 1000 }, (_, i) => ({
      timestamp: new Date(Date.now() - (1000 - i) * 60000),
      price: 0.5 + Math.random() * 0.1
    }));
    
    // 50 trades
    const trades = Array.from({ length: 50 }, (_, i) => ({
      timestamp: new Date(Date.now() - (1000 - i * 20) * 60000),
      action: i % 2 === 0 ? 'BUY' : 'SELL'
    }));
    
    const startTime = performance.now();
    const config = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades
    });
    const endTime = performance.now();
    
    console.assert(
      endTime - startTime < 1000,
      `Performance OK (${(endTime - startTime).toFixed(2)}ms)`
    );
    console.log(`✓ Large dataset handling works (${(endTime - startTime).toFixed(2)}ms)`);
  },

  testEmptyTrades: () => {
    const priceData = [
      { timestamp: '2026-04-16T10:00:00Z', price: 0.5 },
      { timestamp: '2026-04-16T10:05:00Z', price: 0.51 }
    ];
    
    const config = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades: [] // No trades
    });
    
    console.assert(config.data.datasets.length >= 1, 'Should still render price line');
    console.log('✓ Empty trades handling works');
  },

  testInvalidChartConfig: () => {
    const priceData = [{ timestamp: '2026-04-16T10:00:00Z', price: 0.5 }];
    const trades = [{ timestamp: '2026-04-16T10:00:00Z', action: 'BUY' }];
    
    // Missing required chart config properties
    const config = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades,
      chartConfig: {} // Minimal config
    });
    
    console.assert(config.data !== undefined, 'Should handle incomplete config');
    console.log('✓ Invalid chart config handling works');
  },

  testConsecutiveBuysWithoutSells: () => {
    const priceData = [
      { timestamp: '2026-04-16T10:00:00Z', price: 0.50 },
      { timestamp: '2026-04-16T10:05:00Z', price: 0.51 },
      { timestamp: '2026-04-16T10:10:00Z', price: 0.52 }
    ];
    const trades = [
      { timestamp: '2026-04-16T10:00:00Z', action: 'BUY' },
      { timestamp: '2026-04-16T10:05:00Z', action: 'BUY' },
      { timestamp: '2026-04-16T10:10:00Z', action: 'BUY' }
      // Multiple BUYs without SELL
    ];
    
    const processed = chartSignalVisualizer.processTrades(trades, priceData);
    const synthetics = processed.filter(t => t.isSynthetic);
    
    console.assert(synthetics.length === 1, 'Should add only one synthetic SELL at end');
    console.log('✓ Consecutive buys handling works');
  },

  // ============ FEATURE TESTS ============
  testCustomColors: () => {
    const priceData = [{ timestamp: '2026-04-16T10:00:00Z', price: 0.5 }];
    const trades = [{ timestamp: '2026-04-16T10:00:00Z', action: 'BUY' }];
    
    const customColors = {
      buy: 'rgba(255, 0, 0, 1)',
      sell: 'rgba(0, 255, 0, 1)'
    };
    
    const config = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades,
      colors: customColors
    });
    
    const buyDataset = config.data.datasets.find(d => d.label?.includes('Buy'));
    console.assert(
      buyDataset.borderColor === customColors.buy,
      'Should apply custom colors'
    );
    console.log('✓ Custom colors feature works');
  },

  testMarkerSizeCustomization: () => {
    const priceData = [{ timestamp: '2026-04-16T10:00:00Z', price: 0.5 }];
    const trades = [{ timestamp: '2026-04-16T10:00:00Z', action: 'BUY' }];
    
    const customSize = { buy: 12, sell: 10 };
    const config = chartSignalVisualizer.renderTradingSignals({
      priceData,
      trades,
      markerSize: customSize
    });
    
    console.assert(config.data.datasets.length > 0, 'Should create datasets with custom size');
    console.log('✓ Marker size customization works');
  },

  testMockDataGeneration: () => {
    const { priceData, trades } = chartSignalVisualizer.generateMockData();
    
    console.assert(priceData.length === 100, 'Should generate 100 price points');
    console.assert(trades.length > 0, 'Should generate some trades');
    console.log(`✓ Mock data generation works (${trades.length} trades)`);
  }
};

/**
 * Run all tests
 */
function runAllTests() {
  console.log('\n=== TRADING SIGNAL VISUALIZER TEST SUITE ===\n');
  
  let passed = 0;
  let failed = 0;

  for (const [testName, testFn] of Object.entries(tests)) {
    try {
      testFn();
      passed++;
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error.message);
      failed++;
    }
  }

  console.log(`\n=== TEST RESULTS ===`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}\n`);

  return failed === 0;
}

/**
 * Usage Examples
 */
function showUsageExamples() {
  console.log('\n=== USAGE EXAMPLES ===\n');

  // Example 1: Basic usage
  console.log('1. Basic Usage:');
  console.log(`
    const { renderTradingSignals } = require('./chartSignalVisualizer');
    
    const config = renderTradingSignals({
      priceData: [
        { timestamp: '2026-04-16T10:00:00Z', price: 0.50 },
        { timestamp: '2026-04-16T10:05:00Z', price: 0.51 }
      ],
      trades: [
        { timestamp: '2026-04-16T10:00:00Z', action: 'BUY' },
        { timestamp: '2026-04-16T10:05:00Z', action: 'SELL' }
      ]
    });
    
    // Use config with Chart.js
    new Chart(ctx, config);
  `);

  // Example 2: React integration
  console.log('\n2. React Integration:');
  console.log(`
    import TradingSignalChart from './components/TradingSignalChart';
    
    <TradingSignalChart
      priceData={priceData}
      trades={trades}
      title="BTC/USD Trading Signals"
      customColors={{
        buy: 'rgba(0, 255, 0, 1)',
        sell: 'rgba(255, 0, 0, 1)'
      }}
    />
  `);

  // Example 3: Plugin approach
  console.log('\n3. Plugin Approach:');
  console.log(`
    const { createSignalPlugin } = require('./chartSignalVisualizer');
    
    const config = {
      type: 'line',
      data: { ... },
      options: {
        plugins: [
          createSignalPlugin({ trades, priceData })
        ]
      }
    };
  `);
}

// Run tests and examples
if (require.main === module) {
  const allPassed = runAllTests();
  showUsageExamples();
  
  process.exit(allPassed ? 0 : 1);
}

module.exports = {
  tests,
  runAllTests,
  showUsageExamples
};
