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
