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
const plateCache = new Map<string, any>()

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

// 题材榜加载后静默预热前 limit 个题材的板块详情，命中后点击零延迟
export async function prefetchPlates(codes: string[], limit = 10): Promise<void> {
  const targets = (codes || []).filter(Boolean).slice(0, limit)
  await Promise.all(targets.map(storePlate))
}

// 卡片悬停时预热单个题材
export async function prefetchPlate(code: string): Promise<void> {
  await storePlate(code)
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
