// Test regex matching

const detectCategory = (question, description) => {
  const text = `${question || ""} ${description || ""}`.toLowerCase()
  
  console.log("Text:", text.substring(0, 100))
  
  // Entertainment
  if (text.match(/movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress/)) {
    console.log("✅ Matched: Entertainment")
    return "entertainment"
  }
  
  // Crypto
  if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/)) {
    console.log("✅ Matched: Crypto")
    return "crypto"
  }
  
  // Politics
  if (text.match(/election|president|presidential|政治|vote|voting|congress|senate|政府|political|government|campaign/)) {
    console.log("✅ Matched: Politics")
    return "politics"
  }
  
  // Sports
  if (text.match(/sport|football|basketball|soccer|nba|nfl|championship|tennis|premier league|lakers|olympics|world cup|fifa|baseball|hockey/)) {
    console.log("✅ Matched: Sports")
    return "sports"
  }
  
  // Tech
  if (text.match(/\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/)) {
    console.log("✅ Matched: Tech")
    return "tech"
  }
  
  // Finance
  if (text.match(/stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/)) {
    console.log("✅ Matched: Finance")
    return "finance"
  }
  
  console.log("⚠️ Matched: Other")
  return "other"
}

// Test cases
console.log("\n=== Test 1: AI Coding Market ===")
detectCategory(
  "Will AI surpass human performance in coding by 2027?",
  "This market will resolve to 'Yes' if an AI system can independently complete complex software projects better than the average professional developer."
)

console.log("\n=== Test 2: Apple AR Market ===")
detectCategory(
  "Will Apple announce AR glasses in 2026?",
  "This market resolves to 'Yes' if Apple officially announces augmented reality glasses for consumer release in 2026."
)

console.log("\n=== Test 3: Recession Market ===")
detectCategory(
  "Will there be a recession in 2026?",
  "This market resolves to 'Yes' if the US economy enters a recession (two consecutive quarters of negative GDP growth) in 2026."
)

console.log("\n=== Test 4: Stock Market ===")
detectCategory(
  "Will stock market hit new all-time high in Q2 2026?",
  "This market resolves to 'Yes' if the S&P 500 reaches a new all-time high during Q2 2026 (April-June)."
)

console.log("\n=== Test 5: Fed Interest Rates ===")
detectCategory(
  "Will US Fed cut interest rates by 1% in 2026?",
  "This market resolves to 'Yes' if the Federal Reserve cuts interest rates by at least 1 percentage point cumulatively in 2026."
)
