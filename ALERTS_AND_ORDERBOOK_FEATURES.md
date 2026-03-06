# Alerts and Order Book Features

## Overview
New features added to the Polymarket trading dashboard to help users:
1. **Set Price Alerts** - Get notified when market prices reach specific targets
2. **Set Order Book Alerts** - Get notified when large order volumes appear
3. **View Order Books** - See real-time bid/ask orders for market outcomes

## Features Implemented

### 1. Price Alerts
Users can create alerts that trigger when:
- Price goes **above** a target value
- Price goes **below** a target value

**Example Use Cases:**
- Alert me when "Bitcoin $100k" reaches 70% probability (0.70 price)
- Alert me when "Lakers Championship" drops below 30% probability (0.30 price)

### 2. Order Book Alerts
Users can create alerts for large order book volumes:
- Set a minimum volume threshold (e.g., 50,000)
- Get notified when total order book volume exceeds this threshold
- Useful for identifying significant market activity and liquidity

**Example Use Cases:**
- Alert me when order book volume exceeds $50,000 (indicates large liquidity)
- Alert me when institutional-sized orders appear

### 3. Order Book Display
Visual representation of the market's bid/ask orders:
- **Bids (Buy Orders)** - Green, showing buy side interest
- **Asks (Sell Orders)** - Red, showing sell side interest
- **Metrics**:
  - Spread: Difference between best bid and best ask
  - Best Bid/Ask: Current best prices
  - Total Volume: Combined liquidity
- Auto-refreshes every 10 seconds

## How to Use

### Creating Alerts

1. **Navigate to Polymarket page**
2. **Click the Bell 🔔 + Book 📖 icon** on any market card
3. **In the Market Details Modal:**
   - Left side: Alert Manager
   - Right side: Order Book

4. **To create a Price Alert:**
   - Click "Create Alert"
   - Select "Price Alert"
   - Choose an outcome (Yes/No)
   - Select condition (Above/Below)
   - Enter target price (0.00 - 1.00)
   - Click "Create Alert"

5. **To create an Order Book Alert:**
   - Click "Create Alert"
   - Select "Order Book"
   - Choose an outcome
   - Enter minimum volume threshold
   - Click "Create Alert"

### Managing Alerts

- **Toggle On/Off** - Use the toggle button to activate/deactivate alerts
- **Delete** - Click the trash icon to remove an alert
- **View Triggered** - Alerts that have been triggered show in green with a checkmark
- **Notifications** - Click the bell icon 🔔 in the sidebar to see triggered alerts

### Viewing Order Books

1. Click the **Bell 🔔 + Book 📖 icon** on any market card
2. The Order Book section shows:
   - Current market metrics (spread, best bid/ask, volume)
   - Bid orders (buy side) on the left
   - Ask orders (sell side) on the right
   - Auto-refresh toggle
   - Manual refresh button

## Technical Implementation

### Backend

**Database Schema:**
- New `Alert` model with fields:
  - `alertType`: Price or OrderBook
  - `targetPrice`: Target price for price alerts
  - `condition`: Above or Below
  - `orderBookThreshold`: Minimum volume for order book alerts
  - `isActive`: Whether alert is currently active
  - `isTriggered`: Whether alert has been triggered

**API Endpoints:**
- `GET /alerts` - Get all user alerts
- `POST /alerts` - Create new alert
- `PATCH /alerts/:id` - Update alert (toggle active/inactive)
- `DELETE /alerts/:id` - Delete alert
- `GET /alerts/triggered` - Get triggered alerts
- `GET /polymarket/orderbook/:tokenId` - Get order book data
- `GET /polymarket/market/:marketId/orderbooks` - Get all order books for a market

**Alert Monitoring Service:**
- Automatic background service that runs on server start
- Checks all active alerts every 60 seconds
- Compares current market data against alert conditions
- Triggers alerts when conditions are met
- Can be extended to send email/push notifications

### Frontend

**New Components:**
- `AlertManager.jsx` - Create and manage alerts
- `OrderBook.jsx` - Display order book data
- `MarketDetailsModal.jsx` - Combined view of alerts and order book
- `AlertNotifications.jsx` - Bell icon notification center in sidebar

**Integration:**
- Added to `PolymarketCard` component with dedicated button
- Alert notifications appear in sidebar header
- Real-time updates and auto-refresh capabilities

## Future Enhancements

Potential improvements:
1. **Email Notifications** - Send email when alerts trigger
2. **Push Notifications** - Browser push notifications
3. **SMS Alerts** - Text message notifications for critical alerts
4. **Advanced Order Book Analytics**:
   - Order book depth charts
   - Volume profile visualization
   - Market imbalance indicators
5. **Price History Charts** - Show price movements over time
6. **Multi-Alert Rules** - Combine multiple conditions (AND/OR logic)
7. **Alert Templates** - Save and reuse common alert configurations
8. **Snooze Alerts** - Temporarily disable triggered alerts

## API Endpoints Reference

### Alerts API

```
GET    /alerts              - Get all user alerts
POST   /alerts              - Create new alert
PATCH  /alerts/:id          - Update alert
DELETE /alerts/:id          - Delete alert
GET    /alerts/triggered    - Get triggered alerts
```

### Order Book API

```
GET /polymarket/orderbook/:tokenId              - Get order book for token
GET /polymarket/market/:marketId/orderbooks     - Get all order books for market
```

## Alert Monitoring

The alert monitoring service:
- Runs automatically when the backend server starts
- Checks alerts every 60 seconds
- Logs activity to console
- Can be adjusted in `/backend/src/services/alertMonitoring.js`

**Configuration:**
```javascript
checkInterval = 60000  // 60 seconds (adjust as needed)
```

## Notes

- Order book data currently uses mock data for demonstration
- In production, integrate with Polymarket's CLOB API
- Alert notifications are stored in database and shown in UI
- Consider rate limiting for production use
- Monitor server performance with frequent alert checks

## Support

For questions or issues:
- Check console logs for debugging
- Verify database migrations are applied
- Ensure backend server is running
- Check that alert monitoring service started successfully
