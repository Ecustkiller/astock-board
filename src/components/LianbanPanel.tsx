import { useState, useEffect } from "react"
import { fetchQuote, pct, chgColor } from "../api"

// 解析连板字段：'4连板'->4，'5天4板'->4(取板数)，'首板'->1
function parseBoard(s: any): number {
  if (!s) return 1
  const str = String(s)
  if (str.includes("首板")) return 1
  const m1 = str.match(/(\d+)连板/)
  if (m1) return parseInt(m1[1], 10)
  const m2 = str.match(/(\d+)天(\d+)板/)
  if (m2) return parseInt(m2[2], 10)
  const m3 = str.match(/\d+/)
  return m3 ? parseInt(m3[0], 10) : 1
}

export default function LianbanPanel({ data }: { data: any }) {
  const [quotes, setQuotes] = useState<Record<string, any>>({})

  const all = data?.list ? data.list.flatMap((t: any) => t.StockList || []) : []
  const byBoard: Record<number, any[]> = {}
  for (const s of all) {
    const bd = parseBoard(s[9])
    ;(byBoard[bd] = byBoard[bd] || []).push(s)
  }
  const boards = Object.keys(byBoard).map(Number).sort((a, b) => b - a)

  // 连板个股可能很多，按 30 只/批拉实时行情，避免 URL 超长
  useEffect(() => {
    const codes = all.map((s: any) => s[0]).filter(Boolean)
    if (!codes.length) return
    let cancelled = false
    const run = async () => {
      const merged: Record<string, any> = {}
      for (let i = 0; i < codes.length; i += 30) {
        try {
          const d = await fetchQuote(codes.slice(i, i + 30))
          Object.assign(merged, d)
        } catch {
          /* 单批失败不影响其余 */
        }
      }
      if (!cancelled) setQuotes(merged)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [data])

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        连板梯队按连板天数分组 · 显示实时涨跌（腾讯行情）· 点击个股复制代码
      </div>
      {boards.map((b) => (
        <div key={b} className="rounded-lg border border-edge bg-panel p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-400 font-bold text-sm w-16">
              {b === 1 ? "首板" : `${b}连板`}
            </span>
            <span className="text-gray-500 text-xs">{byBoard[b].length} 只</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {byBoard[b].map((s: any, i: number) => {
              const q = quotes[s[0]]
              return (
                <button
                  key={i}
                  onClick={() => navigator.clipboard?.writeText(s[0])}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-panel2 border border-edge text-xs hover:border-blue-500"
                  title={`${s[1]} ${s[0]}`}
                >
                  <span className="text-gray-200">{s[1]}</span>
                  {q ? (
                    <span className={chgColor(q.chg)}>{pct(q.chg)}</span>
                  ) : (
                    <span className="text-gray-600">{s[16] || ""}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {!boards.length && (
        <div className="text-gray-600 text-sm p-4">暂无连板数据（非交易时段可能为空）</div>
      )}
    </div>
  )
}
