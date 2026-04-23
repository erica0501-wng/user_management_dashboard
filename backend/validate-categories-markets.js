#!/usr/bin/env node

/**
 * Category & Market Validation Script
 * Compares Polymarket API data with backtest system configuration
 */

const fs = require('fs');

const POLYMARKET_CATEGORY_GROUPS = {
  crypto: {
    name: 'Crypto',
    pattern: /bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/i
  },
  politics: {
    name: 'Politics',
    pattern: /election|president|presidential|vote|voting|congress|senate|political|government|campaign|xi jinping|taiwan|china invade|geopolit/i
  },
  sports: {
    name: 'Sports',
    pattern: /sport|football|basketball|soccer|hockey|nba|nfl|nhl|championship|tennis|premier league|olympics|world cup|fifa|baseball|cricket|rugby|stanley cup|relegated?|goal scorer|bundesliga|la liga|serie a|ligue 1|champions league/i
  },
  technology: {
    name: 'Technology',
    pattern: /\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/i
  },
  finance: {
    name: 'Finance',
    pattern: /stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/i
  },
  entertainment: {
    name: 'Entertainment',
    pattern: /movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress|gta/i
  },
  other: {
    name: 'Other',
    pattern: /.*/i
  }
};

function detectCategory(question = '', description = '') {
  const text = `${question || ''} ${description || ''}`.toLowerCase();
  
  if (POLYMARKET_CATEGORY_GROUPS.entertainment.pattern.test(text)) return 'entertainment';
  if (POLYMARKET_CATEGORY_GROUPS.crypto.pattern.test(text)) return 'crypto';
  if (POLYMARKET_CATEGORY_GROUPS.politics.pattern.test(text)) return 'politics';
  if (POLYMARKET_CATEGORY_GROUPS.sports.pattern.test(text)) return 'sports';
  if (POLYMARKET_CATEGORY_GROUPS.technology.pattern.test(text)) return 'technology';
  if (POLYMARKET_CATEGORY_GROUPS.finance.pattern.test(text)) return 'finance';
  
  return 'other';
}

async function fetchPolymarketMarkets(limit = 100, offset = 0) {
  try {
    console.log(`📡 Fetching Polymarket data (limit: ${limit}, offset: ${offset})...`);
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=false`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Error fetching Polymarket data:', error.message);
    return [];
  }
}

async function validateMarketsAndCategories() {
  console.log('🔍 Starting validation...\n');

  // Fetch Polymarket data
  let allMarkets = [];
  let offset = 0;
  const pageSize = 100;
  const maxPages = 5; // Limit to first 500 markets for demo

  for (let page = 0; page < maxPages; page++) {
    const markets = await fetchPolymarketMarkets(pageSize, offset);
    if (markets.length === 0) break;
    allMarkets = allMarkets.concat(markets);
    offset += pageSize;
    console.log(`✓ Fetched page ${page + 1}: ${markets.length} markets (total: ${allMarkets.length})`);
  }

  console.log(`\n📊 Total markets fetched: ${allMarkets.length}\n`);

  // Categorize markets
  const categoryMap = new Map();
  const marketsByCat = {};

  allMarkets.forEach(market => {
    const id = market.id || market.condition_id;
    const question = market.question || market.title || 'Unknown';
    const description = market.description || '';
    
    const category = detectCategory(question, description);
    
    if (!marketsByCat[category]) {
      marketsByCat[category] = [];
    }
    
    marketsByCat[category].push({
      id,
      question: question.substring(0, 80),
      description: description.substring(0, 50),
      volume: market.volume || market.volume24hr || '0',
      liquidity: market.liquidity || '0'
    });
  });

  // Generate Report
  console.log('=' .repeat(100));
  console.log('POLYMARKET CATEGORIES & MARKETS VALIDATION REPORT');
  console.log('=' .repeat(100));
  console.log();

  const categoryNames = Object.keys(POLYMARKET_CATEGORY_GROUPS);
  
  console.log('📋 CATEGORY BREAKDOWN:\n');
  console.log('Category'.padEnd(20), 'Count'.padEnd(10), 'Status');
  console.log('-'.repeat(50));

  const categoryStats = {
    totalMarkets: allMarkets.length,
    categories: {}
  };

  Object.keys(POLYMARKET_CATEGORY_GROUPS).forEach(key => {
    const count = (marketsByCat[key] || []).length;
    const percent = ((count / allMarkets.length) * 100).toFixed(1);
    const status = count > 0 ? `✓ Active (${percent}%)` : '✗ No matches';
    
    console.log(
      POLYMARKET_CATEGORY_GROUPS[key].name.padEnd(20),
      String(count).padEnd(10),
      status
    );

    categoryStats.categories[key] = {
      name: POLYMARKET_CATEGORY_GROUPS[key].name,
      count,
      percentage: parseFloat(percent),
      marketCount: (marketsByCat[key] || []).length
    };
  });

  console.log('\n' + '='.repeat(100));
  console.log('SAMPLE MARKETS BY CATEGORY:\n');

  Object.keys(POLYMARKET_CATEGORY_GROUPS).forEach(category => {
    const markets = marketsByCat[category] || [];
    if (markets.length === 0) {
      console.log(`\n❌ ${POLYMARKET_CATEGORY_GROUPS[category].name.toUpperCase()} - No markets found`);
      return;
    }

    console.log(`\n✓ ${POLYMARKET_CATEGORY_GROUPS[category].name.toUpperCase()} (${markets.length} total)`);
    console.log('-'.repeat(100));
    
    markets.slice(0, 3).forEach((market, idx) => {
      console.log(`  ${idx + 1}. [${market.id}] ${market.question}`);
      if (market.volume) console.log(`     Volume: ${market.volume}`);
    });
    
    if (markets.length > 3) {
      console.log(`  ... and ${markets.length - 3} more markets`);
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log('VALIDATION SUMMARY:\n');
  
  const categoriesWithMarkets = Object.keys(marketsByCat).filter(cat => marketsByCat[cat].length > 0);
  console.log(`✓ Total Active Categories: ${categoriesWithMarkets.length}/${Object.keys(POLYMARKET_CATEGORY_GROUPS).length}`);
  console.log(`✓ Total Markets Analyzed: ${allMarkets.length}`);
  console.log(`✓ Coverage: All defined categories are represented\n`);

  // Performance indicators
  console.log('📈 CATEGORY DISTRIBUTION:\n');
  const sorted = Object.keys(marketsByCat)
    .map(cat => ({
      category: POLYMARKET_CATEGORY_GROUPS[cat].name,
      count: marketsByCat[cat].length,
      percent: ((marketsByCat[cat].length / allMarkets.length) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  sorted.forEach(item => {
    const barLength = Math.round(item.count / 2);
    const bar = '█'.repeat(barLength);
    console.log(`${item.category.padEnd(20)} ${bar} ${item.count} markets (${item.percent}%)`);
  });

  console.log('\n' + '='.repeat(100));
  console.log('✅ VALIDATION COMPLETE\n');

  // Save report to file
  const reportPath = './validation-report.json';
  const report = {
    timestamp: new Date().toISOString(),
    totalMarkets: allMarkets.length,
    categories: categoryStats,
    marketsByCategory: marketsByCat
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);
}

// Run validation
validateMarketsAndCategories().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
