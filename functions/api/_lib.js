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

export async function cacheGet(env, key) {
  if (env && env.KPL_CACHE) {
    const v = await env.KPL_CACHE.get(key)
    return v ? JSON.parse(v) : null
  }
  return null
}

export async function cachePut(env, key, val, t) {
  if (env && env.KPL_CACHE && val != null) {
    try {
      await env.KPL_CACHE.put(key, JSON.stringify(val), { expirationTtl: t })
    } catch (e) {
      // 缓存失败不影响主流程
    }
  }
}

// 安全读取响应体文本（容错：网络异常返回空串）
export async function safeText(resp) {
  try {
    return await resp.text()
  } catch {
    return ""
  }
}

// 安全解析 JSON：任何非 200 / 非 JSON 的响应都不会抛错，而是返回带标记的对象。
// 这是修复「SyntaxError: Unexpected token ... 520 ... is not valid JSON」的核心：
// 上游(开盘啦/东财/新浪等)在 CF 边缘被风控时可能返回 520 的 HTML/纯文本，
// 直接 resp.json() 会抛错并导致整个路由崩溃、前端拿到非 JSON 进而页面卡死。
export async function safeJson(resp) {
  if (!resp || !resp.ok) {
    return { __upstreamError: (resp && resp.status) || "no-response" }
  }
  const t = await safeText(resp)
  try {
    return JSON.parse(t)
  } catch {
    // 把前 200 字符回带，便于排查到底是什么被返回了（如 "error code: 520"）
    return { __parseError: t.slice(0, 200) }
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
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
    })
    const data = await safeJson(resp)
    // 非 200 / 解析失败 / 空对象 -> 视为上游异常，返回结构化错误（不缓存、不抛错）
    if (data?.__upstreamError || data?.__parseError || !data || !Object.keys(data).length) {
      return { error: "上游返回异常(可能触发风控/限流)" }
    }
    // 有效 JSON 但列表为空（如开盘啦涨停榜尚未出数）-> 短缓存，便于数据源补齐后及时切回
    if (Array.isArray(data.list) && data.list.length === 0) {
      await cachePut(env, cacheKey, data, 60)
      return data
    }
    await cachePut(env, cacheKey, data, ttlSec)
    return data
  } catch (e) {
    // fetch 本身抛错（边缘连不上上游）也兜底，不向上抛
    return { error: String(e).slice(0, 120) }
  }
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
  try {
    const resp = await fetch(url, { method: "GET", headers })
    const data = await safeJson(resp)
    if (data?.__upstreamError || data?.__parseError || !data || !Object.keys(data).length) {
      return { error: "上游返回异常(可能触发风控/限流)" }
    }
    await cachePut(env, cacheKey, data, ttlSec)
    return data
  } catch (e) {
    return { error: String(e).slice(0, 120) }
  }
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
