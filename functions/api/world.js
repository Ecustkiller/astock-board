// 国际行情代理：东方财富全球行情 push2（公开接口，CF 可直接代理）
// 注：原 Yahoo Finance v8 在 CF 边缘/中国网络下会被拦截返回 HTML 同意页，
//     无法解析为 JSON，已弃用。东财全球行情涵盖 美股(105.)/港股(116.)/指数(100.)。
// 用法：/api/world?symbols=AAPL,TSLA,116.00700  或  /api/world?symbol=^GSPC
import { cacheGet, cachePut, json, safeJson } from "./_lib.js"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

// 把前端传入的符号映射成东财 secid；无法识别返回 null
function toSecid(sym) {
  sym = sym.trim()
  if (/\.HK$/i.test(sym)) {
    const c = sym.replace(/\.hk$/i, "").padStart(5, "0")
    return "116." + c
  }
  if (sym.startsWith("^")) {
    const map = {
      IXIC: "100.NDX", // 纳斯达克（东财无 IXIC，用 NDX 替代）
      GSPC: "100.SPX", // 标普500
      SPX: "100.SPX",
      NDX: "100.NDX",
      DJI: "100.DJIA", // 道琼斯（东财可能无数据，前端优雅降级）
      VIX: "100.VIX", // 恐慌指数（东财可能无数据）
    }
    return map[sym.slice(1).toUpperCase()] || null
  }
  // 默认按美股处理
  return "105." + sym.toUpperCase()
}

// 把东财 f 字段（价格单位为 1/1000）解析成统一结构
function parseItem(d, sym) {
  if (!d || d.f43 == null) return null
  const div = 1000
  const price = d.f43 / div
  const prev = d.f60 / div
  return {
    symbol: sym,
    name: d.f58 || sym,
    currency: /\.HK$/i.test(sym) || sym.startsWith("116") ? "HKD" : "USD",
    price,
    prevClose: prev,
    chg: d.f169 / div,
    chgPct: d.f170 / 100,
    high: d.f44 / div,
    low: d.f45 / div,
    open: d.f46 / div,
    volume: d.f47,
    amount: d.f48,
  }
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  const raw = url.searchParams.get("symbols") || url.searchParams.get("symbol") || "AAPL"
  const symbols = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 40)

  const out = []
  for (const sym of symbols) {
    const secid = toSecid(sym)
    const key = "world:" + sym.toUpperCase()
    const cached = await cacheGet(env, key)
    if (cached) {
      out.push(cached)
      continue
    }
    if (!secid) {
      out.push({ symbol: sym, error: "不支持的代码" })
      continue
    }
    try {
      const u =
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}` +
        `&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170,f47,f48,f86`
      const r = await fetch(u, {
        headers: { "User-Agent": UA, Referer: "https://quote.eastmoney.com/" },
      })
      const j = await safeJson(r)
      const d = j?.data
      const item = d ? parseItem(d, sym) : null
      if (!item) {
        out.push({ symbol: sym, error: "无数据(可能该代码东财未收录)" })
        continue
      }
      await cachePut(env, key, item, 60)
      out.push(item)
    } catch (e) {
      out.push({ symbol: sym, error: String(e).slice(0, 80) })
    }
  }
  return json(out)
}
