const prisma = require('./src/prisma');

async function main() {
  console.log('Testing Prisma connection...');
  try {
    const count = await prisma.user.count();
    console.log('Successfully connected! User count:', count);
  } catch (e) {
    console.error('Connection failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();