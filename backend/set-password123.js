const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function setPassword123() {
  const password = 'password123'
  const hashedPassword = await bcrypt.hash(password, 10)
  
  await prisma.user.update({
    where: { email: 'ericawong@gmail.com' },
    data: { password: hashedPassword }
  })
  
  console.log('✅ Password updated for Erica Wong')
  console.log('📧 Email: ericawong@gmail.com')
  console.log('🔑 Password: password123')
  
  await prisma.$disconnect()
}

setPassword123()
