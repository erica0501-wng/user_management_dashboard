// Test watchlist API endpoints
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWatchlist() {
  try {
    console.log('🧪 Testing Watchlist functionality...\n');
    
    // 1. Find a test user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }
    console.log('✅ Found user:', user.username, `(ID: ${user.id})`);
    
    // 2. Check existing watchlist
    const existingWatchlist = await prisma.watchlist.findMany({
      where: { userId: user.id }
    });
    console.log('📋 Current watchlist:', existingWatchlist.map(w => w.symbol));
    
    // 3. Try to add a stock to watchlist
    const testSymbol = 'AAPL';
    console.log(`\n➕ Adding ${testSymbol} to watchlist...`);
    
    const newItem = await prisma.watchlist.create({
      data: {
        userId: user.id,
        symbol: testSymbol
      }
    }).catch(err => {
      if (err.code === 'P2002') {
        console.log('⚠️  Stock already in watchlist');
        return null;
      }
      throw err;
    });
    
    if (newItem) {
      console.log('✅ Added to watchlist:', newItem);
    }
    
    // 4. Get full watchlist
    const fullWatchlist = await prisma.watchlist.findMany({
      where: { userId: user.id }
    });
    console.log('\n📋 Updated watchlist:', fullWatchlist.map(w => w.symbol));
    
    // 5. Test removing
    console.log(`\n➖ Removing ${testSymbol} from watchlist...`);
    await prisma.watchlist.deleteMany({
      where: {
        userId: user.id,
        symbol: testSymbol
      }
    });
    console.log('✅ Removed from watchlist');
    
    // 6. Final check
    const finalWatchlist = await prisma.watchlist.findMany({
      where: { userId: user.id }
    });
    console.log('📋 Final watchlist:', finalWatchlist.map(w => w.symbol));
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWatchlist();
