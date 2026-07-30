import { useEffect, useState, useCallback, useMemo } from "react"
import { fetchConcept, fetchZt, prefetchPlates } from "./api"
import Board from "./components/Board"
import ZtPanel from "./components/ZtPanel"
import LianbanPanel from "./components/LianbanPanel"
import PlateDetail from "./components/PlateDetail"
import IndexTicker from "./components/IndexTicker"
import AnalysisPanel from "./components/AnalysisPanel"

const TYPES = [
  { k: "7", label: "概念" },
  { k: "4", label: "行业" },
  { k: "6", label: "地区" },
]

export default function App() {
  const [view, setView] = useState<"theme" | "lianban" | "analysis">("theme")
  const [zsType, setZsType] = useState("7")
  const [concept, setConcept] = useState<any[]>([])
  const [zt, setZt] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [auto, setAuto] = useState(true)
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"strength" | "chg">("strength")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, z] = await Promise.all([fetchConcept(zsType), fetchZt()])
      setConcept(c)
      setZt(z)
      setLastUpdate(new Date())
      // 题材榜加载后静默预热前 N 个题材钻取详情，点击时零延迟
      prefetchPlates(c.map((x: any) => x.code))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [zsType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => load(), 30000)
    return () => clearInterval(id)
  }, [auto, load])

  const kw = search.trim()
  const displayConcept = useMemo(() => {
    let arr = concept
    if (kw) arr = arr.filter((it) => (it.name || "").includes(kw))
    arr = [...arr].sort((a, b) =>
      sortBy === "chg"
        ? (b.chg ?? 0) - (a.chg ?? 0)
        : (b.strength ?? 0) - (a.strength ?? 0)
    )
    return arr
  }, [concept, kw, sortBy])

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-3 py-4">
      <header className="sticky top-0 backdrop-blur z-10 py-2 -mx-3 px-3 mb-4" style={{ background: "color-mix(in srgb, var(--bg) 90%, transparent)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-lg font-semibold text-ink">A股题材 · 涨停看板</h1>
            <div className="text-xs text-sub">
              {lastUpdate
                ? `更新于 ${lastUpdate.toLocaleTimeString("zh-CN")}`
                : "加载中…"}
              {loading && " · 刷新中"}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-edge">
              <button
                onClick={() => setView("theme")}
                className={`px-3 py-1 text-sm ${
                  view === "theme" ? "bg-blue text-white" : "bg-panel2 text-sub"
                }`}
              >
                题材榜
              </button>
              <button
                onClick={() => setView("lianban")}
                className={`px-3 py-1 text-sm ${
                  view === "lianban" ? "bg-blue text-white" : "bg-panel2 text-sub"
                }`}
              >
                连板梯队
              </button>
              <button
                onClick={() => setView("analysis")}
                className={`px-3 py-1 text-sm ${
                  view === "analysis" ? "bg-blue text-white" : "bg-panel2 text-sub"
                }`}
              >
                题材分析
              </button>
            </div>
            {view === "theme" && (
              <div className="flex rounded-lg overflow-hidden border border-edge">
                {TYPES.map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setZsType(t.k)}
                    className={`px-3 py-1 text-sm ${
                      zsType === t.k ? "bg-blue text-white" : "bg-panel2 text-sub"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-1 text-sm text-sub">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              自动
            </label>
            <button
              onClick={load}
              className="px-3 py-1 text-sm rounded-lg bg-panel2 border border-edge"
            >
              刷新
            </button>
          </div>
        </div>
        <IndexTicker />
      </header>

      {view === "theme" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索题材名称…"
              className="px-3 py-1.5 text-sm rounded-lg bg-panel2 border border-edge text-ink placeholder:text-sub outline-none focus:border-blue w-44"
            />
            <div className="flex rounded-lg overflow-hidden border border-edge text-sm">
              <button
                onClick={() => setSortBy("strength")}
                className={`px-3 py-1 ${
                  sortBy === "strength" ? "bg-blue text-white" : "bg-panel2 text-sub"
                }`}
              >
                按强度
              </button>
              <button
                onClick={() => setSortBy("chg")}
                className={`px-3 py-1 ${
                  sortBy === "chg" ? "bg-blue text-white" : "bg-panel2 text-sub"
                }`}
              >
                按涨幅
              </button>
            </div>
            <span className="text-xs text-sub">共 {displayConcept.length} 个题材</span>
          </div>
          <main className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section>
              <h2 className="text-sm text-sub mb-2">
                题材榜（{TYPES.find((t) => t.k === zsType)?.label}）
              </h2>
              <Board
                data={displayConcept}
                onSelect={(code, name) => setSelected({ code, name })}
                selected={selected?.code}
              />
            </section>
            <section>
              <ZtPanel data={zt} />
            </section>
          </main>
        </>
      ) : view === "lianban" ? (
        <main>
          <LianbanPanel data={zt} />
        </main>
      ) : (
        <main>
          <AnalysisPanel concept={concept} zt={zt} />
        </main>
      )}

      {selected && (
        <PlateDetail
          code={selected.code}
          name={selected.name}
          onClose={() => setSelected(null)}
        />
      )}

      <footer className="text-center text-xs text-sub mt-8">
        数据来源：开盘啦(longhuvip)公开接口 + 腾讯行情 · 经 Cloudflare 边缘加速
      </footer>
    </div>
  )
}
