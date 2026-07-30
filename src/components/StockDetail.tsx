import { useEffect, useState } from "react"
import { fetchKline, fetchQuote, marketOf, pct, chgColor } from "../api"

function ma(arr: number[], n: number, i: number): number | null {
  if (i - n + 1 < 0) return null
  let s = 0
  for (let k = i - n + 1; k <= i; k++) s += arr[k]
  return s / n
}
function maSeries(arr: number[], n: number): (number | null)[] {
  return arr.map((_, i) => ma(arr, n, i))
}

// 基于公开日K线 + 实时行情，套用 Mistery 趋势交易论六模块实时判定（不依赖本地 Python）
function analyze(kl: any[], live: any) {
  const c = kl.map((k) => k.c)
  const v = kl.map((k) => k.v)
  const h = kl.map((k) => k.h)
  const l = kl.map((k) => k.l)
  const n = c.length
  const last = n - 1
  const price = live?.price != null ? live.price : c[last]
  const chg = live?.chg != null ? live.chg : kl[last].chgPct

  const ma5 = ma(c, 5, last) ?? 0
  const ma10 = ma(c, 10, last) ?? 0
  const ma20 = ma(c, 20, last) ?? 0
  const ma60 = ma(c, 60, last) ?? 0
  const ma5p = ma(c, 5, last - 1) ?? 0
  const ma20p = ma(c, 20, last - 1) ?? 0
  const hasMa60 = ma(c, 60, last) != null

  // M1 趋势判定
  let trend = "震荡缠绕"
  if (hasMa60 && ma5 > ma10 && ma10 > ma20 && ma20 > ma60 && price >= ma5)
    trend = "多头排列（上升）"
  else if (hasMa60 && ma5 < ma10 && ma10 < ma20 && ma20 < ma60 && price <= ma5)
    trend = "空头排列（下降）"
  const hh1 = Math.max(...h.slice(-10)), hh0 = Math.max(...h.slice(-20, -10))
  const ll1 = Math.min(...l.slice(-10)), ll0 = Math.min(...l.slice(-20, -10))
  const dao =
    hh1 >= hh0 && ll1 >= ll0 ? "上升（高低点抬升）"
    : hh1 <= hh0 && ll1 <= ll0 ? "下降（高低点降低）" : "震荡"

  // M2 买点识别
  const diffNow = ma5 - ma20
  const diffPrev = ma5p - ma20p
  let cross520 = "无"
  if (diffPrev <= 0 && diffNow > 0) cross520 = "金叉（买入）"
  else if (diffPrev >= 0 && diffNow < 0) cross520 = "死叉（卖出）"
  const broke5 = c[last - 1] < ma5p && price >= ma5
  const pullback = ma5 > ma20 && price < ma5 && price >= ma20
  const buy: string[] = []
  if (cross520.includes("金叉")) buy.push("520战法金叉")
  if (broke5) buy.push("破五反五（洗盘确认）")
  if (pullback) buy.push("上升回踩MA20")
  const buySignal = buy.length ? buy.join("、") : "无明显买点"

  // M3 卖点识别
  const recentHigh = Math.max(...c.slice(-3))
  const prevHigh = Math.max(...c.slice(-13, -3))
  const threeNoHigh = recentHigh < prevHigh
  const avgV = (v.slice(-6, -1).reduce((a, b) => a + b, 0) / 5) || 1
  const volRatio = v[last] / avgV
  const upStall = volRatio >= 2 && chg > -1 && chg < 1
  const fallout = chg < 0 && volRatio >= 1.5
  const sell: string[] = []
  if (threeNoHigh) sell.push("3日不创新高")
  if (upStall) sell.push("放量滞涨")
  if (fallout) sell.push("放量下跌（出货嫌疑）")
  const sellSignal = sell.length ? sell.join("、") : "无明显卖点"

  // M4 量价诊断
  let vp = "量价平稳"
  if (volRatio >= 1.5 && chg > 0) vp = "放量上涨（多头强）"
  else if (volRatio < 0.7 && chg > 0) vp = "缩量上涨（动力不足）"
  else if (volRatio >= 1.5 && chg < 0) vp = "放量下跌（抛压重）"
  else if (volRatio < 0.7 && chg < 0) vp = "缩量下跌（抛压减弱）"
  else if (volRatio >= 2 && Math.abs(chg) < 1) vp = "放量滞涨（换手）"

  // M5 形态识别（简化）
  const hi20 = Math.max(...h.slice(-20)), lo20 = Math.min(...l.slice(-20))
  const pos = (price - lo20) / (hi20 - lo20 || 1)
  const shape = pos > 0.8 ? "阶段高位" : pos < 0.2 ? "阶段低位" : "中位震荡"
  const upShadow = (h[last] - Math.max(c[last], kl[last].o)) / (h[last] - l[last] || 1)
  const doji = Math.abs(c[last] - kl[last].o) / (h[last] - l[last] || 1) < 0.15
  const candle = doji ? "十字星（多空平衡）" : upShadow > 0.6 ? "长上影（上档压力）" : "普通K线"

  // M6 仓位建议
  let position = "空仓观望", advice = "趋势不明，等待信号"
  if (trend.includes("多头") && buy.length) { position = "标准仓位(50%)"; advice = "顺势持仓，回踩加仓" }
  else if (trend.includes("多头")) { position = "轻仓(30%)"; advice = "持有观察，等回踩买点" }
  else if (trend.includes("空头")) { position = "空仓"; advice = "回避，等待企稳" }
  else if (buy.length) { position = "轻仓试探(20%)"; advice = "小仓试错，确认加仓" }
  const support = ma20 || ma60 || lo20
  const stop = (support * 0.95).toFixed(2)

  return {
    price, chg, ma5, ma10, ma20, ma60, trend, dao,
    cross520, broke5, pullback, buySignal,
    threeNoHigh, upStall, fallout, sellSignal,
    volRatio, vp, shape, candle,
    position, advice, support: support.toFixed(2), stop,
  }
}

function CandleChart({ kl }: { kl: any[] }) {
  const data = kl.slice(-60)
  const W = 600, H = 240, pad = 12
  const closes = kl.map((d) => d.c)
  const allH = kl.map((d) => d.h), allL = kl.map((d) => d.l)
  const min = Math.min(...allL), max = Math.max(...allH)
  const X = (i: number) => pad + i * ((W - 2 * pad) / (data.length - 1))
  const Y = (v: number) => H - pad - ((v - min) / ((max - min) || 1)) * (H - 2 * pad)
  const maOf = (n: number) => {
    const s = maSeries(closes, n)
    return data.map((_, i) => s[kl.length - data.length + i])
  }
  const poly = (arr: (number | null)[]) =>
    arr.map((val, i) => (val == null ? "" : `${X(i).toFixed(1)},${Y(val).toFixed(1)}`))
      .filter(Boolean)
      .join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {data.map((d, i) => {
        const up = d.c >= d.o
        const color = up ? "var(--up)" : "var(--down)"
        const x = X(i)
        const yo = Y(d.o), yc = Y(d.c), yh = Y(d.h), yl = Y(d.l)
        const top = Math.min(yo, yc), bot = Math.max(yo, yc)
        return (
          <g key={i}>
            <line x1={x} y1={yh} x2={x} y2={yl} stroke={color} strokeWidth={1} />
            <rect x={x - 3} y={top} width={6} height={Math.max(1, bot - top)} fill={color} />
          </g>
        )
      })}
      <polyline points={poly(maOf(5))} fill="none" stroke="#ff9500" strokeWidth={1.2} />
      <polyline points={poly(maOf(20))} fill="none" stroke="#0a84ff" strokeWidth={1.2} />
      <polyline points={poly(maOf(60))} fill="none" stroke="#34c759" strokeWidth={1.2} />
    </svg>
  )
}

function Card({ title, items, accent }: { title: string; items: [string, string][]; accent?: boolean }) {
  return (
    <div className={`rounded-lg border border-edge bg-panel p-3 ${accent ? "border-blue/40" : ""}`}>
      <div className="text-sm font-medium text-ink mb-2">{title}</div>
      <div className="space-y-1">
        {items.map(([k, v], i) => (
          <div key={i} className="flex justify-between gap-3 text-xs">
            <span className="text-sub shrink-0">{k}</span>
            <span className="text-ink text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StockDetail({
  code, name, market, onClose,
}: { code: string; name: string; market?: number; onClose: () => void }) {
  const [kl, setKl] = useState<any>(null)
  const [live, setLive] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const m = market ?? marketOf(code)
    const prefix = m === 1 ? "sh" : m === 0 ? "sz" : "bj"
    const pure = code.replace(/^(sh|sz|bj)/i, "")
    setLoading(true)
    Promise.all([
      fetchKline(code, m),
      fetchQuote([prefix + pure]).catch(() => ({})),
    ]).then(([k, q]) => {
      if (cancelled) return
      setKl(k)
      setLive(q?.[prefix + pure] || null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const a = kl?.klines?.length ? analyze(kl.klines, live) : null

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="drawer bg-bg w-full max-w-lg h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div
          className="sticky top-0 backdrop-blur z-10 px-4 py-3 border-b border-edge flex items-center justify-between"
          style={{ background: "color-mix(in srgb, var(--bg) 90%, transparent)" }}
        >
          <div>
            <div className="font-semibold text-ink">
              {name} <span className="text-sub text-sm font-normal">{code}</span>
            </div>
            {a && (
              <div className="text-sm mt-0.5">
                <span className="text-ink tabular-nums">{a.price.toFixed(2)}</span>{" "}
                <span className={chgColor(a.chg)}>{pct(a.chg)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="px-2 py-1 rounded-lg bg-panel2 border border-edge text-sm">
            关闭
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <div className="text-sub text-sm">加载中…</div>}
          {kl?.error && <div className="text-down text-sm">{kl.error}</div>}
          {a && (
            <>
              <div className="rounded-lg border border-edge bg-panel p-3">
                <div className="text-xs text-sub mb-1">近60日K线（橙MA5 / 蓝MA20 / 绿MA60）</div>
                <CandleChart kl={kl.klines} />
              </div>

              <Card title="M1 趋势判定" items={[
                ["均线排列", a.trend],
                ["道氏结构", a.dao],
                ["MA5/10/20/60", `${a.ma5.toFixed(2)} / ${a.ma10.toFixed(2)} / ${a.ma20.toFixed(2)} / ${a.ma60.toFixed(2)}`],
              ]} />

              <Card title="M2 买点识别" items={[
                ["520战法", a.cross520],
                ["破五反五", a.broke5 ? "出现" : "未出现"],
                ["回踩买点", a.pullback ? "上升回踩MA20" : "无"],
                ["买点结论", a.buySignal],
              ]} />

              <Card title="M3 卖点识别" items={[
                ["3日不创新高", a.threeNoHigh ? "是" : "否"],
                ["放量滞涨", a.upStall ? "是" : "否"],
                ["放量下跌", a.fallout ? "是" : "否"],
                ["卖点结论", a.sellSignal],
              ]} />

              <Card title="M4 量价诊断" items={[
                ["量比(近5日均量)", a.volRatio.toFixed(2)],
                ["量价关系", a.vp],
              ]} />

              <Card title="M5 形态识别" items={[
                ["位置结构", a.shape],
                ["当日K线", a.candle],
              ]} />

              <Card title="M6 仓位建议" items={[
                ["建议仓位", a.position],
                ["操作策略", a.advice],
                ["关键支撑(MA20/60)", a.support],
                ["参考止损(支撑-5%)", a.stop],
              ]} accent />

              <div className="text-[11px] text-sub">
                分析框架：Mistery趋势交易论（六大模块）。基于公开日K线实时计算，仅供参考，不构成投资建议。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
