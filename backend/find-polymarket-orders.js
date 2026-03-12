const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function findOrders() {
  try {
    console.log('🔍 Searching for all orders with symbol 531202...\n')

    const orders = await prisma.order.findMany({
      where: {
        symbol: '531202'
      },
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (orders.length === 0) {
      console.log('❌ No orders found with symbol 531202')
      
      // Let's also search with name containing BitBoy
      console.log('\n🔍 Searching for orders with name containing "BitBoy"...\n')
      const ordersByName = await prisma.order.findMany({
        where: {
          name: {
            contains: 'BitBoy'
          }
        },
        include: {
          user: {
            select: {
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (ordersByName.length > 0) {
        console.log(`✅ Found ${ordersByName.length} order(s) with "BitBoy" in name:\n`)
        ordersByName.forEach((order, idx) => {
          console.log(`Order ${idx + 1}:`)
          console.log(`  ID: ${order.id}`)
          console.log(`  User: ${order.user.username} (${order.user.email})`)
          console.log(`  Symbol: ${order.symbol}`)
          console.log(`  Name: ${order.name}`)
          console.log(`  Direction: ${order.direction}`)
          console.log(`  Price: $${order.price}`)
          console.log(`  Quantity: ${order.quantity}`)
          console.log(`  Status: ${order.status}`)
          console.log(`  OrderType: ${order.orderType}`)
          console.log(`  Created: ${order.createdAt}`)
          console.log('')
        })
      } else {
        console.log('❌ No orders found with "BitBoy" in name either')
      }
      return
    }

    console.log(`✅ Found ${orders.length} order(s) with symbol 531202:\n`)
    
    orders.forEach((order, idx) => {
      console.log(`Order ${idx + 1}:`)
      console.log(`  ID: ${order.id}`)
      console.log(`  User: ${order.user.username} (${order.user.email})`)
      console.log(`  Symbol: ${order.symbol}`)
      console.log(`  Name: ${order.name}`)
      console.log(`  Direction: ${order.direction}`)
      console.log(`  Price: $${order.price}`)
      console.log(`  Quantity: ${order.quantity}`)
      console.log(`  Status: ${order.status}`)
      console.log(`  OrderType: ${order.orderType}`)
      console.log(`  Created: ${order.createdAt}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

findOrders()
