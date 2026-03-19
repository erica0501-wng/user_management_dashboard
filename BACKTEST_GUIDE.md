# Polymarket Backtest System - User Guide

## Overview

The backtest system allows you to:
1. **Organization**: Automatically group Polymarket data by market type (e.g., "Elon Tweets", "Mr Beast Videos")
2. **Analysis**: Run trading strategy backtests on historical archived data
3. **Performance Tracking**: Measure strategy ROI, win rates, and other metrics

## API Endpoints

### 1. Market Groups Management

#### Initialize Default Groups
```
POST /polymarket/market-groups/initialize
```
Creates 7 default market groups with predefined patterns:
- `Elon Tweets` - Elon Musk related markets
- `Mr Beast Videos` - MrBeast creator content markets
- `Crypto Events` - Cryptocurrency and blockchain markets
- `Stock Movements` - Stock price markets
- `Sports` - Sports events
- `Politics` - Political events
- `Tech Product Launches` - Technology product announcements

**Response:**
```json
{
  "success": true,
  "message": "Market groups initialized",
  "groups": [...]
}
```

#### Categorize All Markets
```
POST /polymarket/market-groups/categorize
```
Scans all archived market questions and automatically assigns them to groups based on pattern matching.

**Response:**
```json
{
  "success": true,
  "message": "Markets categorized successfully",
  "groups": [
    {
      "name": "Elon Tweets",
      "markets": [],
      "description": "Markets related to Elon Musk tweets..."
    },
    {
      "name": "Crypto Events",
      "markets": ["540844"],
      "description": "Markets related to cryptocurrency..."
    }
  ]
}
```

#### Get All Market Groups
```
GET /polymarket/market-groups
```

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "id": 1,
      "name": "Elon Tweets",
      "description": "Markets related to Elon Musk tweets and Twitter/X activity",
      "markets": ["123", "124"],
      "_count": { "backtests": 5 }
    }
  ]
}
```

#### Create/Update Custom Market Group
```
POST /polymarket/market-groups
Content-Type: application/json

{
  "name": "My Custom Group",
  "pattern": "custom|pattern|regex",
  "description": "Description of this group"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Market group created/updated",
  "group": {
    "id": 8,
    "name": "My Custom Group",
    "pattern": "custom|pattern|regex",
    "markets": ["123", "456"],
    "createdAt": "2026-03-19T02:40:39.156Z"
  }
}
```

### 2. Backtest Execution

#### Available Strategies
```
GET /polymarket/backtest/strategies
```

Returns all available trading strategies with their descriptions and default parameters:

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "key": "momentum",
      "name": "Momentum Strategy",
      "description": "Trades based on price momentum",
      "defaultParams": {
        "buyThreshold": 0.02,
        "sellThreshold": 0.02,
        "positionSize": 1000
      }
    },
    {
      "key": "meanReversion",
      "name": "Mean Reversion Strategy",
      "description": "Trades based on mean reversion principle",
      "defaultParams": {
        "period": 20,
        "buyThreshold": 0.3,
        "sellThreshold": 0.7,
        "positionSize": 1000
      }
    }
  ]
}
```

#### Run Backtest
```
POST /polymarket/backtest/run
Content-Type: application/json

{
  "groupName": "Elon Tweets",
  "strategyName": "momentum",
  "params": {
    "buyThreshold": 0.01,
    "sellThreshold": 0.01,
    "positionSize": 500
  },
  "options": {
    "startTime": "2026-03-10T00:00:00Z",
    "endTime": "2026-03-20T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backtest completed successfully",
  "results": {
    "groupName": "Elon Tweets",
    "strategyName": "momentum",
    "startTime": "2026-03-17T10:15:00.000Z",
    "endTime": "2026-03-19T09:00:00.000Z",
    "initialCapital": 5000,
    "finalValue": 5150,
    "pnl": 150,
    "roi": 3.0,
    "winRate": 75.5,
    "totalTrades": 20,
    "winningTrades": 15,
    "losingTrades": 5,
    "maxDrawdown": 2.5,
    "metrics": {
      "sharpeRatio": 1.23,
      "profitFactor": 2.15
    },
    "backtestId": 1,
    "trades": [
      {
        "time": "2026-03-17T10:20:00.000Z",
        "action": "BUY",
        "price": 0.55,
        "amount": 500,
        "signal": "Price momentum +1.2%",
        "cashBalance": 4500,
        "position": 500
      }
    ]
  }
}
```

#### Get Backtest Results for Group
```
GET /polymarket/backtest/results?groupName=Elon%20Tweets&limit=10
```

Retrieves historical backtest results for a specific market group.

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "strategyName": "momentum",
      "roi": 3.0,
      "winRate": 75.5,
      "pnl": 150,
      "createdAt": "2026-03-19T02:45:00.000Z"
    }
  ]
}
```

#### Get Best Backtest for Group
```
GET /polymarket/backtest/best?groupName=Elon%20Tweets
```

Returns the best-performing backtest for a specific market group (highest ROI).

**Response:**
```json
{
  "success": true,
  "backtest": {
    "id": 5,
    "groupId": 1,
    "strategyName": "meanReversion",
    "roi": 8.5,
    "winRate": 82.0,
    "totalTrades": 50,
    "createdAt": "2026-03-19T03:00:00.000Z"
  }
}
```

## Quick Start Example

### Step 1: Initialize Market Groups
```bash
curl -X POST http://localhost:3000/polymarket/market-groups/initialize \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 2: Categorize Markets
```bash
curl -X POST http://localhost:polymarket/market-groups/categorize \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 3: View Available Groups
```bash
curl http://localhost:3000/polymarket/market-groups
```

### Step 4: Run Backtest on "Crypto Events"
```bash
curl -X POST http://localhost:3000/polymarket/backtest/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "groupName": "Crypto Events",
    "strategyName": "momentum",
    "params": {
      "buyThreshold": 0.015,
      "sellThreshold": 0.015,
      "positionSize": 800
    }
  }'
```

### Step 5: Review Results
```bash
curl 'http://localhost:3000/polymarket/backtest/results?groupName=Crypto%20Events&limit=5'
```

## Trading Strategies

### 1. Momentum Strategy
- **When to use**: When markets have clear trend direction
- **Buy Signal**: Price rises by more than `buyThreshold` (e.g., 1%)
- **Sell Signal**: Price drops by more than `sellThreshold` (e.g., 1%)
- **Parameters**:
  - `buyThreshold`: Momentum threshold for buying (0-1)
  - `sellThreshold`: Momentum threshold for selling (0-1)
  - `positionSize`: Capital per trade

### 2. Mean Reversion Strategy
- **When to use**: When markets tend to bounce back to average
- **Buy Signal**: Price is in lower percentile (below `buyThreshold`)
- **Sell Signal**: Price is in upper percentile (above `sellThreshold`)
- **Parameters**:
  - `period`: Lookback window for calculating mean (e.g., 20 intervals)
  - `buyThreshold`: Buy when price is in lower X% (0-1)
  - `sellThreshold`: Sell when price is in upper X% (0-1)
  - `positionSize`: Capital per trade

### 3. Volatility Strategy (Coming Soon)
- Based on bid-ask spreads
- Trading when volatility exceeds thresholds

## Performance Metrics

Each backtest produces these metrics:

- **ROI (Return on Investment)**: `(Final Value - Initial Capital) / Initial Capital × 100%`
- **Win Rate**: `Winning Trades / Total Trades × 100%`
- **Profit Factor**: `Total Profit / Total Loss` (higher is better, >1.5 is good)
- **Sharpe Ratio**: Risk-adjusted return measure (higher is better, >1.0 is good)
- **Max Drawdown**: `(Peak Value - Lowest Value) / Peak Value × 100%`
- **P&L (Profit/Loss)**: Final Value - Initial Capital

## Best Practices

1. **Start with small position sizes** to understand strategy behavior
2. **Test on different market groups** to see which categories work best
3. **Adjust parameters gradually** rather than making extreme changes
4. **Review historical trades** to understand strategy decisions
5. **Compare multiple strategies** on the same data for relative performance
6. **Consider the data timeframe** - longer backtests are more reliable

## Data Requirements

- Need at least 2 market snapshots in a group to run backtest
- Market snapshots are taken every 5 minutes
- Historical data depends on how long the archive has been running

## Testing

Run the test suite:
```bash
cd backend
node test-backtest.js
```

This will:
1. ✅ Initialize default market groups
2. ✅ Categorize all markets
3. ✅ List available strategies
4. ✅ Run a sample backtest
5. ✅ Retrieve and display results

## Troubleshooting

### "Market group not found or has no markets"
- Solution: Run the categorization endpoint first
- Verify the group name matches exactly (case-sensitive)

### "Insufficient data for backtest"
- Solution: Need at least 2 snapshots. Run the data archiver first:
  ```bash
  curl -X POST http://localhost:3000/polymarket/archive/ingest/run
  ```

### No trades generated in backtest
- Check if price movements are smaller than your thresholds
- Reduce threshold parameters and try again

## Example Workflow

```javascript
// JavaScript example
const axios = require('axios');
const API_URL = 'http://localhost:3000';
const token = 'your_auth_token';

async function runFullBacktest() {
  // 1. Initialize groups
  await axios.post(`${API_URL}/polymarket/market-groups/initialize`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // 2. Categorize markets
  await axios.post(`${API_URL}/polymarket/market-groups/categorize`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // 3. Run backtest
  const results = await axios.post(`${API_URL}/polymarket/backtest/run`, {
    groupName: 'Elon Tweets',
    strategyName: 'momentum',
    params: {
      buyThreshold: 0.02,
      sellThreshold: 0.02,
      positionSize: 1000
    }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('Backtest ROI:', results.data.results.roi);
  console.log('Trades:', results.data.results.trades.length);
}

runFullBacktest().catch(console.error);
```

## Future Enhancements

- [ ] Multi-market portfolio backtesting
- [ ] Volatility-based strategies
- [ ] Machine learning strategy optimization
- [ ] Real-time strategy monitoring
- [ ] Export backtest results to CSV
- [ ] Parallel backtest execution
- [ ] Strategy parameter grid search
