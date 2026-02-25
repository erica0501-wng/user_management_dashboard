require('dotenv').config();
const prisma = require('./src/prisma');

async function testDB() {
  console.log('🔍 Testing database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL.substring(0, 50) + '...');
  
  try {
    const users = await prisma.user.findMany();
    console.log('\n✅ Successfully connected to database!');
    console.log(`📊 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.email})`);
    });
    
    if (users.length === 0) {
      console.log('\n⚠️  Database is empty!');
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDB();
