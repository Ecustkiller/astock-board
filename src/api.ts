// 前端 API 封装：全部走同源 /api（由 CF Pages Functions 代理，解决 CORS + 边缘缓存）

// 安全 fetch：任何非 200 / 非 JSON 的响应都返回 { error } 对象，绝不抛错。
// 这是修复「页面卡死/不更新」的关键：之前 r.json() 在拿到 520 的 HTML 时抛
// SyntaxError，被上层吞掉后导致状态不刷新、页面看起来“没更新”。
async function fetchJson(path: string): Promise<any> {
  try {
    const r = await fetch(path)
    if (!r.ok) return { error: `HTTP ${r.status}` }
    const t = await r.text()
    try {
      return JSON.parse(t)
    } catch {
      return { error: "返回非JSON(上游异常)" }
    }
  } catch (e) {
    return { error: String(e).slice(0, 120) }
  }
}

export async function fetchConcept(type = "7", topn = 60): Promise<any[]> {
  const d = await fetchJson(`/api/concept?type=${type}&topn=${topn}`)
  return Array.isArray(d) ? d : d.error ? (d as any) : []
}

export async function fetchZt(): Promise<any> {
  return fetchJson(`/api/zt`)
}

export async function fetchQuote(codes: string[]): Promise<Record<string, any>> {
  if (!codes.length) return {}
  const d = await fetchJson(`/api/quote?codes=${codes.join(",")}`)
  return d && !d.error ? d : {}
}

export async function fetchPlate(code: string): Promise<any> {
  return fetchJson(`/api/plate?code=${code}`)
}

// ---- 前端内存缓存 + 预拉取：点击题材钻取时避免明显刷新停顿 ----
// 题材榜加载后静默预热「全部」题材的板块详情（分批并发，避免一次性几十个请求打爆上游），
// 命中后点击任意题材都直接读内存缓存、零延迟，不再有临时拉取造成的"刷新感"。
const plateCache = new Map<string, any>()
const PREFETCH_POOL = 6 // 每批并发数，平衡速度与上游压力

export function getPlateCache(code: string): any | undefined {
  return plateCache.get(code)
}

async function storePlate(code: string): Promise<void> {
  if (!code || plateCache.has(code)) return
  try {
    const d = await fetchPlate(code)
    if (d && !d.error) plateCache.set(code, d)
  } catch {
    /* 预拉取失败（上游/网络）不影响主流程 */
  }
}

// 后台分批并发预热全部题材：点击任意一个都直接命中内存缓存，无刷新停顿
export async function prefetchPlates(codes: string[]): Promise<void> {
  const targets = (codes || []).filter(Boolean)
  for (let i = 0; i < targets.length; i += PREFETCH_POOL) {
    const batch = targets.slice(i, i + PREFETCH_POOL)
    await Promise.all(batch.map((c) => storePlate(c)))
  }
}

// 卡片悬停/点击前即时补缓存单个题材（不阻塞交互，作为兜底）
export async function prefetchPlate(code: string): Promise<void> {
  void storePlate(code)
}

// 涨跌幅格式化：本项目所有 chg 源（开盘啦概念/涨停、腾讯行情 f[32]）均为「百分比数值」，
// 直接格式化即可，切勿再 ×100（否则指数 -0.62% 会被算成 -62%）。
export function pct(chg: number): string {
  if (chg == null || isNaN(chg)) return "—"
  return (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%"
}

export function chgColor(chg: number): string {
  if (chg == null || isNaN(chg)) return "text-sub"
  return chg >= 0 ? "text-up" : "text-down"
}

// 国际行情（东方财富全球行情，经 CF 代理批量拉取）
export async function fetchWorld(symbols: string[]): Promise<any[]> {
  if (!symbols.length) return []
  const d = await fetchJson(`/api/world?symbols=${symbols.join(",")}`)
  return Array.isArray(d) ? d : []
}

// 个股日K（东方财富为主 + 新浪兜底，经 CF 代理）
export async function fetchKline(code: string, market?: number): Promise<any> {
  return fetchJson(
    `/api/kline?code=${encodeURIComponent(code)}${market != null ? `&market=${market}` : ""}`
  )
}

// 从代码推市场（沪1/深0，用于东方财富 secid）
export function marketOf(code: string): number {
  if (/^sh/i.test(code)) return 1
  if (/^sz/i.test(code)) return 0
  if (/^bj/i.test(code)) return 0
  return code.replace(/[^0-9]/g, "").startsWith("6") ? 1 : 0
}
