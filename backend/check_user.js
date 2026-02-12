const { PrismaClient } = require('@prisma/client')
const path = require('path')

// Manually set the absolute path to the database to avoid resolution issues
const dbPath = path.join(__dirname, 'prisma', 'prisma', 'dev.db')
process.env.DATABASE_URL = `file:${dbPath}`

console.log('Using DATABASE_URL:', process.env.DATABASE_URL)

const prisma = new PrismaClient()

async function main() {
  const email = 'ericawong@gmail.com'
  const user = await prisma.user.findUnique({
    where: { email }
  })
  
  if (user) {
    console.log('User found:', user.email, 'ID:', user.id, 'Role:', user.role)
    // Check if password matches 'password123'
    const bcrypt = require('bcryptjs')
    const isMatch = await bcrypt.compare('password123', user.password)
    console.log('Password "password123" matches:', isMatch)

    if (!isMatch) {
       console.log('Resetting password to "password123"...')
       const hash = await bcrypt.hash('password123', 10)
       await prisma.user.update({
         where: { email },
         data: { password: hash }
       })
       console.log('Password reset complete.')
    }
  } else {
    console.log('User not found!')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())