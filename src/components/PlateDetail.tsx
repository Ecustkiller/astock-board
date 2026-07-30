import { useEffect, useState } from "react"
import { fetchPlate, fetchQuote, pct, chgColor } from "../api"
import Kline from "./Kline"

// 板块钻取：板块整体K线 + 细分概念列表（点击细分概念继续钻取）
export default function PlateDetail({
  code,
  name,
  onClose,
}: {
  code: string
  name: string
  onClose: () => void
}) {
  const [plate, setPlate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState<{ code: string; name: string } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchPlate(code).then((p) => {
      if (!alive) return
      setPlate(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [code])

  const target = drill || { code, name }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-panel h-full overflow-y-auto no-scrollbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{target.name}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">
            ×
          </button>
        </div>

        {loading && <div className="text-gray-500">加载中…</div>}

        {plate && (
          <>
            <div className="mb-4">
              <h3 className="text-sm text-gray-400 mb-2">板块K线（近130日）</h3>
              <Kline data={plate.kline} />
            </div>

            <div>
              <h3 className="text-sm text-gray-400 mb-2">
                细分概念（{plate.sons.length}）
              </h3>
              <div className="space-y-1">
                {plate.sons.map((s: any) => (
                  <button
                    key={s.code}
                    onClick={() => {
                      setDrill({ code: s.code, name: s.name })
                      setLoading(true)
                      fetchPlate(s.code).then((p) => {
                        setPlate(p)
                        setLoading(false)
                      })
                    }}
                    className="w-full flex justify-between text-sm border-b border-edge py-1.5 hover:text-blue-400"
                  >
                    <span>{s.name}</span>
                    <span className="text-gray-500">{s.strength}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <DrillQuotes code={target.code} />
      </div>
    </div>
  )
}

// 细分概念成分股实时行情（开盘啦子板块StockList在 plate.sons 不含成分股，这里用涨停原因题材榜的个股兜底）
function DrillQuotes({ code }: { code: string }) {
  const [stocks, setStocks] = useState<any[]>([])
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  useEffect(() => {
    // 子板块成分股需另接口；此处通过 /api/zt 全局个股无法精确归属，留作扩展点
    setStocks([])
    setQuotes({})
  }, [code])
  if (!stocks.length) return null
  return (
    <div className="mt-4">
      <h3 className="text-sm text-gray-400 mb-2">成分股</h3>
      {stocks.map((s) => (
        <div key={s[0]} className="flex justify-between text-sm py-1">
          <span>{s[1]}</span>
          <span className={chgColor(quotes[s[0]]?.chg ?? 0)}>
            {pct(quotes[s[0]]?.chg ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}
