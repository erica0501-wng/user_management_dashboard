const prisma = require('../prisma');

/**
 * Default market group patterns
 */
const DEFAULT_GROUPS = {
  'Elon Tweets': {
    pattern: /elon|musk|elonmusk|twitter|tesla|spacex|space x|starship|xai|cybertruck|\bx posts?\b|tweet/i,
    description: 'Polymarket Elon Tweets group (https://polymarket.com/predictions/elon-tweets)'
  },
  'Economic Policy': {
    pattern: /economic|economy|policy|fed\b|federal reserve|interest rate|rate cut|rate hike|inflation|cpi|tariff|trade war|recession|gdp|treasury|powell|jobs report|unemployment|fomc|bond yield/i,
    description: 'Polymarket Economic Policy group (https://polymarket.com/predictions/economic-policy)'
  },
  'NBA': {
    pattern: /\bnba\b|basketball|playoff|finals|warriors|lakers|celtics|knicks|nuggets|heat|bucks|sixers|76ers|clippers|mavericks|nets|suns|timberwolves|thunder|grizzlies|kings|hawks|raptors|hornets|magic|wizards|pistons|cavaliers|cavs|bulls|spurs|jazz|trail blazers|blazers|pelicans|pacers|rockets/i,
    description: 'Polymarket NBA group (https://polymarket.com/predictions/nba)'
  },
  'Movies': {
    pattern: /\bmovie\b|\bfilm\b|box office|opening weekend|oscar|academy award|cinema|sequel|marvel|disney film|netflix film|theatrical|premiere|gross|rotten tomatoes/i,
    description: 'Polymarket Movies group (https://polymarket.com/pop-culture/movies)'
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

const POLYMARKET_CATEGORY_GROUPS = {
  crypto: {
    name: 'Crypto',
    description: 'Polymarket crypto-related markets',
    pattern: /bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/i
  },
  politics: {
    name: 'Politics',
    description: 'Polymarket politics and government markets',
    pattern: /election|president|presidential|vote|voting|congress|senate|political|government|campaign|xi jinping|taiwan|china invade|geopolit/i
  },
  sports: {
    name: 'Sports',
    description: 'Polymarket sports and tournament markets',
    pattern: /sport|football|basketball|soccer|hockey|nba|nfl|nhl|championship|tennis|premier league|olympics|world cup|fifa|baseball|cricket|rugby|stanley cup|relegated?|goal scorer|bundesliga|la liga|serie a|ligue 1|champions league/i
  },
  technology: {
    name: 'Technology',
    description: 'Polymarket technology and AI markets',
    pattern: /\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/i
  },
  finance: {
    name: 'Finance',
    description: 'Polymarket macro and finance markets',
    pattern: /stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/i
  },
  entertainment: {
    name: 'Entertainment',
    description: 'Polymarket entertainment and media markets',
    pattern: /movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress|gta/i
  },
  other: {
    name: 'Other',
    description: 'Polymarket markets outside predefined categories',
    pattern: /.*/i
  }
};

function getPolymarketCategoryNames() {
  return Object.values(POLYMARKET_CATEGORY_GROUPS).map((config) => config.name);
}

function detectPolymarketCategory(question = '', description = '') {
  const text = `${question || ''} ${description || ''}`.toLowerCase();

  if (POLYMARKET_CATEGORY_GROUPS.entertainment.pattern.test(text)) return 'entertainment';
  if (POLYMARKET_CATEGORY_GROUPS.crypto.pattern.test(text)) return 'crypto';
  if (POLYMARKET_CATEGORY_GROUPS.politics.pattern.test(text)) return 'politics';
  if (POLYMARKET_CATEGORY_GROUPS.sports.pattern.test(text)) return 'sports';
  if (POLYMARKET_CATEGORY_GROUPS.technology.pattern.test(text)) return 'technology';
  if (POLYMARKET_CATEGORY_GROUPS.finance.pattern.test(text)) return 'finance';

  return 'other';
}

async function getUniqueMarkets() {
  return prisma.polymarketMarketSnapshot.findMany({
    distinct: ['marketId'],
    select: { marketId: true, question: true },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Initialize market groups with default patterns
 */
async function initializeDefaultGroups() {
  for (const [groupName, config] of Object.entries(DEFAULT_GROUPS)) {
    try {
      await prisma.marketGroup.upsert({
        where: { name: groupName },
        update: {
          description: config.description,
          pattern: config.pattern.source,
          updatedAt: new Date()
        },
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
    const uniqueMarkets = await getUniqueMarkets();

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
 * Build market groups based on the same category logic used by Polymarket page
 */
async function syncGroupsFromPolymarketCategories() {
  const uniqueMarkets = await getUniqueMarkets();

  const groupedMarketIds = {
    crypto: [],
    politics: [],
    sports: [],
    technology: [],
    finance: [],
    entertainment: [],
    other: []
  };

  for (const market of uniqueMarkets) {
    const category = detectPolymarketCategory(market.question || '', '');
    groupedMarketIds[category].push(market.marketId);
  }

  for (const [category, config] of Object.entries(POLYMARKET_CATEGORY_GROUPS)) {
    const marketIds = Array.from(new Set(groupedMarketIds[category] || []));

    await prisma.marketGroup.upsert({
      where: { name: config.name },
      update: {
        description: config.description,
        pattern: config.pattern.source,
        markets: marketIds,
        updatedAt: new Date()
      },
      create: {
        name: config.name,
        description: config.description,
        pattern: config.pattern.source,
        markets: marketIds
      }
    });
  }

  return getAllGroups({ mode: 'polymarket' });
}

/**
 * Get backtest data for a specific market group
 * Returns historical snapshots for all markets in the group within time range
 */
async function getGroupBacktestData(groupName, options = {}) {
  const {
    startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
    endTime = new Date(),
    includeOrderBook = false,
    marketId = null
  } = options;

  const normalizedMarketId = String(marketId || '').trim();

  try {
    if (normalizedMarketId) {
      console.log(`Fetching backtest data for specific market ${normalizedMarketId}`);

      const snapshots = await prisma.polymarketMarketSnapshot.findMany({
        where: {
          marketId: normalizedMarketId,
          intervalStart: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: { intervalStart: 'asc' }
      });

      console.log(`Retrieved ${snapshots.length} market snapshots for market ${normalizedMarketId}`);

      return {
        groupName,
        marketId: normalizedMarketId,
        marketCount: 1,
        snapshotCount: snapshots.length,
        startTime,
        endTime,
        snapshots
      };
    }

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
async function getAllGroups(options = {}) {
  const mode = options.mode || 'all';
  try {
    const where =
      mode === 'polymarket'
        ? {
            name: {
              in: getPolymarketCategoryNames()
            }
          }
        : undefined;

    const groups = await prisma.marketGroup.findMany({
      where,
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

    if (mode === 'polymarket') {
      const preferredOrder = getPolymarketCategoryNames();
      groups.sort((a, b) => preferredOrder.indexOf(a.name) - preferredOrder.indexOf(b.name));
      return groups;
    }

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
  POLYMARKET_CATEGORY_GROUPS,
  initializeDefaultGroups,
  categorizeAllMarkets,
  syncGroupsFromPolymarketCategories,
  detectPolymarketCategory,
  getGroupBacktestData,
  getAllGroups,
  upsertMarketGroup
};
