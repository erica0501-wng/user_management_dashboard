const { PrismaClient } = require("@prisma/client")
const path = require("path")

// Fix for relative path in DATABASE_URL
let dbUrl = process.env.DATABASE_URL || ""

console.log('🔍 Original DATABASE_URL:', dbUrl.substring(0, 50) + '...')

// If running in development and using file: protocol with relative path, resolve it
if (dbUrl.includes("file:./") || dbUrl.includes("file:.")) {
  // .env usually has "file:./prisma/prisma/dev.db"
  // We need to make this absolute based on where the app is running or where the file actually is.
  // Assuming the file is at backend/prisma/prisma/dev.db and we are in backend/src/
  const relativePart = dbUrl.replace("file:", "")
  
  // Resolve relative to the project root (backend/)
  // Only apply this fix if NOT running in Vercel/Production where paths might be different
  if (!process.env.VERCEL) {
     const absolutePath = path.resolve(__dirname, "..", relativePart)
     dbUrl = `file:${absolutePath}`
     console.log('🔌 Resolved DB URL to absolute path:', dbUrl)
  }
}

console.log('✅ Final DATABASE_URL being used:', dbUrl.includes('postgresql') ? 'PostgreSQL (Neon)' : 'SQLite (Local)')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

module.exports = prisma
