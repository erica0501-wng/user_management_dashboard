const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLike() {
  try {
    // Get first user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found');
      return;
    }
    console.log('Testing with user:', user.username, 'id:', user.id);
    
    // Get first shared watchlist
    const watchlist = await prisma.sharedWatchlist.findFirst();
    if (!watchlist) {
      console.log('No shared watchlists found');
      return;
    }
    console.log('Testing with watchlist:', watchlist.title, 'id:', watchlist.id);
    console.log('Watchlist owner id:', watchlist.ownerId);
    console.log('Is user the owner?', user.id === watchlist.ownerId);
    
    // Check if already liked
    const existing = await prisma.watchlistLike.findUnique({
      where: {
        sharedWatchlistId_userId: {
          sharedWatchlistId: watchlist.id,
          userId: user.id
        }
      }
    });
    
    console.log('Already liked?', !!existing);
    
    if (existing) {
      console.log('Unlike - deleting like');
      await prisma.watchlistLike.delete({
        where: {
          sharedWatchlistId_userId: {
            sharedWatchlistId: watchlist.id,
            userId: user.id
          }
        }
      });
      console.log('✓ Successfully unliked');
    } else {
      console.log('Like - creating like');
      await prisma.watchlistLike.create({
        data: {
          sharedWatchlistId: watchlist.id,
          userId: user.id
        }
      });
      console.log('✓ Successfully liked');
    }
    
    // Check total likes
    const likes = await prisma.watchlistLike.findMany({
      where: { sharedWatchlistId: watchlist.id }
    });
    console.log('Total likes for this watchlist:', likes.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLike();
