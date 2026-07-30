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

// 单个涨停题材行：点击展开个股 + 实时行情
function ThemeRow({ theme }: { theme: any }) {
  const [open, setOpen] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  const stocks = theme.StockList || []

  useEffect(() => {
    if (open && !Object.keys(quotes).length) {
      const codes = stocks.map((s: any) => s[0]).filter(Boolean)
      if (codes.length) fetchQuote(codes).then((d) => setQuotes(d))
    }
  }, [open]) // eslint-disable-line

  return (
    <div className="rounded-lg border border-edge bg-panel">
      <button
        className="w-full text-left p-2 flex justify-between items-center"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-sm">{theme.ZSName}</span>
        <span className="text-up text-sm">
          {stocks.length} 只 {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {stocks.slice(0, 20).map((s: any, i: number) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-300">
                {s[1]} <span className="text-gray-600">{s[0]}</span>
              </span>
              <span className={chgColor(quotes[s[0]]?.chg ?? 0)}>
                {quotes[s[0]] ? pct(quotes[s[0]].chg) : "—"}
                {s[16] ? ` · ${s[16]}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ZtPanel({ data }: { data: any }) {
  if (!data || !data.list)
    return (
      <div className="text-gray-500 text-sm p-4">
        暂无涨停数据（非交易时段可能为空）
      </div>
    )

  const nums = data.nums || {}
  const themes = [...data.list].sort(
    (a, b) => (b.StockList?.length || 0) - (a.StockList?.length || 0)
  )
  const all = data.list.flatMap((t: any) => t.StockList || [])
  const byBoard: Record<number, string[]> = {}
  for (const s of all) {
    const bd = parseBoard(s[9])
    ;(byBoard[bd] = byBoard[bd] || []).push(s[1])
  }
  const boards = Object.keys(byBoard)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <span>
          涨停 <b className="text-up">{nums.ZT ?? 0}</b>
        </span>
        <span>
          跌停 <b className="text-down">{nums.DT ?? 0}</b>
        </span>
        <span>
          涨跌比 <b className="text-gray-300">{nums.ZBL ?? "—"}</b>
        </span>
      </div>

      <div>
        <h3 className="text-sm text-gray-400 mb-2">
          涨停原因题材榜（点击展开个股行情）
        </h3>
        <div className="space-y-2">
          {themes.slice(0, 25).map((t: any, i: number) => (
            <ThemeRow key={i} theme={t} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm text-gray-400 mb-2">连板梯队</h3>
        <div className="space-y-1">
          {boards.map((b) => (
            <div key={b} className="flex gap-2 text-sm">
              <span className="text-orange-400 whitespace-nowrap w-14">
                {b === 1 ? "首板" : `${b}连板`}
              </span>
              <span className="text-gray-300 truncate">
                {(byBoard[b] || []).join("、")}
              </span>
            </div>
          ))}
          {!boards.length && (
            <div className="text-gray-600 text-xs">暂无连板数据</div>
          )}
        </div>
      </div>
    </div>
  )
}
