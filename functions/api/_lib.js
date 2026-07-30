// 共享模块：开盘啦/腾讯接口代理 + KV 缓存 + 交易时段判断
// 文件名以 _ 开头 -> Pages Functions 视为私有模块，不会暴露为路由

const UA_KPL = "lhb/5.17.9 (com.kaipanla.www; build:0; iOS 16.6.0) Alamofire/4.9.1"

export const HOSTS = {
  HQ: "apphq.longhuvip.com", // 实时榜单
  HIS: "apphis.longhuvip.com", // 历史/K线
  SON: "apphwshhq.longhuvip.com", // 子板块
  ZT: "apphwhq.longhuvip.com", // 涨停原因题材
}

// 中国时区最近交易日（Workers 内部是 UTC，需手动 +8）
// 交易时段内用当天；盘后(≥15:00)用当天；盘前/周末回退到最近工作日
export function cnDate() {
  const d = new Date()
  const sh = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000)
  const h = sh.getUTCHours()
  const m = sh.getUTCMinutes()
  const t = h * 60 + m
  const wd = sh.getUTCDay()

  // 周末或盘前 → 回退到最近交易日
  const needRollback = wd === 0 || wd === 6 || t < 555
  // 盘后(≥15:00 工作日)数据已出，不需要回退
  if (!needRollback) return sh.toISOString().slice(0, 10)

  // 往前找最近一个工作日（跳过周六日）
  sh.setUTCDate(sh.getUTCDate() - 1)
  while (sh.getUTCDay() === 0 || sh.getUTCDay() === 6) {
    sh.setUTCDate(sh.getUTCDate() - 1)
  }
  return sh.toISOString().slice(0, 10)
}

// 是否在交易时段（9:15-11:30 / 13:00-15:00，工作日）
export function isTradingTime() {
  const d = new Date()
  const sh = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000)
  const h = sh.getUTCHours()
  const m = sh.getUTCMinutes()
  const wd = sh.getUTCDay()
  if (wd === 0 || wd === 6) return false
  const t = h * 60 + m
  return (t >= 555 && t <= 690) || (t >= 780 && t <= 900)
}

// 缓存 TTL：盘中 30s（边缘节点就近返回，降低上游压力），非盘中 1h
export function ttl() {
  return isTradingTime() ? 30 : 3600
}

async function cacheGet(env, key) {
  if (env && env.KPL_CACHE) {
    const v = await env.KPL_CACHE.get(key)
    return v ? JSON.parse(v) : null
  }
  return null
}

async function cachePut(env, key, val, t) {
  if (env && env.KPL_CACHE && val != null) {
    try {
      await env.KPL_CACHE.put(key, JSON.stringify(val), { expirationTtl: t })
    } catch (e) {
      // 缓存失败不影响主流程
    }
  }
}

export async function proxyPost(env, host, path, body, cacheKey, ttlSec, ua = UA_KPL) {
  const cached = await cacheGet(env, cacheKey)
  if (cached) return cached
  const url = `https://${host}${path}`
  const headers = {
    Host: host,
    "User-Agent": ua,
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  })
  const data = await resp.json()
  if (data && Object.keys(data).length) await cachePut(env, cacheKey, data, ttlSec)
  return data
}

export async function proxyGet(env, host, path, params, cacheKey, ttlSec, ua = UA_KPL) {
  const cached = await cacheGet(env, cacheKey)
  if (cached) return cached
  const url = `https://${host}${path}?${new URLSearchParams(params).toString()}`
  const headers = {
    Host: host,
    "User-Agent": ua,
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
  const resp = await fetch(url, { method: "GET", headers })
  const data = await resp.json()
  if (data && Object.keys(data).length) await cachePut(env, cacheKey, data, ttlSec)
  return data
}

export function json(data, extra = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...extra,
    },
  })
}
