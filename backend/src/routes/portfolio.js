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
          availableCash: 100000,
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
        data: { userId, availableCash: 100000, totalInvested: 0 }
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

module.exports = router
