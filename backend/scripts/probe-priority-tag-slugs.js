/**
 * Probe Polymarket gamma-api for the priority groups' tag-slug endpoints.
 * Reports how many active events / markets each slug returns right now.
 */
require('dotenv').config()

const SLUGS = [
  { name: 'Elon Tweets',     slug: 'elon-musk' },
  { name: 'Economic Policy', slug: 'economic-policy' },
  { name: 'NBA',             slug: 'nba' },
  { name: 'Movies',          slug: 'movies' },
]

async function fetchEvents(slug, closed) {
  const params = new URLSearchParams({ limit: '50', closed: closed ? 'true' : 'false', tag_slug: slug })
  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }})
  if (!res.ok) return { error: `HTTP ${res.status}`, events: [] }
  const events = await res.json()
  return { events: Array.isArray(events) ? events : [] }
}

;(async () => {
  for (const { name, slug } of SLUGS) {
    const open   = await fetchEvents(slug, false)
    const closed = await fetchEvents(slug, true)
    const openMarkets   = open.events.flatMap(e => Array.isArray(e.markets) ? e.markets : [])
    const closedMarkets = closed.events.flatMap(e => Array.isArray(e.markets) ? e.markets : [])
    console.log(`\n=== ${name} (tag_slug=${slug}) ===`)
    console.log(`  open events  : ${open.events.length}${open.error ? ' [' + open.error + ']' : ''}`)
    console.log(`  open markets : ${openMarkets.length}`)
    console.log(`  closed events: ${closed.events.length}${closed.error ? ' [' + closed.error + ']' : ''}`)
    console.log(`  closed markets: ${closedMarkets.length}`)
    if (openMarkets[0]) {
      console.log(`  sample open  : id=${openMarkets[0].id} q="${(openMarkets[0].question || '').slice(0, 80)}"`)
    }
  }
})()
