#!/usr/bin/env node

/**
 * Detailed Other Category Analysis
 */

const POLYMARKET_CATEGORY_GROUPS = {
  crypto: /bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/i,
  politics: /election|president|presidential|vote|voting|congress|senate|political|government|campaign|xi jinping|taiwan|china invade|geopolit/i,
  sports: /sport|football|basketball|soccer|hockey|nba|nfl|nhl|championship|tennis|premier league|olympics|world cup|fifa|baseball|cricket|rugby|stanley cup|relegated?|goal scorer|bundesliga|la liga|serie a|ligue 1|champions league/i,
  technology: /\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/i,
  finance: /stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/i,
  entertainment: /movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress|gta/i
};

function detectCategory(question = '', description = '') {
  const text = `${question || ''} ${description || ''}`.toLowerCase();
  for (const [key, pattern] of Object.entries(POLYMARKET_CATEGORY_GROUPS)) {
    if (pattern.test(text)) return key;  }
  return 'other';
}

async function analyzeOtherCategory() {
  console.log('🔍 Analyzing "Other" category markets...\n');

  let allMarkets = [];
  let offset = 0;
  const pageSize = 100;

  // Fetch all markets
  for (let page = 0; page < 5; page++) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${pageSize}&offset=${offset}&closed=false`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) break;
    const markets = await response.json();
    if (markets.length === 0) break;
    allMarkets = allMarkets.concat(markets);
    offset += pageSize;
  }

  // Filter "Other" markets
  const otherMarkets = allMarkets.filter(m => {
    const category = detectCategory(m.question || '', m.description || '');
    return category === 'other';
  });

  console.log(`📊 Found ${otherMarkets.length} markets in "Other" category:\n`);
  console.log('ID'.padEnd(12), 'Question'.padEnd(60), 'Suggested Category');
  console.log('='.repeat(120));

  // Suggest new categories based on content
  otherMarkets.forEach(market => {
    const question = (market.question || 'N/A').substring(0, 55).padEnd(60);
    const id = String(market.id || market.condition_id).padEnd(12);

    // Try to suggest improvements
    let suggestedCat = 'other';
    const text = `${market.question || ''} ${market.description || ''}`.toLowerCase();
    
    if (text.includes('gta') || text.includes('game') || text.includes('release')) suggestedCat = 'entertainment/tech';
    if (text.includes('jesus') || text.includes('apocalypse')) suggestedCat = 'other (niche)';
    if (text.includes('hurricane') || text.includes('weather')) suggestedCat = 'other (nature)';

    console.log(id, question, suggestedCat);
  });

  console.log('\n' + '='.repeat(120));
  console.log('💡 Recommendation:\n');
  console.log('Your Technology and Finance categories are NOT matching any real Polymarket markets.');
  console.log('Consider:');
  console.log('  1. Update pattern matching rules for Tech/Finance');
  console.log('  2. Or remove them if Polymarket doesn\'t have active markets in these categories');
  console.log('  3. Use "Other" category for niche markets\n');
}

analyzeOtherCategory().catch(console.error);
