// 国际行情代理：批量拉取 Yahoo Finance v8 chart（无需 crumb，CF 可直接代理）
// 用法：/api/world?symbols=AAPL,TSLA,^IXIC  或  /api/world?symbol=AAPL
import { cacheGet, cachePut, json } from "./_lib.js"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  const raw = url.searchParams.get("symbols") || url.searchParams.get("symbol") || "AAPL"
  const symbols = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 40)

  const out = []
  for (const sym of symbols) {
    const key = "world:" + sym.toUpperCase()
    const cached = await cacheGet(env, key)
    if (cached) {
      out.push(cached)
      continue
    }
    try {
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        sym
      )}?range=1d&interval=1d`
      const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } })
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      if (!res) {
        out.push({ symbol: sym, error: "no data" })
        continue
      }
      const meta = res.meta
      const price = meta.regularMarketPrice
      const prev = meta.chartPreviousClose ?? meta.previousClose
      const chg = price - prev
      const chgPct = prev ? (chg / prev) * 100 : 0
      const item = {
        symbol: meta.symbol || sym,
        name: meta.longName || meta.shortName || sym,
        currency: meta.currency || "USD",
        price,
        prevClose: prev,
        chg,
        chgPct,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
      }
      await cachePut(env, key, item, 60)
      out.push(item)
    } catch (e) {
      out.push({ symbol: sym, error: String(e).slice(0, 80) })
    }
  }
  return json(out)
}
