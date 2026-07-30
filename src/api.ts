// 前端 API 封装：全部走同源 /api（由 CF Pages Functions 代理，解决 CORS + 边缘缓存）

export async function fetchConcept(type = "7", topn = 60): Promise<any[]> {
  const r = await fetch(`/api/concept?type=${type}&topn=${topn}`)
  return r.json()
}

export async function fetchZt(): Promise<any> {
  const r = await fetch(`/api/zt`)
  return r.json()
}

export async function fetchQuote(codes: string[]): Promise<Record<string, any>> {
  if (!codes.length) return {}
  const r = await fetch(`/api/quote?codes=${codes.join(",")}`)
  return r.json()
}

export async function fetchPlate(code: string): Promise<any> {
  const r = await fetch(`/api/plate?code=${code}`)
  return r.json()
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

// 国际行情（Yahoo Finance，经 CF 代理批量拉取）
export async function fetchWorld(symbols: string[]): Promise<any[]> {
  if (!symbols.length) return []
  const r = await fetch(`/api/world?symbols=${symbols.join(",")}`)
  return r.json()
}

// 个股日K（东方财富，经 CF 代理）
export async function fetchKline(code: string, market?: number): Promise<any> {
  const r = await fetch(
    `/api/kline?code=${encodeURIComponent(code)}${market != null ? `&market=${market}` : ""}`
  )
  return r.json()
}

// 从代码推市场（沪1/深0，用于东方财富 secid）
export function marketOf(code: string): number {
  if (/^sh/i.test(code)) return 1
  if (/^sz/i.test(code)) return 0
  if (/^bj/i.test(code)) return 0
  return code.replace(/[^0-9]/g, "").startsWith("6") ? 1 : 0
}
