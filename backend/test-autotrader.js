const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function testAutoTrader() {
  try {
    console.log("Testing AutoTrader model...")
    
    // Check if AutoTrader model exists
    if (!prisma.autoTrader) {
      console.error("❌ AutoTrader model NOT found in Prisma client!")
      console.log("Available models:", Object.keys(prisma))
      process.exit(1)
    }
    
    console.log("✅ AutoTrader model exists")
    
    // Try to count records
    const count = await prisma.autoTrader.count()
    console.log(`✅ Found ${count} auto-trader records`)
    
    console.log("✅ All tests passed!")
  } catch (error) {
    console.error("❌ Error:", error.message)
    console.error("Full error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testAutoTrader()
