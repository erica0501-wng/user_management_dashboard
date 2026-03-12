const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteOrder() {
  const orderId = parseInt(process.argv[2])
  
  if (!orderId) {
    console.log('Usage: node delete-order.js <order_id>')
    process.exit(1)
  }

  try {
    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      console.log(`Order ${orderId} not found`)
      process.exit(1)
    }

    console.log(`Deleting order: ${order.name}`)
    
    // Delete the order
    await prisma.order.delete({
      where: { id: orderId }
    })

    console.log('✅ Order deleted successfully!')

  } catch (error) {
    console.error('Error deleting order:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

deleteOrder()
