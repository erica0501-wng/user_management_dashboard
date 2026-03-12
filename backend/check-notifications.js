const prisma = require("./src/prisma")

async function checkNotifications() {
  try {
    console.log("🔍 Checking Notifications Setup...\n")

    // Check users
    const users = await prisma.user.findMany()
    console.log(`👥 Found ${users.length} users:`)
    users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`)
    })
    console.log()

    // Check notification settings
    const settings = await prisma.notificationSettings.findMany()
    console.log(`⚙️  Found ${settings.length} notification settings:`)
    settings.forEach(setting => {
      console.log(`  - User ${setting.userId}:`)
      console.log(`    Email: ${setting.emailEnabled}`)
      console.log(`    Discord: ${setting.discordEnabled}`)
      console.log(`    Webhook: ${setting.discordWebhookUrl ? '✓ Set' : '✗ Not set'}`)
      console.log(`    Default Channels: ${JSON.stringify(setting.defaultChannels)}`)
    })
    console.log()

    // Check alerts
    const alerts = await prisma.alert.findMany({
      where: { isActive: true }
    })
    console.log(`🔔 Found ${alerts.length} enabled alerts:`)
    alerts.forEach(alert => {
      console.log(`  - Alert ${alert.id}:`)
      console.log(`    Question: ${alert.question}`)
      console.log(`    Type: ${alert.alertType}`)
      console.log(`    Triggered: ${alert.isTriggered}`)
      console.log(`    Notification Channels: ${JSON.stringify(alert.notificationChannels)}`)
    })
    console.log()

    // Check auto traders
    const autoTraders = await prisma.autoTrader.findMany({
      where: { isActive: true }
    })
    console.log(`🤖 Found ${autoTraders.length} enabled auto traders:`)
    autoTraders.forEach(trader => {
      console.log(`  - AutoTrader ${trader.id}:`)
      console.log(`    Market: ${trader.marketId}`)
      console.log(`    Notification Channels: ${JSON.stringify(trader.notificationChannels)}`)
    })
    console.log()

    // Check if alert monitoring is running
    console.log("📊 Summary:")
    console.log(`  Users with notification settings: ${settings.length}/${users.length}`)
    console.log(`  Email enabled: ${settings.filter(s => s.emailEnabled).length}`)
    console.log(`  Discord enabled: ${settings.filter(s => s.discordEnabled).length}`)
    console.log(`  Active alerts: ${alerts.length}`)
    console.log(`  Active auto traders: ${autoTraders.length}`)

    // Check SMTP configuration
    console.log("\n📧 SMTP Configuration:")
    console.log(`  SMTP_HOST: ${process.env.SMTP_HOST || '✗ Not set'}`)
    console.log(`  SMTP_USER: ${process.env.SMTP_USER || '✗ Not set'}`)
    console.log(`  SMTP_PASS: ${process.env.SMTP_PASS ? '✓ Set' : '✗ Not set'}`)

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkNotifications()
