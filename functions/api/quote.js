// GET /api/quote?codes=600000,000001,300750
// 腾讯实时行情（GBK 编码，需转码）。返回 {code:{name,price,chg,amount}}
import { json } from "./_lib.js"

const QT = "web.sqt.gtimg.cn"

function fmt(code) {
  const c = String(code).padStart(6, "0")
  if ("69".includes(c[0])) return "sh" + c
  if ("0123".includes(c[0])) return "sz" + c
  return "bj" + c
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const codes = (url.searchParams.get("codes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!codes.length) return json({ error: "codes required" })

  const qt = codes.map(fmt)
  const out = {}
  try {
    const resp = await fetch(`https://${QT}/q=${qt.join(",")}`, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://gu.qq.com/" },
    })
    const buf = await resp.arrayBuffer()
    const text = new TextDecoder("gbk").decode(buf)
    for (const line of text.split(";")) {
      if (!line.includes('"')) continue
      const f = line.split("~")
      if (f.length > 37) {
        out[f[2]] = {
          name: f[1],
          price: parseFloat(f[3]),
          chg: parseFloat(f[32]),
          amount: f[37] ? parseFloat(f[37]) : 0,
        }
      }
    }
  } catch (e) {
    return json({ error: String(e) })
  }
  return json(out)
}
