import { useEffect, useState } from "react"
import { fetchPlate } from "../api"
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
          <button onClick={onClose} className="text-sub text-2xl leading-none">
            ×
          </button>
        </div>

        {loading && <div className="text-sub">加载中…</div>}

        {plate && (
          <>
            <div className="mb-4">
              <h3 className="text-sm text-sub mb-2">板块K线（近130日）</h3>
              <Kline data={plate.kline} />
            </div>

            <div>
              <h3 className="text-sm text-sub mb-2">
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
                    className="w-full flex justify-between text-sm border-b border-edge py-1.5 hover:text-blue"
                  >
                    <span>{s.name}</span>
                    <span className="text-sub">{s.strength}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <DrillQuotesHint />
      </div>
    </div>
  )
}

// 开盘啦概念板块不提供个股成分股列表，成分股实时行情请在「涨停原因题材榜」展开查看。
function DrillQuotesHint() {
  return (
    <div className="mt-4 text-xs text-sub border-t border-edge pt-3">
      提示：概念板块成分股实时行情可在右侧「涨停原因题材榜」点开题材查看。
    </div>
  )
}
