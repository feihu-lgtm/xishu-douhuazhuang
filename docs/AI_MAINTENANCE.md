# AI 必读 · 西蜀豆花庄维护说明

> 给后续接手这个项目的 AI 看。改代码前先读这一份，重点系统（余味流光、银簪、伪流式出字、分段滑块）都在下面，别改回旧行为。

## 项目是什么

纯前端 + AI 说书人的小厨模拟游戏《西蜀豆花庄》（仓库名 xishu-douhuazhuang，远端 `feihu-lgtm/xishu-douhuazhuang`）。没有构建步骤，打开 `index.html` 即玩。玩家是师兄（小厨），师妹苏唐搭档，靠输入命令推进：做菜、上菜、备小吃、探秘、闲聊、踢馆等。

- 启动：`npm start`（python3 -m http.server 8742）或双击 `启动游戏.command`
- 测试：`npm test`（node:test，`test/logic.test.js`，47 用例）——**改完必须全绿再提交**
- 提交流程：`git add -A && git commit -m "…" && git push origin main`

## 代码结构（src/）

| 文件 | 职责 |
|---|---|
| `data.js` | 食材/技法/味型/客人数据。**余味（ryuwei）条目在此，消费力 888 文，别改** |
| `state.js` | 存档状态、判定、**银簪评级**（RYUWEI_TIERS / ryuweiGain / ryuweiTierName） |
| `main.js` | 游戏流程：命令分发、做菜/上菜/探秘/踢馆叙事、存档 |
| `ui.js` | 双栏渲染、日志、**伪流式打字器**、**分段滑块**、评语输出 |
| `ai.js` | AI 调用（DeepSeek）、流式、**extractComment 评语解析**、fallback 模板 |
| `prompt.js` | prompt 编排：STYLE 基座、出菜/品尝/小吃/探秘各块、**starSec 店誉块** |
| `modePrimer.js` | 模式预热（少动） |

AI 密钥在游戏内"设置"里填。常用反代：ggchan（`https://gcli.ggchan.dev`，Gemini 模型如 `gemini-3-flash-preview`）或 DeepSeek 官方（`https://api.deepseek.com`，`deepseek-chat`）。**所有调用统一走流式 SSE**（`callAI` 内部复用 `callAIStream`）——ggchan 反代对非流式支持差/慢，非流式会挂起超时→降级成模板（表现为"没走 AI、料瞎配"）。`max_tokens` 默认 65536（64k），Gemini 思考型模型别给 200000（思考会吞预算、拖到超时）。没接线时全部走 fallback 模板，游戏仍可玩。

## 余味（小鱼儿）系统 —— 最高优先级的维护对象

余味是顶级食评人（品馔录人·小鱼儿），全游戏最重的人物，所有与她相关的视觉都是"流光炫彩"：

1. **流光三处**：出餐/品尝/探秘的评语整段渐变流动（`narrGlow`/`commentGlow` → class `ryuwei-comment`）；名字流光（`ryuwei-name`）；邀请面板置顶+名字流光（三个邀请处：探秘 `guestListOf`、邀客 `openInviteGuest`、留坐 `renderInvite`——余味永远置顶）。
2. **银簪 = 一星米其林**：余味吃完按评分给评级点（`ryuweiGain`），晋升一档她就从发间取下一支银簪相赠。**档位即银簪数**（tier 0 无簪 / 1 一尾鱼翘楚 / 2 两尾鱼绝世 / 3 三尾鱼传说）。左上角徽章 `#ryuwei-badge` 显示「称号 · 银簪×N」；**tier 0 时徽章只显示灰色称号，不得出现银簪图**（`ui.js renderStatus`）。晋升叙事在 `main.js` doServe 的 `g.ryuwei` 分支，台词带口癖（见下）。
3. **店誉剧情**：有簪（tier≥1）后全蜀地都知道豆花庄——`prompt.js` 的 `starSec` 注入 出菜/品尝/苏唐小吃/探秘/闲聊 五路 prompt：熟人旧客见面夸、同行忌惮；踢馆同行台词有星变体（赢「挂着星的馆子，名不虚传——服了。」输「挂了星，就这？」）。`main.js ctxLine` 也带一行店誉。
4. **口癖（Cat 钦定，不要改回文绉绉）**：
   - 晋升：「做得很好，我的小鱼尾巴都要跳了。这支银簪，收好，算一星。」
   - 未晋升：「尾巴没压住，再练练，小鱼尾巴都耷拉下来啦。」
   - 二档/三档：「两支银簪，两星。」/「三支银簪，三星——小鱼儿的尾巴都要跳断了。」
5. **名字氪金框**：余味名字一律 `꧁༺✧余味✧༻꧂`（`ui.js` 的 `ryuweiTag`，用于客人卡/探秘常客/邀客面板三处）。
6. **苏唐批表情图标**：苏唐批（`comment` 条目）在 mood 为 开心/兴奋/心动/得意（`MOOD_WORDS` 索引 0/2/3/4）时，随机带一个 `su_face_1..4.png` 表情图标（`ui.js faceOf` + `commentLine`/`commentGlow`/`logStream.apply` 的 face 参数）；不高兴/中性不带。四张图是从 Cat 发的 2×2 苏唐表情图切出来的（黑背景抠透明，flood-fill 保黑碗），右下角那张同时是浏览器 favicon（`assets/favicon.png`）。

## 闲聊上下文（chatContext）

玩家闲聊（`genChat`）会注入 `prompt.js` 的 `chatContext(st)` 分块上下文（学 qucuo/jihaitang 的分块标号、数据拼接分离）：【场景】（周数/已待客/手上菜/今日来客/苏唐今日小吃）、【苏唐与师兄】（suAff 好感 + 银簪/店誉，无簪时提余味盼头）、【近况】（最近 4 条小纸条）、【最近对话】（`st.chatLog` 最近 4 轮）。`st.chatLog` 由 `main.js` 闲聊完成后自动入档（保留 8 轮，`{u: 师兄说, a: 苏唐回应}`）。genChat 的 sys 指示苏唐"接住上下文、别凭空造人造事、别生硬报清单"。改闲聊相关逻辑时别丢 chatLog 记录链。

## 评语解析（extractComment）

`ai.js` 的 `extractComment` 是**块解析**（宽容版）：`苏唐批/心情/菜单/纸条` 四个标记，顺序任意、中英文冒号都认；苏唐批可跨行直到下一个标记或结尾，心情/菜单/纸条取单行；其余文字归 main。**别改回老的 `[^\n]+` 单行正则**——AI 换行写评语时会拆不出苏唐批条目（当时就是竖线"不显示"的根因）。

## 伪流式出字（所有日志文本）

`ui.js` 的 `charMs` + `typeInto`：所有日志（主栏 `log`、右栏 `slog`、流式评语 `logStream.apply`）都逐字渐显——中文 24ms/字、西文 10ms、句末标点停顿 120ms、段间（`\n\n`）多停 90ms；`instant: true`（sys/playerLine）是快速出字而非全量蹦出；点击日志可跳过当前条目。打字中有闪烁光标（`.typing .bd::after`），条目入场淡入（`.entry` 的 `entry-in`）。`logStream` 是 AI 真流式，不要改。

## 分段滑块（每轮 prompt 打点）

左右日志栏（`#log` 主叙事 / `#sulog` 苏唐）滚动条旁有分段点：玩家每次输入（`main.js onCommand` 调 `ui.markPrompt()`）后，主栏 player 条目和右栏下一条消息各打一个点（`.log-marks .log-mark`）。滚动时当前轮高亮（`.cur`），点击标记跳到该轮。**改渲染时别丢 markPrompt 调用链**：`log()` 里 `pendingLeft && type==="player"`、`slog()` 里 `pendingRight`。

## 流光动画五层（style.css 找 `ryu-` 前缀）

1. `ryu-shine` 高光扫过（探照灯光带，transform 驱动）
2. `ryu-breathe` 光晕呼吸（text-shadow 辉光）
3. `vline-flow`/`vline-grow` 评语竖线（渐变流动 + 入场长出来）
4. `ryu-spark` 金色粒子（名字两侧 ✦）
5. `ryu-burst`/`ryu-ring` 银簪晋升徽章弹跳+光环

纪律：**新增动画只动 transform/opacity**（GPU 合成，不掉帧），别用高频 background-position 循环。

## 维护禁忌速查

- 余味消费力 = 888，评语口癖保持小鱼风，名字带氪金框——这三样是 Cat 钦定
- tier 0 不出银簪图；银簪=星级语义别拆散
- extractComment 保持块解析；所有文本保持伪流式；分段滑块保持双侧
- 测试 47 全绿再提交；提交完 push 到 origin main
