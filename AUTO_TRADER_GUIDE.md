# 🤖 Auto-Trader Feature

## Overview

The Auto-Trader is an advanced feature that automatically executes trades based on predefined conditions such as price targets or moving averages. When your specified conditions are met, the system will automatically buy or sell shares and send you notifications via email or Discord.

## Features

- **Multiple Strategy Types**:
  - **Price Target**: Execute trade when price reaches a specific value
  - **Moving Average**: Execute trade when price crosses a moving average line
  - **Price Change**: (Coming soon) Execute based on percentage price changes

- **Automated Execution**: Trades execute automatically every 60 seconds when conditions are met
- **Smart Notifications**: Get email and/or Discord alerts when trades execute
- **Execution Control**: Set maximum executions (1x, 5x, 10x, or unlimited)
- **Pause/Resume**: Control rules without deleting them
- **Real-time Monitoring**: Track execution counts and rule status

## How It Works

### 1. Monitoring Service
The auto-trader monitoring service runs in the background, checking all active rules every 60 seconds:
- Fetches current market prices from Polymarket API
- Calculates moving averages from historical price data
- Evaluates each rule's trigger conditionsauto-trader page in the sidebar
- Click "+ Create Rule" button

### 2. Configure Your Rule

#### Basic Information
- **Market ID**: Enter the Polymarket market ID (e.g., `531202`)
- **Market Question**: Enter the market question for reference
- **Outcome**: Select which outcome to trade (Yes/No)

#### Strategy Selection

**Price Target Strategy**:
- Select "Price Target" as strategy type
- Choose trigger condition:
  - **Above**: Execute when price goes above target
  - **Below**: Execute when price goes below target
- Enter target price (0-1, e.g., 0.75 = 75%)

**Moving Average Strategy**:
- Select "Moving Average" as strategy type
- Choose trigger condition:
  - **Cross Above**: Execute price crosses above MA
  - **Cross Below**: Execute when price crosses below MA
- Enter MA period (1-30 days, e.g., 7 for 7-day moving average)

#### Trade Configuration
- **Action**: Buy or Sell
- **Quantity**: Number of shares to trade
- **Max Executions**: How many times this rule can execute (0 = unlimited)
- **Notifications**: Enable email and/or Discord notifications

### 3. Monitor Your Rules

The auto-trader dashboard shows:
- **Status**: Active, Paused, or Completed
- **Execution Count**: Times this rule has executed
- **Last Checked**: When the rule was last evaluated
- **Last Executed**: When the last trade occurred

### 4. Manage Rules

- **Pause/Resume**: Stop rule temporarily without deleting
- **Reset**: Reset execution count and reactivate
- **Delete**: Remove rule permanently

## Examples

### Example 1: Buy on Dip
```
Strategy: Price Target
Condition: Below
Target Price: 0.60
Action: Buy
Quantity: 10 shares
Max Executions: 1

Result: When price drops to 60% or below, buy 10 shares once
```

### Example 2: Sell on Moving Average Cross
```
Strategy: Moving Average
Condition: Cross Below
MA Period: 7 days
Action: Sell
Quantity: 5 shares
Max Executions: 0 (unlimited)

Result: When price crosses below 7-day MA, sell 5 shares (repeatable)
```

### Example 3: Take Profit
```
Strategy: Price Target
Condition: Above
Target Price: 0.85
Action: Sell
Quantity: 20 shares
Max Executions: 1

Result: When price reaches 85% or above, sell 20 shares once
```

## Notifications

When a trade executes, you'll receive notifications via your configured channels:

### Email Notification includes:
- Trade action (Buy/Sell)
- Market name and outcome
- Quantity and price
- Total trade value
- Strategy that triggered the trade
- Success/failure status

### Discord Notification includes:
- Same information as email in embed format
- Color-coded (green for success, red for failure)

## Important Notes

### Execution Frequency
- **Checking Interval**: Every 60 seconds
- **Rule Evaluation**: All active rules checked each cycle
- **Market Data**: Fetched fresh from Polymarket API

### Execution Limits
- Rules automatically pause when max executions reached
- Use Reset function to restart a completed rule
- Set max executions to 0 for unlimited repeats

### Requirements
- **Sufficient Funds**: Buy orders require available cash
- **Open Positions**: Sell orders require shares to sell
- **Active Status**: Rules must be active to execute
- **Valid Market**: Market must exist on Polymarket

### Safety Features
- **Fund Check**: Verifies sufficient balance before buy
- **Position Check**: Verifies shares available before sell
- **Error Handling**: Graceful failure with notifications
- **Transaction Records**: All trades logged to Orders

## API Endpoints

### List Auto-Traders
```
GET /autotrader
Authorization: Bearer <token>
```

### Create Auto-Trader
```
POST /autotrader
Content-Type: application/json
Authorization: Bearer <token>

{
  "marketId": "531202",
  "question": "Will Bitcoin reach $100k?",
  "outcome": "Yes",
  "strategyType": "PriceTarget",
  "triggerCondition": "Above",
  "targetPrice": 0.75,
  "action": "Buy",
  "quantity": 10,
  "maxExecutions": 1,
  "notificationChannels": ["email", "discord"]
}
```

### Toggle Active Status
```
PATCH /autotrader/:id/toggle
Authorization: Bearer <token>
```

### Reset Execution Count
```
POST /autotrader/:id/reset
Authorization: Bearer <token>
```

### Delete Auto-Trader
```
DELETE /autotrader/:id
Authorization: Bearer <token>
```

### Get Statistics
```
GET /autotrader/stats/summary
Authorization: Bearer <token>
```

## Troubleshooting

### Rule Not Executing?

1. **Check Status**: Ensure rule is Active
2. **Check Executions**: Verify max executions not reached
3. **Check Funds**: Confirm sufficient balance for buys
4. **Check Shares**: Confirm available shares for sells
5. **Check Condition**: Verify price actually met condition
6. **Check Market**: Ensure market ID is valid

### No Notifications Received?

1. **Check Settings**: Go to Settings → Notification Settings
2. **Enable Channels**: Enable email and/or Discord
3. **Configure Discord**: Add Discord webhook URL if using Discord
4. **Check Spam**: Email might be in spam folder
5. **Test Notifications**: Use test feature in Settings

### Trade Failed?

Check your email/Discord notification for the exact error message:
- **"Insufficient funds"**: Add more cash to account
- **"No open position found"**: Can't sell what you don't own
- **"Could not fetch data"**: Market might be invalid or API issue

## Best Practices

1. **Start Small**: Test with small quantities first
2. **Set Limits**: Use max executions to control risk
3. **Monitor Regularly**: Check rule status and executions
4. **Use Notifications**: Enable both email and Discord for redundancy
5. **Realistic Triggers**: Set achievable price targets based on market history
6. **Diversify**: Create multiple rules for different scenarios
7. **Pause When Needed**: Temporarily disable rules during volatile markets

## Technical Details

### Database Schema
```prisma
model AutoTrader {
  id                Int
  userId            Int
  marketId          String
  question          String
  outcome           String?
  strategyType      StrategyType
  triggerCondition  TriggerCondition
  targetPrice       Float?
  movingAvgPeriod   Int?
  action            TradeAction
  quantity          Float
  maxExecutions     Int
  executionCount    Int
  isActive          Boolean
  notifyOnExecution Boolean
  notificationChannels String[]
  lastCheckedAt     DateTime?
  lastExecutedAt    DateTime?
}
```

### Service Architecture
- **AutoTraderMonitoringService**: Background service for rule evaluation
- **NotificationService**: Handles email and Discord notifications
- **AutoTrader Routes**: REST API for rule management
- **Prisma Client**: Database operations

## Future Enhancements

Planned features for future releases:
- **Price Change Strategy**: Trigger on % change
- **Volume Alerts**: Trade based on volume thresholds
- **Multiple Conditions**: AND/OR logic for complex rules
- **Scheduled Trading**: Execute at specific times
- **Stop Loss**: Automatic position protection
- **Take Profit Ladder**: Scale out of positions
- **Backtesting**: Test strategies on historical data
- **Rule Templates**: Pre-configured common strategies
- **Mobile Notifications**: Push notifications via mobile app

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages in notifications
3. Check backend logs for detailed errors
4. Contact support with rule ID and error details

---

**Created**: March 10, 2026  
**Version**: 1.0.0  
**Status**: ✅ Active and Tested
