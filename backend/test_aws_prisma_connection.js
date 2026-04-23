const prisma = require('./src/prisma')

async function main() {
  console.log('Testing Prisma connection using current DB target...')

  try {
    const [userCount, alertCount, autoTraderCount] = await Promise.all([
      prisma.user.count(),
      prisma.alert.count(),
      prisma.autoTrader.count(),
    ])

    console.log('Successfully connected!')
    console.log('User count:', userCount)
    console.log('Alert count:', alertCount)
    console.log('AutoTrader count:', autoTraderCount)
  } catch (error) {
    console.error('Connection failed:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
