import { pct, chgColor } from "../api"
import Kline from "./Kline"
import { fetchPlate } from "../api"
import { useEffect, useState } from "react"

function PlateKlineMini({ code }: { code: string }) {
  const [k, setK] = useState<any>(null)
  useEffect(() => {
    fetchPlate(code).then((d) => setK(d))
  }, [code])
  return k?.kline?.length ? <Kline data={k.kline} /> : null
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
    return <div className="text-gray-500 text-sm p-4">暂无数据</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {data.map((it) => (
        <button
          key={it.code}
          onClick={() => onSelect(it.code, it.name)}
          className={`text-left rounded-lg border p-3 transition ${
            selected === it.code
              ? "border-blue-500 bg-panel2"
              : "border-edge bg-panel hover:border-gray-500"
          }`}
        >
          <div className="flex justify-between items-baseline">
            <span className="font-medium truncate">{it.name}</span>
            <span className={`text-sm ${chgColor(it.chg)}`}>{pct(it.chg)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            强度 {it.strength} · {it.code}
          </div>
          <div className="mt-2 opacity-80">
            <PlateKlineMini code={it.code} />
          </div>
        </button>
      ))}
    </div>
  )
}
