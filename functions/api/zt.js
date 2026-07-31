// GET /api/zt?day=YYYY-MM-DD
// 涨停/跌停数据：
//   主源 = 开盘啦 DailyLimitResumption（涨停原因题材榜，含个股+连板）
//   兜底 = 东财涨停板池 / 跌停板池（开盘啦未出数据时保证面板有数据）
import {
  proxyPost,
  json,
  ttl,
  HOSTS,
  cnDate,
  UA_KPL,
  cacheGet,
  cachePut,
  safeJson,
} from "./_lib.js"

const EM_HOST = "push2.eastmoney.com"
const EM_UA = "Mozilla/5.0"
const EM_REF = "https://quote.eastmoney.com/"

// 东财涨停/跌停板池：返回 { total, list:[[code,name,chgPct],...] }
// 涨停板虚拟板块：m:1+t:1 / m:0+t:1 ；跌停板：m:1+t:2 / m:0+t:2
async function emPool(env, fs, key) {
  const url =
    `https://${EM_HOST}/api/qt/clist/get?pn=1&pz=300&po=1&np=1&fltt=2&invt=2` +
    `&fid=f3&fs=${encodeURIComponent(fs)}&fields=f12,f14,f2,f3`
  const cached = await cacheGet(env, key)
  if (cached) return cached
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": EM_UA, Referer: EM_REF },
    })
    const j = await safeJson(r)
    if (j?.__upstreamError || j?.__parseError || !j?.data) return { total: 0, list: [] }
    const total = j.data.total || 0
    const list = (j.data.diff || []).map((d) => [d.f12, d.f14, +(d.f3 || 0)])
    const out = { total, list }
    await cachePut(env, key, out, 60)
    return out
  } catch {
    return { total: 0, list: [] }
  }
}

async function emUpDownCounts(env, key) {
  // 沪深京 上涨/下跌/涨停/跌停 家数（东财综合统计）
  const url = `https://${EM_HOST}/api/qt/ulist.np/get?fltt=2&invt=2&fields=f104,f105,f106,f107,f108,f109,f110,f111,f112,f113`
  const cached = await cacheGet(env, key)
  if (cached) return cached
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": EM_UA, Referer: EM_REF },
    })
    const j = await safeJson(r)
    const d = j?.data
    if (!d) return null
    const out = {
      up: d.f104, // 上涨
      down: d.f105, // 下跌
      flat: d.f106, // 平盘
      zt: d.f107, // 涨停
      dt: d.f108, // 跌停
      lcb: d.f109, // 连板
    }
    await cachePut(env, key, out, 60)
    return out
  } catch {
    return null
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const day = url.searchParams.get("day") || cnDate()

  // 1) 主源：开盘啦 涨停原因题材榜
  const kplBody = {
    a: "GetPlateInfo_w38",
    st: "100",
    c: "DailyLimitResumption",
    PhoneOSNew: "1",
    DeviceID: crypto.randomUUID(),
    VerSion: "5.21.0.2",
    Index: "0",
    apiv: "w42",
    Day: day,
  }
  const kpl = await proxyPost(
    env,
    HOSTS.ZT,
    "/w1/api/index.php",
    kplBody,
    `zt:${day}`,
    ttl(),
    UA_KPL
  )
  if (kpl && !kpl.error && Array.isArray(kpl.list) && kpl.list.length) {
    return json(kpl)
  }

  // 2) 兜底：东财涨停板 + 跌停板
  const [up, dn, counts] = await Promise.all([
    emPool(env, "m:1+t:1+f:!2,m:0+t:1+f:!2", `zt-em-up:${day}`),
    emPool(env, "m:1+t:2+f:!2,m:0+t:2+f:!2", `zt-em-dn:${day}`),
    emUpDownCounts(env, `zt-em-cnt:${day}`),
  ])

  const upList = up.list.map((s) => [s[0], s[1], null, null, null, null, null, null, null, null, null, null, null, null, null, null, `${s[2] > 0 ? "+" : ""}${s[2]}%`])
  const dtCount = counts?.dt ?? dn.total
  const ztCount = counts?.zt ?? up.total
  const zbl =
    counts && counts.up != null && counts.down != null
      ? `${counts.up}/${counts.down}`
      : "—"

  const out = {
    list: [
      {
        ZSName: `涨停个股（东财·共 ${up.total} 只）`,
        StockList: upList,
      },
    ],
    nums: { ZT: ztCount, DT: dtCount, ZBL: zbl },
    source: "eastmoney",
    date: day,
  }
  return json(out)
}
