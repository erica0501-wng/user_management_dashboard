const prisma = require('../prisma');

/**
 * Default market group patterns
 */
const DEFAULT_GROUPS = {
  'Elon Tweets': {
    pattern: /elon|tweet|elonmusk|twitter|elon musk/i,
    description: 'Markets related to Elon Musk tweets and Twitter/X activity'
  },
  'Mr Beast Videos': {
    pattern: /mrbeast|mr beast|video count|beast|youtuber/i,
    description: 'Markets related to Mr Beast videos and creator content'
  },
  'Crypto Events': {
    pattern: /bitcoin|ethereum|btc|eth|crypto|blockchain|web3|defi/i,
    description: 'Markets related to cryptocurrency and blockchain events'
  },
  'Stock Movements': {
    pattern: /tesla|apple|nvidia|microsoft|google|stock|s&p|dow|nasdaq/i,
    description: 'Markets related to stock price movements and financial indices'
  },
  'Sports': {
    pattern: /nfl|nba|nhl|soccer|football|championship|super bowl|world cup|olympic/i,
    description: 'Markets related to sports events and outcomes'
  },
  'Politics': {
    pattern: /election|vote|president|congress|senate|government|political|democrat|republican/i,
    description: 'Markets related to political events and elections'
  },
  'Tech Product Launches': {
    pattern: /iphone|android|product launch|release|announcement|app|software|version|update/i,
    description: 'Markets related to technology product launches and announcements'
  }
};

/**
 * Initialize market groups with default patterns
 */
async function initializeDefaultGroups() {
  for (const [groupName, config] of Object.entries(DEFAULT_GROUPS)) {
    try {
      await prisma.marketGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
          name: groupName,
          description: config.description,
          pattern: config.pattern.source,
          markets: []
        }
      });
      console.log(`✓ Initialized market group: ${groupName}`);
    } catch (error) {
      console.error(`✗ Failed to initialize ${groupName}:`, error.message);
    }
  }
}

/**
 * Categorize all markets by matching their questions against group patterns
 * Updates MarketGroup.markets with matched marketIds
 */
async function categorizeAllMarkets() {
  console.log('Starting market categorization...');
  
  try {
    // Get all unique markets with their latest questions
    const uniqueMarkets = await prisma.polymarketMarketSnapshot.findMany({
      distinct: ['marketId'],
      select: { marketId: true, question: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${uniqueMarkets.length} unique markets to categorize`);

    // Get all market groups
    const groups = await prisma.marketGroup.findMany();
    
    for (const group of groups) {
      const pattern = new RegExp(group.pattern);
      const matchedMarkets = uniqueMarkets
        .filter(m => pattern.test(m.question))
        .map(m => m.marketId);

      if (matchedMarkets.length > 0) {
        await prisma.marketGroup.update({
          where: { id: group.id },
          data: { markets: matchedMarkets }
        });
        console.log(`✓ ${group.name}: ${matchedMarkets.length} markets matched`);
      }
    }

    console.log('Market categorization completed');
  } catch (error) {
    console.error('Error categorizing markets:', error);
    throw error;
  }
}

/**
 * Get backtest data for a specific market group
 * Returns historical snapshots for all markets in the group within time range
 */
async function getGroupBacktestData(groupName, options = {}) {
  const {
    startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
    endTime = new Date(),
    includeOrderBook = false
  } = options;

  try {
    // Find the market group
    const group = await prisma.marketGroup.findUnique({
      where: { name: groupName }
    });

    if (!group || group.markets.length === 0) {
      throw new Error(`Market group "${groupName}" not found or has no markets`);
    }

    console.log(`Fetching backtest data for ${groupName} (${group.markets.length} markets)`);

    // Get all market snapshots for this group within time range
    const snapshots = await prisma.polymarketMarketSnapshot.findMany({
      where: {
        marketId: { in: group.markets },
        intervalStart: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { intervalStart: 'asc' }
    });

    console.log(`Retrieved ${snapshots.length} market snapshots`);
    
    return {
      groupName,
      marketCount: group.markets.length,
      snapshotCount: snapshots.length,
      startTime,
      endTime,
      snapshots
    };
  } catch (error) {
    console.error(`Error fetching backtest data for ${groupName}:`, error);
    throw error;
  }
}

/**
 * Get all available market groups
 */
async function getAllGroups() {
  try {
    const groups = await prisma.marketGroup.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        markets: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { backtests: true }
        }
      }
    });
    return groups;
  } catch (error) {
    console.error('Error fetching market groups:', error);
    throw error;
  }
}

/**
 * Create or update a custom market group
 */
async function upsertMarketGroup(name, pattern, description = null) {
  try {
    // Test pattern validity
    new RegExp(pattern);

    const group = await prisma.marketGroup.upsert({
      where: { name },
      update: {
        pattern,
        description,
        updatedAt: new Date()
      },
      create: {
        name,
        pattern,
        description,
        markets: []
      }
    });

    // Re-categorize markets for this group
    const uniqueMarkets = await prisma.polymarketMarketSnapshot.findMany({
      distinct: ['marketId'],
      select: { marketId: true, question: true }
    });

    const regex = new RegExp(pattern);
    const matchedMarkets = uniqueMarkets
      .filter(m => regex.test(m.question))
      .map(m => m.marketId);

    const updatedGroup = await prisma.marketGroup.update({
      where: { id: group.id },
      data: { markets: matchedMarkets }
    });

    console.log(`✓ Market group "${name}" upserted with ${matchedMarkets.length} matches`);
    return updatedGroup;
  } catch (error) {
    console.error(`Error upserting market group "${name}":`, error);
    throw error;
  }
}

module.exports = {
  DEFAULT_GROUPS,
  initializeDefaultGroups,
  categorizeAllMarkets,
  getGroupBacktestData,
  getAllGroups,
  upsertMarketGroup
};
