// 板块K线迷你走势图（SVG sparkline，取收盘价）
export default function Kline({ data }: { data: { close: number }[] }) {
  if (!data || data.length < 2)
    return <div className="text-xs text-sub">暂无K线</div>

  const closes = data.map((d) => d.close).filter((v) => typeof v === "number")
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const w = 260
  const h = 56
  const pts = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * w
      const y = h - ((c - min) / (max - min || 1)) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  const up = closes[closes.length - 1] >= closes[0]
  const color = up ? "var(--up)" : "var(--down)"

  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}
