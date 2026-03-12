const prisma = require("./src/prisma")

async function checkAlertDetails() {
  try {
    console.log("🔍 Checking Alert Details...\n")

    // Get all alerts with user info
    const alerts = await prisma.alert.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    console.log(`Found ${alerts.length} active alerts:\n`)
    
    alerts.forEach(alert => {
      console.log(`📌 Alert ${alert.id}:`)
      console.log(`  User: ${alert.user.email} (ID: ${alert.user.id})`)
      console.log(`  Question: ${alert.question}`)
      console.log(`  Type: ${alert.alertType}`)
      console.log(`  Notification Channels: ${JSON.stringify(alert.notificationChannels)}`)
      console.log(`  Is Triggered: ${alert.isTriggered}`)
      console.log(`  Created: ${alert.createdAt}`)
      console.log()
    })

    // Check if these users have notification settings
    console.log("Checking notification settings for alert owners...\n")
    for (const alert of alerts) {
      const settings = await prisma.notificationSettings.findUnique({
        where: { userId: alert.userId }
      })
      
      console.log(`User ${alert.user.email}:`)
      if (settings) {
        console.log(`  ✓ Has notification settings`)
        console.log(`    Email: ${settings.emailEnabled}`)
        console.log(`    Discord: ${settings.discordEnabled}`)
        console.log(`    Default Channels: ${JSON.stringify(settings.defaultChannels)}`)
      } else {
        console.log(`  ✗ No notification settings found`)
      }
      console.log()
    }

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAlertDetails()
