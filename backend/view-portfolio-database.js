const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function viewDatabase() {
  console.log('📊 ========== DATABASE CONTENTS ==========\n')

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true
      }
    })

    console.log('👥 USERS (' + users.length + ' total):')
    console.log('─────────────────────────────────────')
    users.forEach(user => {
      console.log(`ID: ${user.id} | ${user.username} (${user.email})`)
      console.log(`   Role: ${user.role} | Status: ${user.status}`)
    })
    console.log('\n')

    // Get all orders
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('📋 ORDERS (' + orders.length + ' total):')
    console.log('─────────────────────────────────────')
    if (orders.length === 0) {
      console.log('   (No orders yet)')
    } else {
      orders.forEach(order => {
        const orderValue = (order.price * order.quantity).toFixed(2)
        console.log(`Order #${order.id} - ${order.user.username}`)
        console.log(`   ${order.direction} ${order.quantity} ${order.symbol} @ $${order.price}`)
        console.log(`   Status: ${order.status} | Total: $${orderValue}`)
        console.log(`   Created: ${order.createdAt.toLocaleString()}`)
        console.log('')
      })
    }

    // Get all account balances
    const balances = await prisma.accountBalance.findMany({
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    })

    console.log('💰 ACCOUNT BALANCES (' + balances.length + ' total):')
    console.log('─────────────────────────────────────')
    if (balances.length === 0) {
      console.log('   (No account balances yet)')
    } else {
      balances.forEach(balance => {
        const total = balance.availableCash + balance.totalInvested
        const buyingPower = balance.availableCash * 2
        console.log(`${balance.user.username}:`)
        console.log(`   Available Cash: $${balance.availableCash.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
        console.log(`   Total Invested: $${balance.totalInvested.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
        console.log(`   Total Balance:  $${total.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
        console.log(`   Buying Power:   $${buyingPower.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
        console.log('')
      })
    }

    // Calculate holdings
    console.log('📦 HOLDINGS BY USER:')
    console.log('─────────────────────────────────────')
    const usersWithOrders = await prisma.user.findMany({
      include: {
        orders: {
          where: {
            status: 'Filled'
          }
        }
      }
    })

    let hasHoldings = false
    usersWithOrders.forEach(user => {
      const holdingsMap = {}
      user.orders.forEach(order => {
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
        }
      })

      const holdings = Object.values(holdingsMap).filter(h => h.quantity > 0)
      if (holdings.length > 0) {
        hasHoldings = true
        console.log(`${user.username}:`)
        holdings.forEach(h => {
          const avgPrice = h.totalCost / h.quantity
          console.log(`   ${h.symbol} (${h.name}): ${h.quantity} shares @ avg $${avgPrice.toFixed(2)}`)
        })
        console.log('')
      }
    })

    if (!hasHoldings) {
      console.log('   (No holdings yet)')
    }

    console.log('\n📊 ========================================\n')
    console.log('💡 To view in browser: Run "npx prisma studio" in backend folder')
    console.log('🗄️  Database file: backend/prisma/prisma/dev.db\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

viewDatabase()
