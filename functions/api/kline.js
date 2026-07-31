// 个股日K代理：东方财富 push2his 为主源，新浪为兜底（均公开接口，CF 可直接代理）
// 用法：/api/kline?code=sh600519  或  /api/kline?code=600519&market=1
// 返回 { code, name, market, klines:[{date,o,c,h,l,v,amount,chgPct}] }（近120交易日，不复权）
import { cacheGet, cachePut, json, safeJson } from "./_lib.js"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

// 把开盘啦/腾讯式纯数字代码 + 市场推断成 secid
function secidOf(code, market) {
  let m = market
  let c = code
  if (/^sh/i.test(c)) { m = 1; c = c.slice(2) }
  else if (/^sz/i.test(c)) { m = 0; c = c.slice(2) }
  else if (/^bj/i.test(c)) { m = 0; c = c.slice(2) }
  else if (m == null) m = c.startsWith("6") ? 1 : 0
  return { m, c }
}

// 主源：东方财富日K
async function tryEastmoney(secid, code, m) {
  const u =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58` +
    `&klt=101&fqt=0&beg=0&end=20500101&lmt=120`
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA } })
    const j = await safeJson(r)
    const d = j?.data
    if (!d || !d.klines || !d.klines.length) return null
    const klines = d.klines.map((s) => {
      const p = s.split(",")
      return {
        date: p[0], o: +p[1], c: +p[2], h: +p[3], l: +p[4],
        v: +p[5], amount: +p[6], chgPct: +p[7],
      }
    })
    return { code: d.code || code, name: d.name, market: d.market ?? m, klines }
  } catch {
    return null
  }
}

// 兜底：新浪日K（A股 sh/sz/bj + 港股 hk；美股权重低，个股详情以 A股为主）
async function trySina(code, m) {
  let sym
  if (m === 1) sym = "sh" + code
  else if (m === 0) sym = code.startsWith("8") || code.startsWith("4") ? "bj" + code : "sz" + code
  else sym = "hk" + code
  const u =
    `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData` +
    `?symbol=${sym}&scale=240&ma=no&datalen=120`
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": UA, Referer: "https://finance.sina.com.cn/" },
    })
    const j = await safeJson(r)
    if (!Array.isArray(j) || !j.length) return null
    const klines = j.map((d, i, a) => {
      const c = +d.close
      const prev = i > 0 ? +a[i - 1].close : c
      return {
        date: d.day, o: +d.open, c, h: +d.high, l: +d.low,
        v: +d.volume, amount: 0,
        chgPct: prev ? ((c - prev) / prev) * 100 : 0,
      }
    })
    return { code, name: code, market: m, klines }
  } catch {
    return null
  }
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  const code0 = (url.searchParams.get("code") || "").trim()
  const market0 = url.searchParams.get("market")
  const market = market0 != null && market0 !== "" ? parseInt(market0, 10) : null
  const { m, c } = secidOf(code0, market)
  const secid = `${m}.${c}`
  const key = "kline:" + secid

  const cached = await cacheGet(env, key)
  if (cached) return json(cached)

  let out = await tryEastmoney(secid, c, m)
  if (!out) out = await trySina(c, m)

  if (!out) {
    return json({ code: c, error: "K线获取失败（东财/新浪均不可用，可能上游风控）" })
  }
  await cachePut(env, key, out, 60)
  return json(out)
}
