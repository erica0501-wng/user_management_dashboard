/**
 * Chart Signal Visualizer
 * Renders trading signals (buy/sell) on top of price charts
 * 
 * @module chartSignalVisualizer
 */

/**
 * Validates price data structure and content
 * @param {Array} priceData - Array of {timestamp, price} objects
 * @returns {Object} {valid: boolean, error: string|null}
 */
function validatePriceData(priceData) {
  if (!Array.isArray(priceData)) {
    return { valid: false, error: 'priceData must be an array' };
  }
  
  if (priceData.length === 0) {
    return { valid: false, error: 'priceData cannot be empty' };
  }
  
  for (let i = 0; i < priceData.length; i++) {
    const item = priceData[i];
    if (!item.timestamp) {
      return { valid: false, error: `Item ${i} missing timestamp` };
    }
    if (typeof item.price !== 'number' || item.price <= 0) {
      return { valid: false, error: `Item ${i} has invalid price: ${item.price}` };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Validates trades data structure and content
 * @param {Array} trades - Array of {timestamp, action} objects
 * @returns {Object} {valid: boolean, error: string|null}
 */
function validateTrades(trades) {
  if (!Array.isArray(trades)) {
    return { valid: false, error: 'trades must be an array' };
  }
  
  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    if (!trade.timestamp) {
      return { valid: false, error: `Trade ${i} missing timestamp` };
    }
    if (!['BUY', 'SELL', 'buy', 'sell'].includes(trade.action)) {
      return { valid: false, error: `Trade ${i} has invalid action: ${trade.action}` };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Finds the closest price point to a given timestamp
 * @param {Array} priceData - Sorted price data
 * @param {Date|number|string} targetTimestamp - Timestamp to find
 * @returns {Object|null} Closest price data point or null if not found
 */
function findClosestPrice(priceData, targetTimestamp) {
  if (!priceData || priceData.length === 0) return null;
  
  const targetTime = new Date(targetTimestamp).getTime();
  
  let closest = priceData[0];
  let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime);
  
  for (const point of priceData) {
    const pointTime = new Date(point.timestamp).getTime();
    const diff = Math.abs(pointTime - targetTime);
    
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }
  
  return closest;
}

/**
 * Processes trades to add synthetic sell for unclosed positions
 * @param {Array} trades - Original trades array
 * @param {Array} priceData - Price data for reference
 * @returns {Array} Processed trades with synthetic sells
 */
function processTrades(trades, priceData) {
  if (!trades || trades.length === 0) return [];
  
  const processed = [...trades];
  
  // Check if last trade is a BUY without matching SELL
  const lastTrade = processed[processed.length - 1];
  const normalizedAction = lastTrade.action.toUpperCase();
  
  if (normalizedAction === 'BUY' && priceData && priceData.length > 0) {
    const lastPrice = priceData[priceData.length - 1];
    processed.push({
      timestamp: lastPrice.timestamp,
      action: 'SELL',
      isSynthetic: true,
      reason: 'Auto-close for unclosed position'
    });
  }
  
  return processed;
}

/**
 * Creates Chart.js dataset for signals (markers)
 * @param {Array} trades - Processed trades array
 * @param {Array} priceData - Price data for timestamp mapping
 * @returns {Object} Chart.js compatible dataset
 */
function createSignalDataset(trades, priceData) {
  const buyPoints = [];
  const sellPoints = [];
  
  for (const trade of trades) {
    const pricePoint = findClosestPrice(priceData, trade.timestamp);
    if (!pricePoint) continue;
    
    const action = trade.action.toUpperCase();
    const label = trade.isSynthetic ? '(Auto-close)' : '';
    
    if (action === 'BUY') {
      buyPoints.push({
        x: new Date(pricePoint.timestamp),
        y: pricePoint.price,
        label: `Buy ${label}`,
        trade: trade
      });
    } else if (action === 'SELL') {
      sellPoints.push({
        x: new Date(pricePoint.timestamp),
        y: pricePoint.price,
        label: `Sell ${label}`,
        trade: trade
      });
    }
  }
  
  return { buyPoints, sellPoints };
}

/**
 * Main function to visualize trading signals on a Chart.js price chart
 * 
 * @param {Object} params - Configuration object
 * @param {Array} params.priceData - Array of {timestamp, price} objects
 * @param {Array} params.trades - Array of {timestamp, action} objects
 * @param {Object} params.chartConfig - Existing Chart.js config (optional)
 * @param {Object} params.colors - Custom colors {buy, sell, synthetic}
 * @param {Object} params.markerSize - Marker sizes
 * @returns {Object} Enhanced Chart.js configuration with signal markers
 * 
 * @example
 * const config = renderTradingSignals({
 *   priceData: [{timestamp: '2026-04-16T10:00:00Z', price: 0.50}],
 *   trades: [{timestamp: '2026-04-16T10:00:00Z', action: 'BUY'}],
 *   colors: {buy: 'rgba(34, 197, 94, 1)', sell: 'rgba(239, 68, 68, 1)'}
 * });
 */
function renderTradingSignals({
  priceData,
  trades,
  chartConfig = {},
  colors = {
    buy: 'rgba(34, 197, 94, 1)',        // Green
    sell: 'rgba(239, 68, 68, 1)',       // Red
    synthetic: 'rgba(212, 212, 216, 1)' // Gray
  },
  markerSize = {
    buy: 8,
    sell: 8,
    synthetic: 6
  }
} = {}) {
  
  // Validation
  const priceValidation = validatePriceData(priceData);
  if (!priceValidation.valid) {
    console.error(`[Signal Visualizer] Price data validation failed: ${priceValidation.error}`);
    return chartConfig;
  }
  
  const tradeValidation = validateTrades(trades);
  if (!tradeValidation.valid) {
    console.error(`[Signal Visualizer] Trades validation failed: ${tradeValidation.error}`);
    return chartConfig;
  }
  
  // Process trades
  const processedTrades = processTrades(trades, priceData);
  const { buyPoints, sellPoints } = createSignalDataset(processedTrades, priceData);
  
  // Sort price data by timestamp for chart
  const sortedPriceData = [...priceData].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  // Create enhanced config
  const enhancedConfig = {
    ...chartConfig,
    data: {
      ...chartConfig.data,
      datasets: [
        // Price line (if exists)
        ...(chartConfig.data?.datasets || []),
        
        // Buy signal markers (green stars)
        {
          label: 'Buy Signals',
          data: buyPoints.map(p => ({ x: p.x, y: p.y })),
          type: 'bubble',
          borderColor: colors.buy,
          backgroundColor: colors.buy,
          borderWidth: 2,
          pointRadius: markerSize.buy,
          pointStyle: 'star',
          showLine: false,
          fill: false,
          tension: 0,
          pointHoverRadius: markerSize.buy + 2,
          borderSkipped: false,
          order: 1
        },
        
        // Sell signal markers (red stars)
        {
          label: 'Sell Signals',
          data: sellPoints.map(p => ({ 
            x: p.x, 
            y: p.y,
            isSynthetic: p.trade?.isSynthetic
          })),
          type: 'bubble',
          borderColor: colors.sell,
          backgroundColor: colors.sell,
          borderWidth: 2,
          pointRadius: (ctx) => {
            // Smaller size for synthetic sells
            const isSynthetic = ctx.raw?.isSynthetic;
            return isSynthetic ? markerSize.synthetic : markerSize.sell;
          },
          pointStyle: 'star',
          showLine: false,
          fill: false,
          tension: 0,
          pointHoverRadius: markerSize.sell + 2,
          borderSkipped: false,
          order: 1
        }
      ]
    },
    options: {
      ...chartConfig.options,
      plugins: {
        ...chartConfig.options?.plugins,
        legend: {
          ...chartConfig.options?.plugins?.legend,
          display: true,
          position: 'top'
        },
        tooltip: {
          ...chartConfig.options?.plugins?.tooltip,
          callbacks: {
            label: function(context) {
              const original = chartConfig.options?.plugins?.tooltip?.callbacks?.label;
              if (original && typeof original === 'function') {
                const originalLabel = original(context);
                if (originalLabel) return originalLabel;
              }
              
              if (context.dataset.label.includes('Buy')) {
                return `Buy Signal @ $${context.raw.y.toFixed(4)}`;
              } else if (context.dataset.label.includes('Sell')) {
                return `Sell Signal @ $${context.raw.y.toFixed(4)}`;
              }
              return context.formattedValue;
            }
          }
        }
      }
    }
  };
  
  return enhancedConfig;
}

/**
 * Alternative: Render signals as separate chart plugins (more flexible)
 * @param {Object} params - Configuration
 * @returns {Object} Chart.js plugin
 */
function createSignalPlugin({
  trades,
  priceData,
  colors = {
    buy: 'rgba(34, 197, 94, 1)',
    sell: 'rgba(239, 68, 68, 1)'
  }
} = {}) {
  
  return {
    id: 'tradingSignalsPlugin',
    
    afterDatasetsDraw(chart) {
      if (!trades || !priceData) return;
      
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      
      if (!xScale || !yScale) return;
      
      const processedTrades = processTrades(trades, priceData);
      
      for (const trade of processedTrades) {
        const pricePoint = findClosestPrice(priceData, trade.timestamp);
        if (!pricePoint) continue;
        
        const x = xScale.getPixelForValue(new Date(pricePoint.timestamp));
        const y = yScale.getPixelForValue(pricePoint.price);
        
        const color = trade.action.toUpperCase() === 'BUY' 
          ? colors.buy 
          : colors.sell;
        
        // Draw star marker
        drawStar(ctx, x, y, 8, color, 2);
      }
    }
  };
}

/**
 * Utility: Draw star marker on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Star size
 * @param {string} color - Fill color
 * @param {number} borderWidth - Border width
 */
function drawStar(ctx, x, y, size, color, borderWidth) {
  const points = 5;
  const innerRadius = size * 0.4;
  const outerRadius = size;
  
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Edge case handler: Generate mock data for testing
 * @returns {Object} Test data {priceData, trades}
 */
function generateMockData() {
  const now = new Date();
  const priceData = [];
  const trades = [];
  
  let price = 0.50;
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - (100 - i) * 60000); // 1 min intervals
    price += (Math.random() - 0.48) * 0.02; // Random walk
    price = Math.max(0.01, Math.min(0.99, price)); // Clamp between 0.01 and 0.99
    
    priceData.push({ timestamp, price });
    
    // Random trades
    if (Math.random() < 0.1) {
      trades.push({
        timestamp,
        action: Math.random() < 0.5 ? 'BUY' : 'SELL'
      });
    }
  }
  
  return { priceData, trades };
}

module.exports = {
  renderTradingSignals,
  createSignalPlugin,
  validatePriceData,
  validateTrades,
  findClosestPrice,
  processTrades,
  createSignalDataset,
  drawStar,
  generateMockData,
  // Utility exports
  validators: { validatePriceData, validateTrades },
  helpers: { findClosestPrice, processTrades, createSignalDataset }
};
