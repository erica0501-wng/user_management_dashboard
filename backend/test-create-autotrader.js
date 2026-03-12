const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function testCreate() {
  try {
    console.log("Testing AutoTrader creation...")
    
    // Test data (using your actual user ID)
    const testData = {
      userId: 1, // Assuming user ID 1 exists
      marketId: "test-market-123",
      question: "Test question for debugging",
      outcome: "Yes",
      strategyType: "PriceTarget",
      triggerCondition: "Above",
      targetPrice: 0.75,
      action: "Buy",
      quantity: 10,
      maxExecutions: 1,
      notifyOnExecution: true,
      notificationChannels: ["email"],
      isActive: true
    }
    
    console.log("Creating with data:", testData)
    
    const result = await prisma.autoTrader.create({
      data: testData
    })
    
    console.log("✅ Created successfully:", result.id)
    
    // Clean up - delete the test record
    await prisma.autoTrader.delete({
      where: { id: result.id }
    })
    console.log("✅ Cleaned up test record")
    
  } catch (error) {
    console.error("❌ Error:", error.message)
    console.error("Error code:", error.code)
    console.error("Full error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testCreate()
