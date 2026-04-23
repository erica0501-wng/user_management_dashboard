export const CATEGORY_META = {
  entertainment: { label: "Entertainment", color: "bg-pink-100 text-pink-800" },
  crypto: { label: "Crypto", color: "bg-orange-100 text-orange-800" },
  politics: { label: "Politics", color: "bg-purple-100 text-purple-800" },
  sports: { label: "Sports", color: "bg-green-100 text-green-800" },
  technology: { label: "Technology", color: "bg-blue-100 text-blue-800" },
  finance: { label: "Finance", color: "bg-yellow-100 text-yellow-800" },
  other: { label: "Other", color: "bg-gray-100 text-gray-800" },
}

const CATEGORY_CHIP_STYLES = {
  entertainment: "bg-pink-100 text-pink-800 border-pink-200",
  crypto: "bg-orange-100 text-orange-800 border-orange-200",
  politics: "bg-purple-100 text-purple-800 border-purple-200",
  sports: "bg-emerald-100 text-emerald-700 border-emerald-200",
  technology: "bg-blue-100 text-blue-800 border-blue-200",
  finance: "bg-amber-100 text-amber-800 border-amber-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
}

const CATEGORY_ORDER = ["crypto", "politics", "sports", "technology", "finance", "entertainment", "other"]

const getPlaceholderImage = (title = "Polymarket Market") => {
  const text = String(title || "Polymarket Market").trim() || "Polymarket Market"
  return `https://via.placeholder.com/1200x400.png?text=${encodeURIComponent(text.slice(0, 80))}`
}

export const CATEGORY_FILTERS = [
  { id: "all", label: "All Categories" },
  ...CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORY_META[id].label,
  })),
]

export const generatePolymarketSlug = (question) => {
  if (!question) return null

  return String(question)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100)
}

export const normalizePolymarketCategory = (value) => {
  const text = String(value || "").trim().toLowerCase()
  if (!text) return "other"

  if (text === "tech" || text.includes("technology") || text.includes("artificial intelligence")) return "technology"
  if (text.includes("entertain")) return "entertainment"
  if (text.includes("crypto") || text.includes("bitcoin") || text.includes("ethereum") || text.includes("blockchain")) return "crypto"
  if (text.includes("polit")) return "politics"
  if (text.includes("sport")) return "sports"
  if (text.includes("finance") || text.includes("stock") || text.includes("macro") || text.includes("rates")) return "finance"
  if (text.includes("other")) return "other"

  return CATEGORY_META[text] ? text : "other"
}

export const detectPolymarketCategory = (question = "", description = "") => {
  const text = `${question || ""} ${description || ""}`.toLowerCase()

  if (text.match(/movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress|gta/)) return "entertainment"
  if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/)) return "crypto"
  if (text.match(/election|president|presidential|政治|vote|voting|congress|senate|政府|political|government|campaign|xi jinping|taiwan|china invade|geopolit/)) return "politics"
  if (text.match(/sport|football|basketball|soccer|hockey|nba|nfl|nhl|championship|tennis|premier league|lakers|olympics|world cup|fifa|baseball|cricket|rugby|stanley cup|relegated?|goal scorer|bundesliga|la liga|serie a|ligue 1|champions league/)) return "sports"
  if (text.match(/\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/)) return "technology"
  if (text.match(/stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/)) return "finance"

  return "other"
}

export const getPolymarketCategoryMeta = (value = "other") => {
  const id = normalizePolymarketCategory(value)
  return {
    id,
    ...CATEGORY_META[id],
    chip: CATEGORY_CHIP_STYLES[id],
  }
}

export const getPolymarketMarketMeta = (market = {}, fallbackLabel = "Polymarket Market") => {
  const displayName = String(
    market.question || market.title || market.marketQuestion || market.marketTitle || fallbackLabel
  ).trim()

  const rawCategory =
    market.category ||
    market.subcategory ||
    market.marketCategory ||
    detectPolymarketCategory(displayName, market.description || "")

  const category = getPolymarketCategoryMeta(rawCategory)
  const imageUrl =
    market.image ||
    market.imageUrl ||
    market.icon ||
    market.marketImage ||
    market.thumbnail ||
    market.bannerImage ||
    null

  const description = String(market.description || market.content || "").trim() 

  return {
    displayName: displayName || fallbackLabel,
    description: description,
    categoryId: category.id,
    categoryLabel: category.label,
    categoryColor: category.color,
    categoryChip: category.chip,
    imageUrl: imageUrl || getPlaceholderImage(displayName || fallbackLabel),
    slug: generatePolymarketSlug(displayName || fallbackLabel),
  }
}

export const getPolymarketEventUrl = (market) => {
  if (!market) return null
  const slug = getPolymarketMarketMeta(market).slug
  return slug ? `https://polymarket.com/market/${slug}` : null
}