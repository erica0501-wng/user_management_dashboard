const prisma = require("./src/prisma")

async function fixNotifications() {
  try {
    console.log("🔧 Fixing Notification Issues...\n")

    // Step 1: Create default notification settings for all users without settings
    const users = await prisma.user.findMany()
    console.log(`📋 Found ${users.length} users\n`)

    let settingsCreated = 0
    for (const user of users) {
      const existingSettings = await prisma.notificationSettings.findUnique({
        where: { userId: user.id }
      })

      if (!existingSettings) {
        await prisma.notificationSettings.create({
          data: {
            userId: user.id,
            emailEnabled: true,
            discordEnabled: false,
            defaultChannels: ["email"]
          }
        })
        console.log(`✅ Created default settings for ${user.email}`)
        settingsCreated++
      } else {
        console.log(`⏭️  ${user.email} already has settings`)
      }
    }
    console.log(`\n✨ Created notification settings for ${settingsCreated} users\n`)

    // Step 2: Update alerts with empty notification channels
    const allAlerts = await prisma.alert.findMany({
      include: {
        user: {
          select: {
            email: true,
            notificationSettings: true
          }
        }
      }
    })
    
    // Filter alerts with empty or null notification channels
    const alertsWithEmptyChannels = allAlerts.filter(alert => 
      !alert.notificationChannels || alert.notificationChannels.length === 0
    )

    console.log(`📧 Found ${alertsWithEmptyChannels.length} alerts with empty notification channels\n`)

    let alertsUpdated = 0
    for (const alert of alertsWithEmptyChannels) {
      // Use user's default channels if available, otherwise use ["email"]
      const defaultChannels = alert.user.notificationSettings?.defaultChannels || ["email"]
      
      await prisma.alert.update({
        where: { id: alert.id },
        data: { notificationChannels: defaultChannels }
      })
      
      console.log(`✅ Updated Alert ${alert.id} for ${alert.user.email} with channels: ${JSON.stringify(defaultChannels)}`)
      alertsUpdated++
    }

    console.log(`\n🎉 Updated ${alertsUpdated} alerts with default notification channels\n`)

    // Step 3: Verify the changes
    console.log("🔍 Verifying changes...\n")

    const settingsCount = await prisma.notificationSettings.count()
    const alertsWithChannels = await prisma.alert.count({
      where: {
        AND: [
          { notificationChannels: { isEmpty: false } },
          { isActive: true }
        ]
      }
    })

    console.log("📊 Summary:")
    console.log(`  Total users: ${users.length}`)
    console.log(`  Users with notification settings: ${settingsCount}`)
    console.log(`  Active alerts with notification channels: ${alertsWithChannels}`)
    console.log("\n✅ Fix completed!")

  } catch (error) {
    console.error("❌ Error:", error)
    console.error("Stack:", error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

fixNotifications()
