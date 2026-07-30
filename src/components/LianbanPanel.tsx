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
    <div className="space-y-4">
      <div className="text-xs text-sub">
        连板梯队 · 按连板天数排列 · 点击个股复制代码
      </div>

      {boards.length ? (
        <div className="relative pl-5">
          {/* 一根蓝色竖线贯穿整列 */}
          <div className="absolute left-[27px] top-2 bottom-2 w-[2px] bg-blue/30 rounded-full" />
          {boards.map((b) => (
            <div key={b} className="relative flex gap-3 pb-5 last:pb-0">
              {/* 节点：蓝色实心圆点 + 背景色外圈（挖空感） */}
              <div className="relative z-10 mt-1 w-4 h-4 rounded-full bg-blue ring-4 ring-[color:var(--bg)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[15px] text-ink">{b === 1 ? "首板" : `${b}连板`}</span>
                  <span className="text-[12px] text-sub">{byBoard[b].length} 只</span>
                </div>
                <div className="text-[14px] leading-[1.7] text-ink">
                  {byBoard[b].map((s: any, i: number) => {
                    const q = quotes[s[0]]
                    return (
                      <span key={i}>
                        {i > 0 && <span className="text-sub"> / </span>}
                        <button
                          onClick={() => navigator.clipboard?.writeText(s[0])}
                          className="hover:text-blue transition-colors"
                          title={`${s[1]} ${s[0]}`}
                        >
                          {s[1]}
                          {q ? (
                            <span className={`ml-0.5 ${chgColor(q.chg)}`}>{pct(q.chg)}</span>
                          ) : s[16] ? (
                            <span className="text-sub text-[12px] ml-0.5">{s[16]}</span>
                          ) : null}
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sub text-sm p-4">暂无连板数据（非交易时段可能为空）</div>
      )}
    </div>
  )
}
