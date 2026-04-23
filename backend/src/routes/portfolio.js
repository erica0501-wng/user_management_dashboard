const express = require('express')
const router = express.Router()
const prisma = require('../prisma')
const authenticateToken = require('../middleware/auth')
const notificationService = require('../services/notificationService')

const dashboardBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

function getAuthenticatedUserId(req) {
  const userId = Number(req.user?.id)
  if (!Number.isInteger(userId) || userId <= 0) {
    return null
  }
  return userId
}

async function userExists(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  })
  return Boolean(user)
}

async function sendPortfolioActivityNotification(userId, activity, channels = null) {
  try {
    const [user, notificationSettings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.notificationSettings.findUnique({ where: { userId } })
    ])

    if (!user || !notificationSettings) return
    await notificationService.sendActivityNotification(user, activity, notificationSettings, channels)
  } catch (error) {
    console.error('Portfolio notification error:', error.message)
  }
}

// Get user's account balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }

    if (!(await userExists(userId))) {
      return res.json({
        userId,
        availableCash: 0,
        totalInvested: 0,
        isVirtual: true
      })
    }

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
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.status(403).json({ error: 'Account not found. Please log in with a registered account.' })
    }
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

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'TopUp',
        amount: parseFloat(amount),
        paymentMethod
      }
    })

    res.json(updatedBalance)
  } catch (error) {
    console.error('Top up error:', error)
    res.status(500).json({ error: 'Failed to top up balance' })
  }
})

// Withdraw from account balance
router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.status(403).json({ error: 'Account not found. Please log in with a registered account.' })
    }
    const { amount, paymentMethod } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    if (!['credit_card', 'debit_card'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method. Only Credit Card or Debit Card allowed.' })
    }

    // Get current balance
    let balance = await prisma.accountBalance.findUnique({
      where: { userId }
    })

    if (!balance) {
      return res.status(400).json({ error: 'No balance found' })
    }

    // Check if sufficient funds
    if (balance.availableCash < parseFloat(amount)) {
      return res.status(400).json({ 
        error: `Insufficient funds. Available: $${balance.availableCash.toFixed(2)}` 
      })
    }

    // Update balance
    const updatedBalance = await prisma.accountBalance.update({
      where: { userId },
      data: {
        availableCash: { decrement: parseFloat(amount) }
      }
    })

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'Withdraw',
        amount: parseFloat(amount),
        paymentMethod
      }
    })

    res.json(updatedBalance)
  } catch (error) {
    console.error('Withdraw error:', error)
    res.status(500).json({ error: 'Failed to withdraw balance' })
  }
})

// Get transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  console.log('📋 Fetching transactions for user:', req.user.id)
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }

    if (!(await userExists(userId))) {
      return res.json([])
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    console.log('✅ Found transactions:', transactions.length)
    res.json(transactions)
  } catch (error) {
    console.error('Get transactions error:', error)
    res.status(500).json({ error: 'Failed to get transactions' })
  }
})

// Get all orders for user
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.json([])
    }
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
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.status(403).json({ error: 'Account not found. Please log in with a registered account.' })
    }
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

    const orderValue = parseFloat(price) * parseFloat(quantity)
    await sendPortfolioActivityNotification(userId, {
      subject: `📌 Order Placed: ${direction} ${symbol}`,
      title: 'Stock Order Placed',
      description: `Your ${direction} order has been submitted successfully.`,
      details: {
        Symbol: symbol,
        Side: direction,
        Quantity: parseInt(quantity),
        Price: `$${parseFloat(price).toFixed(2)}`,
        Type: orderType || 'Limit',
        Status: 'Pending',
        Total: `$${orderValue.toFixed(2)}`
      },
      actionLabel: 'View Portfolio',
      actionUrl: `${dashboardBaseUrl}/portfolio`,
      color: 0x2563EB
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
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.status(403).json({ error: 'Account not found. Please log in with a registered account.' })
    }
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

    await sendPortfolioActivityNotification(userId, {
      subject: `✅ Order ${status}: ${order.direction} ${order.symbol}`,
      title: `Stock Order ${status}`,
      description: `Your ${order.direction} order has been marked as ${status}.`,
      details: {
        Symbol: order.symbol,
        Side: order.direction,
        Quantity: order.quantity,
        Price: `$${order.price.toFixed(2)}`,
        Status: status,
        Total: `$${(order.price * order.quantity).toFixed(2)}`
      },
      actionLabel: 'View Orders',
      actionUrl: `${dashboardBaseUrl}/portfolio`,
      color: status === 'Filled' ? 0x10B981 : 0xF59E0B
    })

    res.json(updatedOrder)
  } catch (error) {
    console.error('Update order error:', error)
    res.status(500).json({ error: 'Failed to update order' })
  }
})

// Get holdings (current positions)
router.get('/holdings', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
    if (!(await userExists(userId))) {
      return res.json([])
    }

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

module.exports = router
