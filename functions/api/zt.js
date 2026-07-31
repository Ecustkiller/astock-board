// GET /api/zt?day=YYYY-MM-DD
// 涨停/跌停数据：主源=开盘啦涨停原因题材榜；为空时兜底=东财涨停/跌停板池
import { proxyPost, json, ttl, HOSTS, cnDate } from "./_lib.js"

const EM_HOST = "push2.eastmoney.com"
// 模块级缓存（兜底源，避免每次都打东财）
const _mc = new Map()
function mcGet(k) {
  const v = _mc.get(k)
  if (!v) return null
  if (v.exp > Date.now()) return v.val
  _mc.delete(k)
  return null
}
function mcPut(k, val, sec) {
  _mc.set(k, { val, exp: Date.now() + sec * 1000 })
}

async function emGet(fs, key) {
  const cached = mcGet(key)
  if (cached) return cached
  const url =
    `https://${EM_HOST}/api/qt/clist/get?pn=1&pz=300&po=1&np=1&fltt=2&invt=2` +
    `&fid=f3&fs=${encodeURIComponent(fs)}&fields=f12,f14,f2,f3`
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
    })
    const t = await r.text()
    const j = JSON.parse(t)
    const diff = (j && j.data && j.data.diff) || []
    const total = (j && j.data && j.data.total) || 0
    const val = {
      total,
      list: diff.map((d) => [d.f12, d.f14, +(d.f3 || 0)]),
    }
    mcPut(key, val, 60)
    return val
  } catch {
    return { total: 0, list: [] }
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
    "lhb/5.17.9 (com.kaipanla.www; build:0; iOS 16.6.0) Alamofire/4.9.1"
  )
  if (kpl && !kpl.error && Array.isArray(kpl.list) && kpl.list.length) {
    kpl._v = "v3-min"
    return json(kpl)
  }

  // 2) 兜底：东财涨停板 + 跌停板（开盘啦未出数时保证面板有数据）
  const [up, dn] = await Promise.all([
    emGet("m:1+t:1+f:!2,m:0+t:1+f:!2", `zt-em-up:${day}`),
    emGet("m:1+t:2+f:!2,m:0+t:2+f:!2", `zt-em-dn:${day}`),
  ])
  const upList = up.list.map((s) => [
    s[0], s[1], 0, "", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    `${s[2] > 0 ? "+" : ""}${s[2]}%`,
  ])
  const out = {
    list: [{ ZSName: `涨停个股（东财·共 ${up.total} 只）`, StockList: upList }],
    nums: { ZT: up.total, DT: dn.total, ZBL: "—" },
    source: "eastmoney",
    date: day,
  }
  return json(out)
}
