# Strategy Backtest Dashboard - User Guide

## Overview
The Strategy Backtest Dashboard allows you to test trading strategies on historical Polymarket market data. You can evaluate how different strategies would have performed on real market data before deploying them to live trading.

## Features

### 1. Market Groups
Seven data-driven market groups created from real Polymarket data:
- **NHL Stanley Cup 2026** - 30 markets
- **FIFA World Cup 2026** - 5 markets  
- **Technology & AI** - 4 markets
- **Legal & Sentencing** - 7 markets
- **Entertainment & Gaming** - 8 markets
- **Cryptocurrency** - 1 market
- **Geopolitics & Conflict** - 6 markets

### 2. Trading Strategies

#### Momentum Strategy
Trades based on price momentum - buys when price rises above threshold, sells when it drops below threshold.
- **Parameters:**
  - Buy Threshold: Price rise percentage (default: 2%)
  - Sell Threshold: Price drop percentage (default: 2%)
  - Position Size: Capital allocated per trade (default: $1,000)

#### Mean Reversion Strategy
Trades based on mean reversion principle - buys when price is at lower percentile, sells at upper percentile.
- **Parameters:**
  - Period: Lookback window (default: 20)
  - Buy Threshold: Lower percentile (0-1, default: 0.2)
  - Sell Threshold: Upper percentile (0-1, default: 0.8)
  - Position Size: Capital allocated per trade (default: $1,000)

#### Volatility Strategy
Trades based on market volatility (order book spread).
- Status: Placeholder implementation

### 3. Performance Metrics

Each backtest result displays:
- **ROI** - Return on Investment percentage
- **Total Trades** - Number of trades executed
- **Wins/Losses** - Breakdown of winning vs losing trades
- **Win Rate** - Percentage of winning trades
- **Sharpe Ratio** - Risk-adjusted return metric
- **Execution Date** - When the backtest was run

## How To Use

### Access the Dashboard
1. Log in to your QuadraStocks account
2. Click "Strategy Backtest" in the sidebar
3. You'll see three tabs: Market Groups, Results, and Run Backtest

### View Market Groups
**Tab: Market Groups**
- See all available market groups
- Each card shows the group name, description, market count, and number of backtests
- Click on a group to select it for analysis

### View Historical Results
**Tab: Results**
1. Select a market group from the dropdown
2. See all previous backtest results for that group
3. Sort by date or performance metrics
4. Compare different strategies on the same group

### Run a New Backtest
**Tab: Run Backtest**
1. **Select Market Group** - Choose which market group to test on (e.g., Entertainment & Gaming)
2. **Select Strategy** - Pick a trading strategy:
   - Momentum: Fast-moving trend trader
   - Mean Reversion: Counter-trend trader
3. **Configure Parameters** - Adjust strategy parameters based on your preferences:
   - For Momentum: Set buy/sell thresholds (lower = more sensitive)
   - For Mean Reversion: Set lookback period and buy/sell percentiles
4. **Set Position Size** - How much capital per trade (default $1,000)
5. **Click "Run Backtest"** - Execute the backtest
6. Results automatically appear in the Results tab

## Example Scenarios

### Scenario 1: Test Momentum on Technology Stocks
1. Select "Technology & AI" market group
2. Choose "Momentum Strategy"
3. Set Buy Threshold to 1% (more aggressive)
4. Set Sell Threshold to 1%
5. Position Size: $500 (conservative)
6. Run backtest
7. **Result:** -92.15% ROI, 10 trades, 10% win rate
   - **Interpretation:** Momentum strategy underperformed on tech markets

### Scenario 2: Test Mean Reversion on Entertainment
1. Select "Entertainment & Gaming" market group
2. Choose "Mean Reversion Strategy"
3. Set Period to 20 (2-hour lookback with 5-min candles)
4. Buy Threshold: 0.2 (buy when price in lower 20%)
5. Sell Threshold: 0.8 (sell when price in upper 80%)
6. Position Size: $1,000
7. Run backtest
8. **Result:** -93.05% ROI, 20 trades, 100% win rate
   - **Interpretation:** Mean reversion worked well for Entertainment markets

## Understanding the Data

### Data Collection
- Polymarket data is collected every 5 minutes
- Each snapshot captures: bid/ask prices, volumes, liquidity
- Backtests use historical snapshots from your archive

### Backtesting Process
1. Load all market snapshots for the selected group
2. Apply trading strategy rules to historical data
3. Simulate buying and selling at each opportunity
4. Calculate performance metrics
5. Store results in database for comparison

### Important Notes
- Past performance does not guarantee future results
- Backtests assume perfect execution at snapshot prices
- Real market conditions (slippage, fees) are not modeled
- All markets included in group are tested simultaneously
- Negative ROI can indicate overfitting to past data

## API Reference

### Get Market Groups
```
GET /polymarket/market-groups
Response: { groups: [...] }
```

### Get Available Strategies
```
GET /polymarket/backtest/strategies
Response: { strategies: [...] }
```

### Run Backtest
```
POST /polymarket/backtest/run
Body: { groupName, strategyName, params }
Response: { result: {...}, id }
```

### Get Backtest Results
```
GET /polymarket/backtest/results?groupName=...&limit=10
Response: { results: [...] }
```

## Troubleshooting

### Q: No backtests showing?
**A:** This is normal for a new market group. Run a backtest first by going to the "Run Backtest" tab.

### Q: Results look unrealistic?
**A:** Backtests on limited data (few snapshots) can produce unrealistic results. Ensure the market group has sufficient trading history.

### Q: Strategy not being triggered?
**A:** Market volatility may be too low for your parameters. Try adjusting thresholds to more sensitive values.

### Q: Can't run backtest?
**A:** 
- Ensure you're logged in with a valid token
- Check that the market group is selected
- Verify backend is accessible

## Next Steps

### Optimization
- Run multiple backtests with different parameters
- Compare performance across strategies
- Save your best performing parameter combinations

### Integration
- Once you find a profitable strategy, configure it for live alerts
- Set up AutoTrader to execute trades automatically
- Monitor performance vs backtest results

### Analysis
- Use archive data to identify market seasons (high/low volatility)
- Test strategies during different market conditions
- Combine multiple strategies for more robust trading

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review recent results for patterns
3. Contact support with specific backtest IDs
