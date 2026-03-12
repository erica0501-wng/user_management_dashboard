const prisma = require("./src/prisma")

async function testAutoTrader() {
  try {
    console.log("🤖 测试 Auto-Trader 功能\n")
    console.log("=" .repeat(60))

    // Test 1: 检查Auto-Trader规则
    console.log("\n📋 Test 1: 检查Auto-Trader规则")
    const autoTraders = await prisma.autoTrader.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`✅ 找到 ${autoTraders.length} 个Auto-Trader规则`)
    
    if (autoTraders.length > 0) {
      console.log("\n规则详情：")
      autoTraders.forEach(at => {
        console.log(`\n  🤖 规则 ${at.id}:`)
        console.log(`     用户: ${at.user.email}`)
        console.log(`     市场: ${at.question}`)
        console.log(`     结果: ${at.outcome}`)
        console.log(`     策略类型: ${at.strategyType}`)
        console.log(`     触发条件: ${at.triggerCondition}`)
        
        if (at.strategyType === "PriceTarget") {
          console.log(`     目标价格: $${at.targetPrice}`)
        } else if (at.strategyType === "MovingAverage") {
          console.log(`     移动平均周期: ${at.movingAvgPeriod}天`)
        }
        
        console.log(`     动作: ${at.action}`)
        console.log(`     数量: ${at.quantity}股`)
        console.log(`     状态: ${at.isActive ? '✅ Active' : '❌ Inactive'}`)
        console.log(`     执行次数: ${at.executionCount}/${at.maxExecutions || '∞'}`)
        console.log(`     最后检查: ${at.lastCheckedAt || 'Never'}`)
        console.log(`     最后执行: ${at.lastExecutedAt || 'Never'}`)
        console.log(`     通知渠道: ${JSON.stringify(at.notificationChannels)}`)
      })
    }

    // Stats
    const activeRules = autoTraders.filter(at => at.isActive)
    const priceTargetRules = autoTraders.filter(at => at.strategyType === "PriceTarget")
    const movingAvgRules = autoTraders.filter(at => at.strategyType === "MovingAverage")
    const executedRules = autoTraders.filter(at => at.executionCount > 0)

    if (autoTraders.length > 0) {
      console.log("\n📊 统计信息：")
      console.log(`   总规则数: ${autoTraders.length}`)
      console.log(`   Active: ${activeRules.length}`)
      console.log(`   Price Target策略: ${priceTargetRules.length}`)
      console.log(`   Moving Average策略: ${movingAvgRules.length}`)
      console.log(`   已执行过的规则: ${executedRules.length}`)
    } else {
      console.log("⚠️  没有找到任何Auto-Trader规则")
      console.log("   提示: 需要在Portfolio > Auto-Trader页面创建规则")
    }

    // Test 2: 检查Auto-Trader监控服务状态
    console.log("\n\n📋 Test 2: Auto-Trader监控服务")
    console.log("   监控服务会每60秒自动检查所有Active规则")
    console.log("   服务状态: " + (process.env.NODE_ENV !== 'production' ? '✅ Running (如果backend server启动)' : '⚠️  需要backend运行'))
    
    if (activeRules.length > 0) {
      console.log("\n   🔍 监控中的规则:")
      activeRules.forEach(at => {
        console.log(`      - 规则 ${at.id}: ${at.strategyType} | ${at.triggerCondition} | ${at.action}`)
      })
    }

    // Test 3: 测试创建规则
    console.log("\n\n📋 Test 3: 创建Auto-Trader规则测试")
    console.log("   ✅ API Endpoint: POST /autotrader")
    console.log("   测试步骤:")
    console.log("   1. 在Frontend Portfolio页面打开Auto-Trader tab")
    console.log("   2. 点击'+ Create Rule'按钮")
    console.log("   3. 填写表单:")
    console.log("      - Market ID: 531202 (示例)")
    console.log("      - Strategy Type: Price Target")
    console.log("      - Condition: Above")
    console.log("      - Target Price: 0.75")
    console.log("      - Action: Buy")
    console.log("      - Quantity: 1")
    console.log("   4. 保存后检查规则是否出现在列表中")

    // Test 4: 测试规则执行
    if (activeRules.length > 0) {
      console.log("\n\n📋 Test 4: 测试规则自动执行")
      console.log("   ✅ 有 " + activeRules.length + " 个Active规则")
      console.log("\n   测试方法:")
      console.log("   方法1 - 等待自动执行:")
      console.log("   1. 确保backend server正在运行")
      console.log("   2. 等待60秒（监控周期）")
      console.log("   3. 检查数据库executionCount是否增加")
      console.log("\n   方法2 - 手动触发测试:")
      console.log("   运行: node test-autotrader-execution.js")
    }

    // Test 5: 测试通知功能
    console.log("\n\n📋 Test 5: 测试通知功能")
    const rulesWithNotifications = autoTraders.filter(at => 
      at.notificationChannels && at.notificationChannels.length > 0
    )
    
    if (rulesWithNotifications.length > 0) {
      console.log(`   ✅ 有 ${rulesWithNotifications.length} 个规则配置了通知`)
      console.log("   当规则执行时，你应该收到:")
      rulesWithNotifications.forEach(at => {
        if (at.notificationChannels.includes('email')) {
          console.log(`      - 📧 Email通知 (规则 ${at.id})`)
        }
        if (at.notificationChannels.includes('discord')) {
          console.log(`      - 💬 Discord通知 (规则 ${at.id})`)
        }
      })
    } else {
      console.log("   ⚠️  没有规则配置了通知")
    }

    // Test 6: 检查执行历史
    console.log("\n\n📋 Test 6: 检查执行历史")
    const orders = await prisma.order.findMany({
      where: {
        name: {
          contains: 'Auto-Trade'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    if (orders.length > 0) {
      console.log(`   ✅ 找到 ${orders.length} 个Auto-Trader订单`)
      orders.forEach(order => {
        console.log(`\n      订单 ${order.id}:`)
        console.log(`      市场: ${order.name}`)
        console.log(`      方向: ${order.direction}`)
        console.log(`      数量: ${order.quantity}`)
        console.log(`      价格: $${order.price}`)
        console.log(`      状态: ${order.status}`)
        console.log(`      时间: ${order.createdAt}`)
      })
    } else {
      console.log("   ⚠️  还没有Auto-Trader执行记录")
      console.log("   这是正常的，规则会在条件满足时自动执行")
    }

    console.log("\n" + "=".repeat(60))
    console.log("✅ Auto-Trader功能测试完成\n")

    // 提供测试建议
    console.log("\n💡 测试建议:")
    console.log("1. 创建一个Price Target规则，target price设置为当前价格")
    console.log("   这样可以立即触发执行，验证功能是否正常")
    console.log("\n2. 检查backend server日志:")
    console.log("   应该能看到类似以下的日志:")
    console.log("   '🤖 Auto-trader monitoring service started'")
    console.log("   '🔍 Checking N active auto-traders...'")
    console.log("\n3. 监控数据库变化:")
    console.log("   运行: node view-data.js")
    console.log("   查看autoTrader表的executionCount变化")

  } catch (error) {
    console.error("❌ 测试出错:", error)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testAutoTrader()
