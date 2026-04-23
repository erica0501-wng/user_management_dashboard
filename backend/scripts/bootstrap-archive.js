require('dotenv').config();
const archiver = require('../src/services/polymarketDataArchiver');
const { initializeDefaultGroups, categorizeAllMarkets, syncGroupsFromPolymarketCategories } = require('../src/services/marketGrouping');

(async () => {
  console.log('--- Initializing default market groups ---');
  await initializeDefaultGroups();

  console.log('\n--- Running one archive pass (this may take a minute) ---');
  await archiver.archiveSnapshots();

  console.log('\n--- Categorizing markets to MarketGroup.markets ---');
  await categorizeAllMarkets();
  await syncGroupsFromPolymarketCategories();

  console.log('\n✅ Done');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
