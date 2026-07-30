// 个股日K代理：东方财富 push2his（公开接口，CF 可直接代理）
// 用法：/api/kline?code=sh600519  或  /api/kline?code=600519&market=1
// 返回 { code, name, market, klines:[{date,o,c,h,l,v,amount,chgPct}] }（近120交易日，不复权）
import { cacheGet, cachePut, json } from "./_lib.js"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  let code = (url.searchParams.get("code") || "").trim()
  let market = url.searchParams.get("market")

  let m
  if (market != null && market !== "") {
    m = parseInt(market, 10)
  } else if (/^sh/i.test(code)) {
    m = 1
    code = code.slice(2)
  } else if (/^sz/i.test(code)) {
    m = 0
    code = code.slice(2)
  } else if (/^bj/i.test(code)) {
    m = 0 // 北交所近似按深市 secid（东财北交 secid 以 0. 起）
    code = code.slice(2)
  } else {
    m = code.startsWith("6") ? 1 : 0 // 沪市6开头，其余按深市
  }
  const secid = `${m}.${code}`
  const key = "kline:" + secid

  const cached = await cacheGet(env, key)
  if (cached) return json(cached)

  const api =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58` +
    `&klt=101&fqt=0&beg=0&end=20500101&lmt=120`
  try {
    const r = await fetch(api, { headers: { "User-Agent": UA } })
    const j = await r.json()
    const d = j?.data
    if (!d || !d.klines || !d.klines.length) return json({ code, error: "no kline" })
    const klines = d.klines.map((s) => {
      const p = s.split(",")
      return {
        date: p[0],
        o: +p[1],
        c: +p[2],
        h: +p[3],
        l: +p[4],
        v: +p[5],
        amount: +p[6],
        chgPct: +p[7],
      }
    })
    const out = { code: d.code || code, name: d.name, market: d.market ?? m, klines }
    await cachePut(env, key, out, 60)
    return json(out)
  } catch (e) {
    return json({ code, error: String(e).slice(0, 80) })
  }
}
