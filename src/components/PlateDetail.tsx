import { useEffect, useState } from "react"
import { fetchPlate, getPlateCache, prefetchPlate } from "../api"
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
  const cache = getPlateCache(code)
  const [plate, setPlate] = useState<any>(cache || null)
  const [loading, setLoading] = useState(!cache)
  const [drill, setDrill] = useState<{ code: string; name: string } | null>(null)
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)

  // 挂载后下一帧触发滑入（避免初始即打开态无过渡）
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  // 主板块加载：缓存命中则零延迟渲染
  useEffect(() => {
    if (cache) {
      setPlate(cache)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    fetchPlate(code)
      .then((p) => {
        if (!alive) return
        setPlate(p)
        setLoading(false)
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const target = drill || { code, name }

  // 钻取子板块：缓存优先
  const openSon = (s: any) => {
    setDrill({ code: s.code, name: s.name })
    const c = getPlateCache(s.code)
    if (c) {
      setPlate(c)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlate(s.code)
      .then((p) => {
        setPlate(p)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const overlayOpacity = entered && !closing ? "opacity-100" : "opacity-0"
  const panelTransform = entered && !closing ? "translate-x-0" : "translate-x-full"

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-50 flex justify-end transition-opacity duration-200 ${overlayOpacity}`}
      onClick={close}
    >
      <div
        className={`w-full max-w-md bg-panel h-full overflow-y-auto no-scrollbar p-4 transition-transform duration-200 ease-out ${panelTransform}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-ink">{target.name}</h2>
          <button onClick={close} className="text-sub text-2xl leading-none">
            ×
          </button>
        </div>

        {loading ? (
          <Skeleton />
        ) : plate ? (
          <div className="animate-fadein">
            <div className="mb-4">
              <h3 className="text-sm text-sub mb-2">板块K线（近130日）</h3>
              <Kline data={plate.kline} />
            </div>

            <div>
              <h3 className="text-sm text-sub mb-2">
                细分概念（{plate.sons?.length ?? 0}）
              </h3>
              <div className="space-y-1">
                {plate.sons?.map((s: any) => (
                  <button
                    key={s.code}
                    onClick={() => openSon(s)}
                    onMouseEnter={() => prefetchPlate(s.code)}
                    className="w-full flex justify-between text-sm border-b border-edge py-1.5 hover:text-blue"
                  >
                    <span>{s.name}</span>
                    <span className="text-sub">{s.strength}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sub text-sm">暂无数据</div>
        )}

        <DrillQuotesHint />
      </div>
    </div>
  )
}

// 加载骨架：尺寸贴近真实内容，避免数据到达时布局跳动
function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-24 bg-edge rounded" />
      <div className="h-32 bg-edge rounded-lg" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-5 bg-edge rounded w-full" />
        ))}
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
