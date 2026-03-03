const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMyShares() {
  try {
    // Get Erica Wong's ID
    const ericaWong = await prisma.user.findUnique({
      where: { email: 'ericawong@gmail.com' },
      select: { id: true, username: true }
    });

    console.log('Erica Wong:', ericaWong);

    // Get her shared watchlists
    const sharedWatchlists = await prisma.sharedWatchlist.findMany({
      where: { ownerId: ericaWong.id },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n=== MY SHARED WATCHLISTS ===');
    console.log(JSON.stringify(sharedWatchlists, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMyShares();
