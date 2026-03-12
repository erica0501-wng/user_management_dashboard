const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testNotificationSettings() {
  try {
    console.log('Testing NotificationSettings table...')
    const settings = await prisma.notificationSettings.findMany()
    console.log('✅ Found', settings.length, 'notification settings')
    
    // Try to create a test setting
    const testUserId = 1
    const existing = await prisma.notificationSettings.findUnique({
      where: { userId: testUserId }
    })
    
    if (existing) {
      console.log('✅ Settings exist for user', testUserId)
    } else {
      console.log('⚠️ No settings for user', testUserId)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testNotificationSettings()
