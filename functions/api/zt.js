// GET /api/zt?day=YYYY-MM-DD
// 涨停原因题材榜（含个股明细 + 连板天数）。原样返回开盘啦结构，前端解析。
import { proxyPost, json, ttl, HOSTS, cnDate } from "./_lib.js"

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const day = url.searchParams.get("day") || cnDate()
  const ua = "Dalvik/2.1.0 (Linux; U; Android 9; SHARK PRS-A0 Build/PQ3A.190605.01141736)"
  const body = {
    a: "GetPlateInfo_w38",
    st: "100",
    c: "DailyLimitResumption",
    PhoneOSNew: "1",
    DeviceID: crypto.randomUUID(),
    VerSion: "5.21.0.2",
    Index: "0",
    apiv: "w42",
    Day: day,
  }
  const data = await proxyPost(env, HOSTS.ZT, "/w1/api/index.php", body, `zt:${day}`, ttl(), ua)
  return json(data)
}
