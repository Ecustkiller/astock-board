// GET /api/concept?type=7&topn=50
// 板块榜：type 7=概念 4=行业 6=地区；返回 [{code,name,strength,chg}]
import { proxyPost, json, ttl, HOSTS, cnDate } from "./_lib.js"

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const zsType = url.searchParams.get("type") || "7"
  const topn = parseInt(url.searchParams.get("topn") || "50", 10)
  const body = {
    Date: cnDate(),
    Index: "0",
    Order: "1",
    PhoneOSNew: "2",
    Type: "1",
    VerSion: "5.17.0.9",
    ZSType: zsType,
    a: "RealRankingInfo",
    apiv: "w38",
    c: "ZhiShuRanking",
    st: "50",
  }
  const data = await proxyPost(env, HOSTS.HQ, "/w1/api/index.php", body, `concept:${zsType}`, ttl())
  const out = (data.list || [])
    .filter((it) => it.length >= 4)
    .map((it) => ({ code: it[0], name: it[1], strength: it[2], chg: it[3] }))
    .slice(0, topn)
  return json(out)
}
