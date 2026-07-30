import { useEffect, useMemo, useState } from "react"
import { fetchQuote, pct, chgColor } from "../api"

// 题材分析（实时自算）：沿用定时题材复盘报告的框架
//   · 最强题材对比（综合分=强度/涨幅/涨停 实时近似，非多日窗口评分）
//   · 主线 / 共振核心 / 观察 状态识别
//   · 跨题材龙头（同时卡位 ≥2 个涨停原因题材的个股）
//   · 程序化操作建议
// 数据完全来自已加载的 concept(题材榜) + zt(涨停原因)，不依赖本地报告文件。

type It = { code?: string; name?: string; chg?: number; strength?: number; zt?: number | null; score?: number }

function statusOf(it: It): { icon: string; tag: string } {
  const s = it.strength || 0
  const z = it.zt
  if (s >= 60 && z != null && z >= 3) return { icon: "🔗", tag: "共振核心" }
  if (s >= 60) return { icon: "📈", tag: "主线" }
  if ((it.chg || 0) < 0 || s < 40) return { icon: "📉", tag: "观察" }
  return { icon: "", tag: "普通" }
}

export default function AnalysisPanel({ concept, zt }: { concept: any[]; zt: any }) {
  const [quotes, setQuotes] = useState<Record<string, any>>({})

  // 涨停原因题材 -> 题材名 -> 涨停数（用于概念题材的「涨停」列交叉参考）
  const ztThemeCount = useMemo(() => {
    const m: Record<string, number> = {}
    ;(zt?.list || []).forEach((t: any) => {
      const n = t.ZSName || ""
      if (n) m[n] = (m[n] || 0) + (t.StockList?.length || 0)
    })
    return m
  }, [zt])

  // 概念题材名 与 涨停原因题材名 模糊匹配，得到该概念题材的涨停数
  function ztCountFor(name: string): number | null {
    if (!name) return null
    let best: number | null = null
    for (const k of Object.keys(ztThemeCount)) {
      if (name.includes(k) || k.includes(name)) {
        const v = ztThemeCount[k]
        if (best == null || v > best) best = v
      }
    }
    return best
  }

  // 最强题材对比（实时综合分近似）
  const ranked = useMemo(() => {
    const arr = (concept || []).filter((c) => c && c.name)
    const maxS = Math.max(1, ...arr.map((c) => c.strength || 0))
    const maxZ = Math.max(1, ...Object.values(ztThemeCount) as number[])
    return arr
      .map((c) => {
        const z = ztCountFor(c.name)
        const sN = (c.strength || 0) / maxS
        const cN = Math.max(-1, Math.min(1, (c.chg || 0) / 10))
        const zN = z == null ? 0 : z / maxZ
        const score = Math.round(100 * (0.5 * sN + 0.3 * cN + 0.2 * zN))
        return { ...c, zt: z, score }
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 15)
  }, [concept, ztThemeCount])

  // 题材结构统计（实时快照）
  const counts = useMemo(() => {
    let main = 0,
      reso = 0,
      watch = 0
    ranked.forEach((r) => {
      const st = statusOf(r).tag
      if (st === "共振核心") reso++
      else if (st === "主线") main++
      else if (st === "观察") watch++
    })
    return { main, reso, watch }
  }, [ranked])

  // 跨题材龙头：出现在 ≥2 个涨停原因题材的个股
  const cross = useMemo(() => {
    const map: Record<string, { name: string; themes: Set<string> }> = {}
    ;(zt?.list || []).forEach((t: any) => {
      const zn = t.ZSName || ""
      ;(t.StockList || []).forEach((s: any) => {
        const code = s?.[0]
        if (!code) return
        if (!map[code]) map[code] = { name: s[1], themes: new Set() }
        if (zn) map[code].themes.add(zn)
      })
    })
    return Object.entries(map)
      .filter(([, v]) => v.themes.size >= 2)
      .map(([code, v]) => ({ code, name: v.name, themes: [...v.themes] }))
  }, [zt])

  useEffect(() => {
    const codes = cross.map((x) => x.code).slice(0, 40)
    if (codes.length) fetchQuote(codes).then(setQuotes).catch(() => {})
  }, [cross])

  const crossRanked = useMemo(() => {
    return [...cross]
      .map((x) => ({ ...x, chg: quotes[x.code]?.chg }))
      .filter((x) => x.chg != null)
      .sort((a, b) => (b.chg || 0) - (a.chg || 0))
      .slice(0, 12)
  }, [cross, quotes])

  // 程序化操作建议
  const advice = useMemo(() => {
    const ztTotal = zt?.nums?.ZT ?? 0
    const reso = ranked.filter((r) => statusOf(r).tag === "共振核心").map((r) => r.name)
    const main = ranked
      .filter((r) => statusOf(r).tag === "主线" || statusOf(r).tag === "共振核心")
      .map((r) => r.name)
    const lines: string[] = []
    lines.push(
      `当前全市场涨停 ${ztTotal} 家` +
        (ztTotal >= 100 ? "，做多情绪亢奋" : ztTotal >= 50 ? "，题材活跃" : "，情绪偏谨慎") +
        "。"
    )
    if (reso.length) lines.push(`共振核心题材：${reso.join("、")}（多线开花，是真核心方向）。`)
    if (main.length) lines.push(`主线方向：${main.slice(0, 5).join("、")}。`)
    if (crossRanked.length)
      lines.push(`跨题材龙头：${crossRanked.slice(0, 3).map((x) => x.name).join("、")}（同时卡位多个热点）。`)
    lines.push("以上为程序基于实时数据的结构化参考，非投资建议。")
    return lines
  }, [zt, ranked, crossRanked])

  if (!concept?.length)
    return <div className="text-sub text-sm p-4">题材榜加载中或暂无数据…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-medium text-ink">题材分析 · 实时快照</h2>
          <div className="text-xs text-sub mt-0.5">
            综合分为实时近似算法（强度 / 涨幅 / 涨停），非定时报告的多日窗口评分
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-panel2 border border-edge text-up">
            📈 主线 {counts.main}
          </span>
          <span className="px-2 py-1 rounded-full bg-panel2 border border-edge text-blue">
            🔗 共振核心 {counts.reso}
          </span>
          <span className="px-2 py-1 rounded-full bg-panel2 border border-edge text-down">
            📉 观察 {counts.watch}
          </span>
        </div>
      </div>

      {/* 一、最强题材对比 */}
      <section>
        <h3 className="text-sm text-sub mb-2">一、最强题材对比（Top 15）</h3>
        <div className="overflow-x-auto no-scrollbar">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>题材</th>
                <th className="text-right">综合分</th>
                <th className="text-right">强度</th>
                <th className="text-right">当日%</th>
                <th className="text-right">涨停</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const st = statusOf(r)
                return (
                  <tr key={r.code || r.name}>
                    <td className="text-sub tabular-nums">{i + 1}</td>
                    <td className="text-ink">{r.name}</td>
                    <td className="text-right tabular-nums font-medium">{r.score}</td>
                    <td className="text-right tabular-nums text-sub">{r.strength ?? "—"}</td>
                    <td className={`text-right tabular-nums ${chgColor(r.chg || 0)}`}>
                      {pct(r.chg || 0)}
                    </td>
                    <td className="text-right tabular-nums text-up">{r.zt ?? "—"}</td>
                    <td className="text-sub whitespace-nowrap">
                      {st.icon} {st.tag}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 二、跨题材龙头 */}
      <section>
        <h3 className="text-sm text-sub mb-2">二、跨题材龙头（同时卡位 ≥2 个涨停原因题材）</h3>
        {crossRanked.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {crossRanked.map((x) => (
              <div
                key={x.code}
                className="rounded-lg border border-edge bg-panel px-3 py-2 flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">
                    {x.name} <span className="text-sub text-xs">{x.code}</span>
                  </div>
                  <div className="text-xs text-sub truncate">跨 {x.themes.length} 题材：{x.themes.join(" / ")}</div>
                </div>
                <span className={`tabular-nums shrink-0 ${chgColor(x.chg || 0)}`}>
                  {pct(x.chg || 0)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sub text-sm">暂无跨题材个股（非交易时段或涨停稀疏）。</div>
        )}
      </section>

      {/* 三、操作建议 */}
      <section>
        <h3 className="text-sm text-sub mb-2">三、操作建议（程序化参考）</h3>
        <div className="rounded-lg border border-edge bg-panel2 px-4 py-3 space-y-1.5 text-sm text-ink">
          {advice.map((line, i) => (
            <p key={i} className={i === advice.length - 1 ? "text-sub text-xs pt-1" : ""}>
              {line}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
