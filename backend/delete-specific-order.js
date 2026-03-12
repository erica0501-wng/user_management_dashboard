const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteSpecificOrder() {
  try {
    console.log('🔍 Searching for order...')
    console.log('Criteria:')
    console.log('  - Symbol: 531202')
    console.log('  - Name: BitBoy convicted? - Yes')
    console.log('  - Direction: Buy')
    console.log('  - Price: $0.22')
    console.log('  - Quantity: 1')
    console.log('  - Status: Filled')
    console.log('')

    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        symbol: '531202',
        name: {
          contains: 'BitBoy convicted'
        },
        direction: 'Buy',
        price: 0.22,
        quantity: 1,
        status: 'Filled',
        orderType: 'Market'
      },
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      }
    })

    if (!order) {
      console.log('❌ Order not found with the specified criteria')
      return
    }

    console.log('✅ Found order:')
    console.log(`   ID: ${order.id}`)
    console.log(`   User: ${order.user.username} (${order.user.email})`)
    console.log(`   Symbol: ${order.symbol}`)
    console.log(`   Name: ${order.name}`)
    console.log(`   Direction: ${order.direction}`)
    console.log(`   Price: $${order.price}`)
    console.log(`   Quantity: ${order.quantity}`)
    console.log(`   Status: ${order.status}`)
    console.log(`   Created: ${order.createdAt}`)
    console.log('')

    // Delete the order
    await prisma.order.delete({
      where: {
        id: order.id
      }
    })

    console.log('🗑️  Order deleted successfully!')
    console.log(`   Deleted order ID: ${order.id}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

deleteSpecificOrder()
