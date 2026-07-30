import { pct, chgColor, prefetchPlate } from "../api"

// 卡片上的「当日涨跌条」：与卡片显示的当日涨跌幅严格对应（红涨绿跌，长度∝幅度）。
// 不再用 130 日 K 线当卡片缩略图——那是不同时间维度，视觉上和当日%对不上。
// 真正的板块 K 线留在钻取详情（PlateDetail）里看。
function ChgBar({ chg }: { chg: number }) {
  const up = chg >= 0
  const mag = Math.min(Math.abs(chg) / 5, 1) * 50 // 单日 ±5% 封顶占半宽
  const style: React.CSSProperties = up
    ? { left: "50%", width: mag + "%", background: "var(--up)" }
    : { right: "50%", width: mag + "%", background: "var(--down)" }
  return (
    <div className="relative h-1.5 bg-edge rounded overflow-hidden">
      <div className="absolute top-0 bottom-0" style={style} />
    </div>
  )
}

export default function Board({
  data,
  onSelect,
  selected,
}: {
  data: any[]
  onSelect: (code: string, name: string) => void
  selected?: string
}) {
  if (!data || !data.length)
    return <div className="text-sub text-sm p-4">暂无数据</div>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
      {data.map((it) => (
        <button
          key={it.code}
          onClick={() => onSelect(it.code, it.name)}
          onMouseEnter={() => prefetchPlate(it.code)}
          className={`text-left rounded-lg border p-2.5 sm:p-3 transition ${
            selected === it.code
              ? "border-blue bg-panel2"
              : "border-edge bg-panel hover:border-sub"
          }`}
        >
          <div className="flex justify-between items-baseline gap-1">
            <span className="font-medium truncate">{it.name}</span>
            <span className={`text-sm tabular-nums ${chgColor(it.chg)}`}>
              {pct(it.chg)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 min-w-0">
              <ChgBar chg={it.chg} />
            </div>
            <span className="text-[11px] text-sub tabular-nums shrink-0">
              强度{it.strength}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
