const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    // Get all users
    const users = await prisma.user.findMany();
    console.log('\n=== USERS ===');
    users.forEach(u => {
      console.log(`ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`);
    });
    
    // Get all shared watchlists
    const watchlists = await prisma.sharedWatchlist.findMany({
      include: {
        owner: { select: { id: true, username: true } }
      }
    });
    console.log('\n=== SHARED WATCHLISTS ===');
    watchlists.forEach(w => {
      console.log(`ID: ${w.id}, Title: ${w.title}, Owner: ${w.owner.username} (ID: ${w.ownerId})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
