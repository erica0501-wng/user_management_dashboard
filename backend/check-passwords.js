const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPasswords() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, password: true }
  })
  
  console.log('\n📊 User Password Status:\n')
  users.forEach(user => {
    const passwordLength = user.password ? user.password.length : 0
    const isHashed = passwordLength === 60 && user.password.startsWith('$2')
    console.log(`👤 ${user.username} (${user.email})`)
    console.log(`   Password length: ${passwordLength} chars`)
    console.log(`   Properly hashed: ${isHashed ? '✅ YES' : '❌ NO (plain text or invalid)'}`)
    console.log(`   First 20 chars: ${user.password ? user.password.substring(0, 20) : 'null'}`)
    console.log('')
  })
  
  await prisma.$disconnect()
}

checkPasswords()
