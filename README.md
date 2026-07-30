# A股题材 · 涨停看板

部署在 **Cloudflare** 上的纯前端看板：题材榜（概念 / 行业 / 地区）、涨停原因题材榜、连板梯队、板块钻取（K线 + 细分概念）、个股实时行情。数据来自开盘啦(longhuvip)公开接口 + 腾讯行情，经 **CF Pages Functions 反向代理 + KV 边缘缓存** 全球加速。

> 为什么放 CF：纯前端 SPA 由 CF Pages 全球托管，API 由 Pages Functions（Workers 运行时）代理并缓存到离用户最近的边缘节点——零服务器运维、自带 HTTPS、自动 CDN 加速。公开行情数据不涉及版权分发，完全符合 Cloudflare 可接受使用政策（对比影视聚合类项目更安全）。

## 架构

```
浏览器 ──HTTPS──> CF Pages (静态前端 dist/)
                  │  /api/* 由 Pages Functions 处理
                  ▼
        functions/api/*  ──代理──> 开盘啦 longhuvip / 腾讯行情
                  │
                  └── KV 缓存 (KPL_CACHE)：盘中 30s / 非盘后 1h
```

- **前端**：React 18 + Vite 5 + TypeScript + Tailwind CSS，构建产物 `dist/`
- **后端**：CF Pages Functions（`functions/api/*`，Workers 运行时）代理上游接口、屏蔽 CORS
- **缓存**：Cloudflare KV（`KPL_CACHE`），边缘节点就近返回，降低上游频率

## 目录结构

```
functions/api/
  _lib.js      # 代理 + KV 缓存 + 交易时段判断（私有模块，不暴露为路由）
  concept.js   # GET /api/concept?type=7&topn=60   板块榜（7概念/4行业/6地区）
  zt.js        # GET /api/zt                       涨停原因题材榜 + 连板天数
  quote.js     # GET /api/quote?codes=600000,...   腾讯实时行情（GBK 转码）
  plate.js     # GET /api/plate?code=XXX           子板块(细分概念) + 板块日K
src/           # 前端源码（React）
wrangler.toml  # Pages 项目 + KV 绑定配置
```

## 部署方式一：连接 Git 自动部署（推荐）

1. 把本项目推到 GitHub（如 `Ecustkiller/astock-board`）。
2. Cloudflare 控制台 → **Workers & Pages** → 创建 **Pages** 项目 → 连接该 Git 仓库。
   - 构建命令：`npm run build`
   - 输出目录：`dist`
3. 创建 KV 命名空间：`wrangler kv namespace create astock_cache`，把返回的 **id** 填进 `wrangler.toml` 的 `id` 字段。
4. Pages 项目 **设置 → 函数 → KV 变量绑定**：添加绑定，变量名 `KPL_CACHE`，指向刚创建的命名空间（与 `wrangler.toml` 一致）。
5. 推送代码即自动部署，获得 `*.pages.dev` 域名；可再在 **自定义域** 绑自己的域名。

## 部署方式二：手动 wrangler

```bash
npm install -g wrangler
wrangler login
wrangler kv namespace create astock_cache   # 复制输出 id 填进 wrangler.toml
npm install && npm run build
wrangler pages deploy dist
```

## 本地联调

```bash
# 终端 1：起 Pages Functions（默认端口 8788）
wrangler dev

# 终端 2：起前端 dev（vite 已配置把 /api 代理到 8788）
npm install
npm run dev
# 打开 http://localhost:5173
```

## 缓存策略

`functions/api/_lib.js` 的 `ttl()` 依据交易时段返回缓存 TTL：

- **交易时段**（工作日 9:15–11:30、13:00–15:00）：`30s`
- **非交易时段**：`3600s`

边缘节点命中缓存直接返回，既加速访问又降低对上游接口的频率压力。

## 数据来源与合规

- 题材 / 涨停数据来自开盘啦(longhuvip)公开行情接口，个股行情来自腾讯公开接口，均为公开市场数据。
- 本项目仅做数据展示与聚合，不涉及任何版权内容分发，符合 Cloudflare 可接受使用政策。

## 已知扩展点

- 板块成分股实时行情：当前细分概念列表来自开盘啦子板块接口（不含成分股行情）。如需在钻取页展示成分股实时涨跌，可补一个「板块成分股」接口（开盘啦 `SonPlate` 之外另有成分股列表接口），再走 `/api/quote` 拉行情。
- 涨停原因题材榜的个股已接入实时行情（点击题材展开）。
