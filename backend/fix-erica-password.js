const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function fixEricaPassword() {
  const password = 'EricaWong@123' // Same format as CindyLai@123
  const hashedPassword = await bcrypt.hash(password, 10)
  
  await prisma.user.update({
    where: { email: 'ericawong@gmail.com' },
    data: { password: hashedPassword }
  })
  
  console.log('✅ Password set for Erica Wong')
  console.log('📧 Email: ericawong@gmail.com')
  console.log('🔑 Password: EricaWong@123')
  
  await prisma.$disconnect()
}

fixEricaPassword()
