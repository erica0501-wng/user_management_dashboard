const prisma = require("./src/prisma")

async function testPolymarketPositions() {
  try {
    console.log("🧪 测试 Polymarket Positions 功能\n")
    console.log("=" .repeat(60))

    // Test 1: 检查数据库中是否有持仓数据
    console.log("\n📋 Test 1: 检查Polymarket持仓数据")
    const positions = await prisma.polymarketPosition.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    })

    console.log(`✅ 找到 ${positions.length} 个持仓`)
    
    if (positions.length > 0) {
      console.log("\n持仓详情：")
      positions.forEach(pos => {
        console.log(`\n  📊 持仓 ${pos.id}:`)
        console.log(`     用户: ${pos.user.email}`)
        console.log(`     市场: ${pos.question}`)
        console.log(`     结果: ${pos.outcome}`)
        console.log(`     股数: ${pos.shares}`)
        console.log(`     平均价格: $${pos.avgPrice}`)
        console.log(`     总成本: $${pos.totalCost}`)
        console.log(`     当前价格: $${pos.currentPrice || 'N/A'}`)
        console.log(`     状态: ${pos.status}`)
      })
    }

    // Calculate stats
    const openPositions = positions.filter(p => p.status === "Open")
    const closedPositions = positions.filter(p => p.status === "Closed")
    const totalInvested = positions.reduce((sum, p) => sum + parseFloat(p.totalCost), 0)
    
    if (positions.length > 0) {
      console.log("\n📊 统计信息：")
      console.log(`   总持仓数: ${positions.length}`)
      console.log(`   Open: ${openPositions.length}`)
      console.log(`   Closed: ${closedPositions.length}`)
      console.log(`   总投资: $${totalInvested.toFixed(2)}`)
    } else {
      console.log("⚠️  没有找到任何持仓")
      console.log("   提示: 需要先在Polymarket页面买入股票才会有持仓")
    }

    // Test 2: 测试API endpoint
    console.log("\n\n📋 Test 2: 测试Polymarket Positions API")
    console.log("   API Endpoint: GET /polymarket/positions")
    console.log("   提示: 在浏览器中测试:")
    console.log("   Local: http://localhost:3000/polymarket/positions")
    console.log("   或者运行: node test-polymarket-api.js")

    // Test 3: 测试Close功能
    if (openPositions.length > 0) {
      console.log("\n\n📋 Test 3: Close持仓功能")
      console.log("   ✅ 有 " + openPositions.length + " 个Open持仓可以测试")
      console.log("   测试步骤:")
      console.log("   1. 在Frontend Portfolio页面打开Polymarket tab")
      console.log("   2. 找到状态为'Open'的持仓")
      console.log("   3. 点击'Close'按钮")
      console.log("   4. 确认后检查:")
      console.log("      - 持仓状态变为'Closed'")
      console.log("      - Available Cash增加")
      console.log("      - Total Invested减少")
    } else {
      console.log("\n\n📋 Test 3: Close持仓功能")
      console.log("   ⚠️  没有Open持仓可以测试Close功能")
    }

    console.log("\n" + "=".repeat(60))
    console.log("✅ Polymarket功能测试完成\n")

  } catch (error) {
    console.error("❌ 测试出错:", error)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testPolymarketPositions()
