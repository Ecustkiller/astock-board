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

// 涨跌幅格式化：开盘啦/腾讯返回的数值，<1 视为小数比例需×100
export function pct(chg: number): string {
  if (chg == null || isNaN(chg)) return "—"
  const v = Math.abs(chg) < 1 ? chg * 100 : chg
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"
}

export function chgColor(chg: number): string {
  if (chg == null || isNaN(chg)) return "text-gray-400"
  return chg >= 0 ? "text-up" : "text-down"
}
