require("dotenv").config({
  // Keep Prisma connection source consistent with app.js during local dev.
  override: process.env.NODE_ENV !== "production"
})

const { PrismaClient } = require("@prisma/client")
const path = require("path")

function toBool(value) {
  return String(value || "false").toLowerCase() === "true"
}

function withSchemaIfPostgres(dbUrl, schemaName) {
  if (!dbUrl || !dbUrl.toLowerCase().startsWith("postgresql://")) {
    return dbUrl
  }

  try {
    const parsed = new URL(dbUrl)
    parsed.searchParams.set("schema", schemaName)
    return parsed.toString()
  } catch (error) {
    console.warn("⚠️ Failed to parse DB URL for schema isolation, using raw URL")
    return dbUrl
  }
}

function resolveDatabaseUrl() {
  const dbTarget = String(process.env.DB_TARGET || "primary").toLowerCase()
  const useAwsDatabase = toBool(process.env.USE_AWS_DATABASE) || dbTarget === "aws"
  const primaryDbUrl = process.env.DATABASE_URL || ""
  const awsDbUrl = process.env.AWS_DATABASE_URL || ""

  let resolvedUrl = useAwsDatabase && awsDbUrl ? awsDbUrl : primaryDbUrl

  if (useAwsDatabase && !awsDbUrl) {
    console.warn("⚠️ USE_AWS_DATABASE=true but AWS_DATABASE_URL is missing. Falling back to DATABASE_URL.")
  }

  const shouldEnforceIsolation = toBool(process.env.AWS_DB_ENFORCE_ISOLATION || "true")
  if (useAwsDatabase && shouldEnforceIsolation) {
    const isolatedSchema = process.env.AWS_DB_SCHEMA || "user_management_dashboard_aws"
    resolvedUrl = withSchemaIfPostgres(resolvedUrl, isolatedSchema)
  }

  return {
    dbTarget,
    useAwsDatabase,
    dbUrl: resolvedUrl,
  }
}

// Fix for relative path in DATABASE_URL
const { dbTarget, useAwsDatabase, dbUrl: initialDbUrl } = resolveDatabaseUrl()
let dbUrl = initialDbUrl

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

let dbProviderLabel = 'SQLite (Local)'
if (dbUrl.includes('postgresql')) {
  if (dbUrl.includes('supabase.co')) {
    dbProviderLabel = 'PostgreSQL (Supabase)'
  } else if (dbUrl.includes('rds.amazonaws.com')) {
    dbProviderLabel = 'PostgreSQL (AWS RDS)'
  } else if (dbUrl.includes('neon.tech') || dbUrl.includes('neon.')) {
    dbProviderLabel = 'PostgreSQL (Neon)'
  } else {
    dbProviderLabel = 'PostgreSQL (Custom)'
  }
}

console.log('✅ Final DATABASE_URL being used:', dbProviderLabel)
console.log('🧭 DB target:', useAwsDatabase ? 'aws' : dbTarget)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

module.exports = prisma
