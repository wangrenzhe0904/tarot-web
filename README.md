# 镜中塔罗

一个安静、克制的在线塔罗占卜应用：真实 78 张韦特牌面、可交互的洗牌与翻牌、凯尔特十字等四种牌阵，以及流式输出的 AI 解读。

## 功能

- **真实牌面**：78 张 Rider–Waite–Smith（1909）公版扫描图，正位/逆位均可解读
- **加密随机**：基于 `crypto.getRandomValues` 的 Fisher–Yates 洗牌，带拒绝采样避免取模偏差；约 32% 概率抽到逆位
- **四种牌阵**：单张指引、时间三牌、十字路口、凯尔特十字（桌面为交叉布局，移动端自动变为两列）
- **桌面铺牌**：78 张牌全部平铺，位置和角度每次随机；由用户自己点选，选牌顺序对应牌阵位置
- **洗牌与切牌**：洗牌动画后可选三叠切牌，把选中一叠放回顶部，再铺牌
- **3D 翻牌**：点击翻开，逐张揭晓，也可以一键全部翻开
- **流式 AI 解读**：服务端代理 OpenAI 兼容接口，SSE 解析后以纯文本流式返给浏览器
- **语气设置**：温柔 / 直白 / 诗意 / 务实，只影响下一次 AI 解读
- **网关设置**：在设置面板修改接口地址、模型与密钥，保存在服务端 `.data/settings.json`
- **模型下拉**：模型改为选项选择；打开设置时自动读取网关可用模型（网关支持 `GET /models` 时直接列出，否则用 1-token 请求逐项探测），结果缓存于 `.data/models.json`，也可手动填写
- **导出**：解读一键导出为长图 PNG 或 A4 PDF（长内容自动分页，尽量避开行中断）
- **本地降级**：未配置密钥或上游失败时，用本地牌义生成组合解读，并在界面明确标注「本地牌义解读」
- **历史记录**：最近 30 次占卜保存在 `localStorage`，可回看、复制、删除

## 技术栈

- 前端：Vite 6 + React 18 + TypeScript，手写 CSS（无 UI 框架）
- 后端：Express 4，负责静态文件、`/api/reading` 代理与运行时的网关设置
- 导出：Canvas 2× 绘制长图；jsPDF 按 A4 切片分页
- 数据：`shared/` 下的卡牌与牌阵 JSON，前后端共用同一份

## 快速开始

```bash
pnpm install
cp .env.example .env     # 填写 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
pnpm dev                 # 前端 5173，API 8787，/api 自动代理
```

生产运行：

```bash
pnpm build               # tsc --noEmit && vite build
pnpm start               # 用 Express 托管 dist/ 与 API，默认 8787
```

没有密钥也能启动：前端会走本地牌义解读，`GET /api/health` 返回 `configured: false`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `LLM_BASE_URL` | OpenAI 兼容接口地址，通常以 `/v1` 结尾；只写到主机名时会自动补 `/v1`，并去掉误加的 `/anthropic` |
| `LLM_API_KEY` | 服务端密钥，不会下发到浏览器 |
| `LLM_MODEL` | 模型名，默认 `gpt-4o-mini` |
| — | 设置面板保存的网关配置覆盖以上变量，存于 `.data/settings.json`（已被 `.gitignore` 忽略）；密钥只留在服务端，接口仅返回掩码提示 |
| `PORT` | API 端口，默认 `8787` |
| `FALLBACK_ENV_PATH` | 可选。本地未配置密钥时，从指定 `.env` 借用 `OPENAI_API_KEY` / `OPENAI_BASE_URL` |

## API

`POST /api/reading`

```json
{
  "question": "我该不该接受这份新工作？",
  "spreadId": "three",
  "positions": ["过去", "现在", "未来"],
  "tone": "honest",
  "cards": [
    { "id": "wands-02", "reversed": false },
    { "id": "swords-10", "reversed": true },
    { "id": "major-15", "reversed": true }
  ]
}
```

服务端会校验牌阵、牌数与位置数量，用本地卡牌表覆盖请求里的牌，再拼装提示词。`tone` 可选 `gentle` / `honest` / `mystic` / `practical`，非法值回退为 `honest`。响应为 `text/plain` 流；限流 12 次/IP/分钟，上游超时 90 秒。

设置接口（均为 JSON）：

- `GET /api/settings` → `{ baseUrl, model, hasKey, keyHint, keySource, configured }`，不含明文密钥
- `POST /api/settings` → 保存 `{ baseUrl?, model?, apiKey?, clearKey? }`；空字符串会删除对应覆盖项，`apiKey` 留空表示保持不变
- `POST /api/settings/test` → 用当前配置发一次最小请求，返回 `{ ok, message }`
- `GET /api/settings/models` → `{ models, checkedAt, configured }`，读取缓存的可用模型
- `POST /api/settings/models` → 传 `{ baseUrl?, model?, apiKey? }` 触发一次发现，返回 `{ ok, models, source, message }`

## 目录

```
shared/            78 张卡牌数据 + 牌阵定义（前后端共用）
public/cards/      78 张 720×1200 牌面图
src/components/    Setup / Shuffle / Draw / Reading / Settings / History
src/lib/draw.ts    洗牌、切牌与桌面铺牌
src/lib/reading.ts 流式请求与本地降级文案
src/lib/settings.ts 语气与网关设置的浏览器端封装
src/lib/export.ts  Canvas 长图与 PDF 导出
.data/settings.json 运行时网关设置（密钥只在本机服务端）
.data/models.json  网关可用模型缓存（模型名，不含密钥）
server/index.js    Express API 与静态托管
```

## 牌面与版权

牌面为 Pamela Colman Smith 于 1909 年为 Rider–Waite–Smith 塔罗绘制的插画，已进入公有领域。本项目的图片文件取自公开仓库 [mixvlad/TarotCards](https://github.com/mixvlad/TarotCards) 的 `tarot/rider-waite/720px` 目录。

应用代码可自由修改使用。塔罗解读仅提供视角，不构成医疗、法律或财务建议。

## 字体

界面使用系统字体栈（中文衬线优先），不引入外部字体文件，离线可用。