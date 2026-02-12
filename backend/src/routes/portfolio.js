const express = require('express')
const router = express.Router()
const prisma = require('../prisma')
const authenticateToken = require('../middleware/auth')

// Get user's account balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    let balance = await prisma.accountBalance.findUnique({
      where: { userId }
    })

    // Create default balance if not exists
    if (!balance) {
      balance = await prisma.accountBalance.create({
        data: {
          userId,
          availableCash: 0,
          totalInvested: 0
        }
      })
    }

    res.json(balance)
  } catch (error) {
    console.error('Get balance error:', error)
    res.status(500).json({ error: 'Failed to get balance' })
  }
})

// Top up account balance
router.post('/topup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { amount, paymentMethod } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    if (!['credit_card', 'debit_card'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method. Only Credit Card or Debit Card allowed.' })
    }

    // Get current balance or create if not exists
    let balance = await prisma.accountBalance.findUnique({
      where: { userId }
    })

    if (!balance) {
      balance = await prisma.accountBalance.create({
        data: { userId, availableCash: 0, totalInvested: 0 }
      })
    }

    // Update balance
    const updatedBalance = await prisma.accountBalance.update({
      where: { userId },
      data: {
        availableCash: { increment: parseFloat(amount) }
      }
    })

    res.json(updatedBalance)
  } catch (error) {
    console.error('Top up error:', error)
    res.status(500).json({ error: 'Failed to top up balance' })
  }
})

// Get all orders for user
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { status, direction } = req.query

    const where = { userId }
    if (status && status !== 'All') where.status = status
    if (direction && direction !== 'All') where.direction = direction

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    res.json(orders)
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({ error: 'Failed to get orders' })
  }
})

// Create new order
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { symbol, name, direction, price, quantity, orderType, session } = req.body

    // Validate required fields
    if (!symbol || !direction || !price || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate price and quantity
    if (price <= 0 || quantity <= 0) {
      return res.status(400).json({ error: 'Price and quantity must be positive' })
    }

    // Get current balance
    let balance = await prisma.accountBalance.findUnique({
      where: { userId }
    })

    if (!balance) {
      balance = await prisma.accountBalance.create({
        data: { userId, availableCash: 0, totalInvested: 0 }
      })
    }

    // Check if selling - validate holdings
    if (direction === 'Sell') {
      const filledOrders = await prisma.order.findMany({
        where: { userId, symbol, status: 'Filled' }
      })

      const holdings = filledOrders.reduce((total, order) => {
        return order.direction === 'Buy' 
          ? total + order.quantity 
          : total - order.quantity
      }, 0)

      if (holdings <= 0) {
        return res.status(400).json({ 
          error: `You don't own any shares of ${symbol}. You must buy before selling.` 
        })
      }

      if (quantity > holdings) {
        return res.status(400).json({ 
          error: `Insufficient shares. You only have ${holdings} shares of ${symbol}.` 
        })
      }
    }

    // Check if buying - validate funds
    if (direction === 'Buy') {
      const orderValue = price * quantity
      if (orderValue > balance.availableCash) {
        return res.status(400).json({ 
          error: `Insufficient funds. You need $${orderValue.toFixed(2)} but only have $${balance.availableCash.toFixed(2)}.` 
        })
      }
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        symbol,
        name: name || symbol,
        direction,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        orderType: orderType || 'Limit',
        session,
        status: 'Pending'
      }
    })

    res.status(201).json(order)
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// Update order status (fill or cancel)
router.patch('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const orderId = parseInt(req.params.id)
    const { status } = req.body

    if (!['Filled', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Get the order
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.status !== 'Pending') {
      return res.status(400).json({ error: 'Can only update pending orders' })
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    })

    // If filled, update account balance
    if (status === 'Filled') {
      const orderValue = order.price * order.quantity
      
      await prisma.accountBalance.update({
        where: { userId },
        data: {
          availableCash: {
            [order.direction === 'Buy' ? 'decrement' : 'increment']: orderValue
          },
          totalInvested: {
            [order.direction === 'Buy' ? 'increment' : 'decrement']: orderValue
          }
        }
      })
    }

    res.json(updatedOrder)
  } catch (error) {
    console.error('Update order error:', error)
    res.status(500).json({ error: 'Failed to update order' })
  }
})

// Get holdings (current positions)
router.get('/holdings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    const orders = await prisma.order.findMany({
      where: { userId, status: 'Filled' }
    })

    // Calculate holdings by symbol
    const holdingsMap = {}
    orders.forEach(order => {
      if (!holdingsMap[order.symbol]) {
        holdingsMap[order.symbol] = {
          symbol: order.symbol,
          name: order.name,
          quantity: 0,
          totalCost: 0
        }
      }

      if (order.direction === 'Buy') {
        holdingsMap[order.symbol].quantity += order.quantity
        holdingsMap[order.symbol].totalCost += order.price * order.quantity
      } else {
        holdingsMap[order.symbol].quantity -= order.quantity
        holdingsMap[order.symbol].totalCost -= order.price * order.quantity
      }
    })

    // Filter out holdings with 0 quantity and calculate average price
    const holdings = Object.values(holdingsMap)
      .filter(h => h.quantity > 0)
      .map(h => ({
        ...h,
        avgPrice: h.totalCost / h.quantity
      }))

    res.json(holdings)
  } catch (error) {
    console.error('Get holdings error:', error)
    res.status(500).json({ error: 'Failed to get holdings' })
  }
})

// Strategy backtest - Moving Average Crossover
router.post('/strategy-backtest', authenticateToken, async (req, res) => {
  try {
    const { symbol, years } = req.body

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    if (![3, 5, 7].includes(years)) {
      return res.status(400).json({ error: 'Years must be 3, 5, or 7' })
    }

    // Fetch historical data
    const apiKey = process.env.TWELVE_API_KEY || 'demo'
    const outputsize = Math.ceil(years * 252) + 100 // Trading days + buffer for MA calculation
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    // Use mock data if API fails
    let prices = []
    let dates = []

    if (data.values && data.values.length > 0) {
      const values = data.values.reverse()
      prices = values.map(v => parseFloat(v.close))
      dates = values.map(v => v.datetime)
    } else {
      // Generate mock data
      const dataPoints = years * 252
      const startPrice = 100 + Math.random() * 100
      for (let i = 0; i < dataPoints; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (dataPoints - i))
        dates.push(date.toISOString().split('T')[0])
        
        if (i === 0) {
          prices.push(startPrice)
        } else {
          const change = (Math.random() - 0.48) * 5
          prices.push(Math.max(10, prices[i - 1] + change))
        }
      }
    }

    // Calculate moving averages
    const ma30 = []
    const ma90 = []
    
    for (let i = 0; i < prices.length; i++) {
      // 30-day MA
      if (i >= 29) {
        const sum = prices.slice(i - 29, i + 1).reduce((a, b) => a + b, 0)
        ma30.push(sum / 30)
      } else {
        ma30.push(null)
      }
      
      // 90-day MA
      if (i >= 89) {
        const sum = prices.slice(i - 89, i + 1).reduce((a, b) => a + b, 0)
        ma90.push(sum / 90)
      } else {
        ma90.push(null)
      }
    }

    // Execute strategy
    let position = 0 // 0 = no position, 1 = holding
    let cash = 10000 // Starting capital
    let shares = 0
    let trades = []
    let portfolioValue = []

    for (let i = 90; i < prices.length; i++) {
      const price = prices[i]
      const ma30Value = ma30[i]
      const ma90Value = ma90[i]

      // Buy signal: price below 30-day MA and we don't have a position
      if (price < ma30Value && position === 0 && cash > 0) {
        shares = Math.floor(cash / price)
        if (shares > 0) {
          cash -= shares * price
          position = 1
          trades.push({
            date: dates[i],
            action: 'BUY',
            price: price.toFixed(2),
            shares,
            value: (shares * price).toFixed(2)
          })
        }
      }

      // Sell signal: price above 90-day MA and we have a position
      if (price > ma90Value && position === 1 && shares > 0) {
        cash += shares * price
        trades.push({
          date: dates[i],
          action: 'SELL',
          price: price.toFixed(2),
          shares,
          value: (shares * price).toFixed(2)
        })
        shares = 0
        position = 0
      }

      // Calculate portfolio value
      const currentValue = cash + (shares * price)
      portfolioValue.push({
        date: dates[i],
        value: currentValue.toFixed(2)
      })
    }

    // Final liquidation
    if (shares > 0) {
      const finalPrice = prices[prices.length - 1]
      cash += shares * finalPrice
      trades.push({
        date: dates[dates.length - 1],
        action: 'SELL (Final)',
        price: finalPrice.toFixed(2),
        shares,
        value: (shares * finalPrice).toFixed(2)
      })
      shares = 0
    }

    const finalValue = cash
    const totalReturn = ((finalValue - 10000) / 10000) * 100
    const annualizedReturn = (Math.pow(finalValue / 10000, 1 / years) - 1) * 100

    // Buy and hold comparison
    const buyHoldShares = Math.floor(10000 / prices[90])
    const buyHoldFinal = buyHoldShares * prices[prices.length - 1]
    const buyHoldReturn = ((buyHoldFinal - 10000) / 10000) * 100

    res.json({
      symbol,
      years,
      initialCapital: 10000,
      finalValue: finalValue.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      annualizedReturn: annualizedReturn.toFixed(2),
      totalTrades: trades.length,
      trades,
      portfolioValue,
      buyHoldComparison: {
        finalValue: buyHoldFinal.toFixed(2),
        return: buyHoldReturn.toFixed(2)
      },
      chartData: {
        dates: dates.slice(90),
        prices: prices.slice(90),
        ma30: ma30.slice(90),
        ma90: ma90.slice(90)
      }
    })
  } catch (error) {
    console.error('Strategy backtest error:', error)
    res.status(500).json({ error: 'Failed to run strategy backtest' })
  }
})

module.exports = router
