// GET /api/plate?code=XXXXXX
// 某板块的子板块(细分概念) + 板块整体日K。返回 {sons:[{code,name,strength}], kline:[{date,open,close,high,low}]}
import { proxyGet, proxyPost, json, ttl, HOSTS } from "./_lib.js"

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  if (!code) return json({ error: "code required" })

  // 子板块（细分概念）
  const sons = await proxyGet(
    env,
    HOSTS.SON,
    "/w1/api/index.php",
    {
      DEnd: "",
      Date: "",
      PhoneOSNew: "2",
      PlateID: code,
      VerSion: "5.17.0.9",
      a: "SonPlate_Info",
      apiv: "w38",
      c: "ZhiShuRanking",
    },
    `son:${code}`,
    ttl()
  )
  const sonList = (sons.List || [])
    .filter((i) => i.length >= 3)
    .map((i) => ({ code: i[0], name: i[1], strength: i[2] }))

  // 板块整体日K
  const k = await proxyPost(
    env,
    HOSTS.HIS,
    "/w1/api/index.php",
    {
      Index: "0",
      PhoneOSNew: "2",
      StockID: code,
      VerSion: "5.21.0.1",
      a: "GetPlateKLineDay",
      apiv: "w42",
      c: "ZhiShuKLine",
      st: "130",
    },
    `kline:${code}`,
    ttl()
  )
  let kline = []
  if (k.x && k.y) {
    kline = k.x.map((d, i) => ({
      date: d,
      open: k.y[i][0],
      close: k.y[i][1],
      high: k.y[i][2],
      low: k.y[i][3],
    }))
  }
  return json({ sons: sonList, kline })
}
