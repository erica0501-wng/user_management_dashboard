const prisma = require("./src/prisma")

async function testTriggerAlert() {
  try {
    console.log("🧪 Testing Alert Notifications System...\n")

    // Get all active alerts
    const alerts = await prisma.alert.findMany({
      where: {
        isActive: true,
        isTriggered: false
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    })

    if (alerts.length === 0) {
      console.log("❌ No active alerts found to test with")
      return
    }

    console.log(`📋 Found ${alerts.length} active alerts\n`)

    // Pick the first alert to trigger
    const testAlert = alerts[0]
    console.log(`🎯 Triggering test alert:`)
    console.log(`   Alert ID: ${testAlert.id}`)
    console.log(`   User: ${testAlert.user.email}`)
    console.log(`   Question: ${testAlert.question}`)
    console.log(`   Type: ${testAlert.alertType}`)
    console.log(`   Notification Channels: ${JSON.stringify(testAlert.notificationChannels)}\n`)

    // Trigger the alert
    const updatedAlert = await prisma.alert.update({
      where: { id: testAlert.id },
      data: {
        isTriggered: true,
        triggeredAt: new Date()
      }
    })

    console.log(`✅ Alert ${testAlert.id} has been triggered!`)
    console.log(`   Triggered At: ${updatedAlert.triggeredAt}`)
    console.log(`\n📱 Check the frontend:`)
    console.log(`   1. Look for the bell icon in the sidebar`)
    console.log(`   2. You should see a red badge with number "1"`)
    console.log(`   3. Click the bell icon to see the notification\n`)

    // Check notification settings
    const settings = await prisma.notificationSettings.findUnique({
      where: { userId: testAlert.userId }
    })

    console.log(`⚙️  User's Notification Settings:`)
    console.log(`   Email Enabled: ${settings?.emailEnabled}`)
    console.log(`   Discord Enabled: ${settings?.discordEnabled}`)
    console.log(`   Webhook Set: ${settings?.discordWebhookUrl ? 'Yes' : 'No'}`)

    if (testAlert.notificationChannels.length === 0) {
      console.log(`\n⚠️  WARNING: This alert has no notification channels configured!`)
      console.log(`   The alert will appear in the UI but no email/discord notifications will be sent.`)
    } else {
      console.log(`\n📧 Notification channels configured: ${JSON.stringify(testAlert.notificationChannels)}`)
      console.log(`   Email/Discord notifications should have been sent when the alert monitoring service detected this.`)
    }

    console.log(`\n💡 To reset: Update the alert in the database to set isTriggered = false`)

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testTriggerAlert()
