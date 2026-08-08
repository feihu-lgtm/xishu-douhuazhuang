// 西蜀豆花庄 · AI 说书人（OpenAI 兼容端点，类酒馆接法；无 key 静默降级模板）
// 支持流式（SSE）输出与模型列表检索（GET /models）。
import { FLAVOR_BY_ID, FLAVORS, TECHNIQUES, TECHNIQUE_IDS, ING_BY_NAME, SNACKS, starLabel, CATEGORY_TASK_TYPES, EXPEDITION_TASK_TYPES } from "./data.js?v=v40";
import { NSFW_RULES, MODE_PRIMER_MESSAGES } from "./modePrimer.js";
import { CHECK_DIMS } from "./state.js?v=v40";

// ■ 黑方块模式：开启=强制注入 NSFW 规则+primer 消息（学 qucuo，默认开）
let nsfwOn = true;
export const setNsfw = (v) => { nsfwOn = !!v; };
export const getNsfw = () => nsfwOn;
const sysWithMode = (sys) => nsfwOn ? sys + "\n" + NSFW_RULES : sys;
const msgsWithMode = (system, user) =>
  nsfwOn
    ? [{ role: "system", content: system }, ...MODE_PRIMER_MESSAGES, { role: "user", content: user }]
    : [{ role: "system", content: system }, { role: "user", content: user }];
import { STYLE, tierGuide, tierOfScore, dishUser, snackUser, reactionUser, RYUWEI_VOICE, HEYUXIE_VOICE } from "./prompt.js?v=v40";
export { tierOfScore, tierGuide };

const CFG_KEY = "xiaochu-ai-v1";

export function loadCfg() {
  // 配置完全来自设置面板（endpoint/apiKey/model 都以 localStorage 为准），
  // 不预填任何厂商默认——避免旧存档里 endpoint 空串把请求打到 openai 上
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { stream: true, maxTokens: 65536, dishWords: 360, chatWords: 160, suWords: 300, snackWords: 300, tolPct: 15, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { endpoint: "", apiKey: "", model: "", stream: true, maxTokens: 65536, dishWords: 360, chatWords: 160, suWords: 300, snackWords: 300, tolPct: 15 };
}
export function saveCfg(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}
export function cfgReady(cfg) {
  return !!(cfg && cfg.apiKey && cfg.model);
}
export function streamOn(cfg) {
  return cfg.stream !== false;
}

// ── 行动 trace（学 qucuo actionTrace：出动作就记，AI 回复继续记，实时可见）──
const MAX_TRACE = 40;
const traceLog = [];
let currentTrace = null;
export function getTrace() { return traceLog; }
export function clearTrace() { traceLog.length = 0; }
export function fmtMs(ms) {
  if (ms == null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
// 行动开始即入列（_running），后续 step / AI 调用往里挂，结束 endTrace
export function startTrace(act) {
  const t = { ts: Date.now(), act, steps: [], pipelines: [], _running: true };
  traceLog.unshift(t);
  if (traceLog.length > MAX_TRACE) traceLog.length = MAX_TRACE;
  currentTrace = t;
  return t;
}
export function stepTrace(layer, status, detail) {
  if (currentTrace) currentTrace.steps.push({ layer, status, detail, at: Date.now() });
}
export function endTrace(summary) {
  if (!currentTrace) return;
  currentTrace._running = false;
  currentTrace.summary = summary || "";
  currentTrace.totalMs = Date.now() - currentTrace.ts;
  currentTrace = null;
}
// 每次 AI 调用把 完整注入(system+user)+回复 挂到当前行动
function pushTrace(e) {
  if (currentTrace) {
    currentTrace.pipelines.push(e);
    stepTrace(e.label, e.error ? "fail" : "pass", `${e.ms}ms${e.error ? " · " + e.error : ""}`);
  }
}

// ── 限流：直连 DeepSeek 官方 API 时 1 分钟最多 30 次、间隔 2.5s（防连点刷爆）──
const RATE_MAX = 30, RATE_WINDOW = 60000, RATE_GAP = 2500;
let callTimes = [];
export function rateState(now = Date.now()) {
  callTimes = callTimes.filter(t => now - t < RATE_WINDOW);
  const used = callTimes.length;
  let wait = 0;
  if (used >= RATE_MAX) wait = RATE_WINDOW - (now - callTimes[0]);
  else if (used > 0) wait = Math.max(0, RATE_GAP - (now - callTimes[used - 1]));
  return { used, wait: Math.max(0, wait) };
}
// 5 个点：实心=已用，空心=可用
export function rateDots(now = Date.now()) {
  const { used } = rateState(now);
  return Array.from({ length: RATE_MAX }, (_, i) => i < used);
}
async function throttle() {
  for (;;) {
    const { wait } = rateState();
    if (wait <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(wait, 500) + 50));
  }
  callTimes.push(Date.now());
}

// 地址归一：/v1 补 chat/completions；已带路径原样（学 qucuo apiConfig 的稳妥推导）
export function normalizeEndpoint(url) {
  url = (url || "").trim().replace(/\/+$/, "");
  if (!url) return "https://api.openai.com/v1/chat/completions";
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1")) return url + "/chat/completions";
  return url + "/v1/chat/completions";
}

// /models 的 base：砍掉 chat/completions 尾巴；裸域名补 /v1
export function baseForModels(url) {
  url = (url || "").trim().replace(/\/+$/, "");
  if (!url) return "https://api.openai.com/v1";
  url = url.replace(/\/chat\/completions$/, "");
  if (/\/v1(beta)?$/.test(url) || /\/v1\//.test(url)) return url;
  return url + "/v1";
}

export async function listModels(cfg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(baseForModels(cfg.endpoint) + "/models", {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const ids = (j.data || []).map(m => m.id).filter(Boolean).sort();
    if (!ids.length) throw new Error("列表为空");
    return ids;
  } finally {
    clearTimeout(timer);
  }
}

// max_tokens 默认 65536（Gemini 3 flash 等思考型模型别给太大，思考会吞预算），设置里可调（厂商报错就调小）
// timeoutMs：调用级覆盖；默认 cfg.timeoutMs 或 120s（探秘等大叙事给更长，见调用点）
// skipMode：true 时跳过 ■NSFW 注入（探秘等纯叙事调用不需要色情规则，也免得拖慢/污染输出）
export async function callAI(cfg, system, user, label, timeoutMs, skipMode) {
  // 统一走流式（SSE）：ggchan 等反代对非流式支持差/慢，流式快且稳；返回全文，语义与非流式一致
  return callAIStream(cfg, system, user, () => {}, label, timeoutMs, skipMode);
}

// 流式调用：SSE data: 行，逐块回调 onChunk，返回全文
export async function callAIStream(cfg, system, user, onChunk, label, timeoutMs, skipMode) {
  await throttle();
  const t0 = Date.now();
  const ctrl = new AbortController();
  const ms = timeoutMs || cfg.timeoutMs || 120000;
  // 超时：abort 后某些浏览器 fetch 的 reader 不 resolve——用 race 强制断（拿已收部分再抛超时）
  let aborted = false, abortTimer;
  const abortP = new Promise(res => {
    abortTimer = setTimeout(() => { ctrl.abort(); aborted = true; res("abort"); }, ms);
    if (abortTimer.unref) abortTimer.unref();
  });
  try {
    const res = await fetch(normalizeEndpoint(cfg.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.9,
        max_tokens: cfg.maxTokens || 65536,
        stream: true,
        messages: skipMode
          ? [{ role: "system", content: system }, { role: "user", content: user }]
          : msgsWithMode(sysWithMode(system), user),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    const eat = (line) => {
      line = line.trim();
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content
          ?? j.choices?.[0]?.message?.content ?? "";
        if (delta) { full += delta; onChunk(delta); }
      } catch { /* 半截 JSON，等下一块 */ }
    };
    for (;;) {
      // reader.read() 可能因上游挂起永不 resolve——与超时 abort 竞争，超时即断
      const outcome = await Promise.race([
        reader.read().then(v => ({ v })),
        abortP.then(() => "abort"),
      ]);
      if (outcome === "abort") break;
      const { done, value } = outcome.v;
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        eat(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
    eat(buf); // 收尾：最后一行可能不带换行
    if (aborted) throw new Error(`上游响应超时（${Math.round(ms / 1000)}s 未返回）`);
    pushTrace({ ts: t0, label: label || "流式", system, user, response: full, ms: Date.now() - t0 });
    return full;
  } catch (e) {
    const err = e?.name === "AbortError" ? new Error(`上游响应超时（${Math.round(ms / 1000)}s 未返回）`) : e;
    pushTrace({ ts: t0, label: label || "流式", system, user, response: "", error: err.message, ms: Date.now() - t0 });
    throw err;
  } finally {
    clearTimeout(abortTimer);
  }
}

// JSON 解析 + 截断救援（兜底：模型不听话输出 JSON 时也能救）
export function parseJSONRescue(text) {
  let t = (text || "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/m, "").trim();
  const first = t.indexOf("{");
  if (first < 0) return {};
  const body = t.slice(first);
  const last = body.lastIndexOf("}");
  if (last > 0) {
    try { return JSON.parse(body.slice(0, last + 1)); } catch { /* fallthrough */ }
  }
  const get = (k) => {
    const m = body.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`));
    return m ? m[1] : "";
  };
  return { name: get("name"), prose: get("prose"), say: get("say") };
}

// 出菜文本解析：优先 JSON 救援，否则「菜名：」行 + 其余正文
export function parseDishText(t, ctx) {
  if (!t || !t.trim()) return null;
  const { main, comment, mood, menu } = extractComment(t);
  if (main.includes("{")) {
    const o = parseJSONRescue(main);
    if (o.prose) return { name: o.name || fallbackDishName(ctx), prose: o.prose, comment, mood: moodIndex(mood), menu };
  }
  const m = main.match(/菜名[：:]\s*「?([^」\n]+)」?/);
  const nl = main.indexOf("\n");
  let prose = nl >= 0 ? main.slice(nl + 1) : "";
  prose = prose.replace(/^\s*正文[：:]\s*/, "").trim();
  if (!prose) return null;
  return { name: (m && m[1].trim()) || fallbackDishName(ctx), prose, comment, mood: moodIndex(mood), menu };
}

// ── 体例（所有说书人调用共用）─────────────────────────────────────────
// 身份+文风基座（STYLE）、篇幅/档位/分块编排 均在 prompt.js。

// ── 八个心情 → 八个表情 ───────────────────────────────────────────────
export const MOOD_WORDS = ["开心", "悠闲", "兴奋", "心动", "得意", "不满", "吃惊", "专注"];
const MOOD_SYN = [
  ["开心", "高兴", "愉快", "欢喜", "咧嘴", "笑"],
  ["悠闲", "比耶", "俏皮", "轻松", "玩", "闲"],
  ["兴奋", "激动", "期待", "雀跃"],
  ["心动", "害羞", "感动", "喜欢", "心软"],
  ["得意", "骄傲", "自得", "神气"],
  ["不满", "哼", "嫌弃", "撇嘴", "气", "嘟"],
  ["吃惊", "惊讶", "吓", "愣"],
  ["专注", "认真", "专心", "搅", "忙"],
];
export function moodIndex(word) {
  if (!word) return null;
  const i = MOOD_WORDS.findIndex(w => word.includes(w));
  if (i >= 0) return i;
  for (let k = 0; k < MOOD_SYN.length; k++)
    if (MOOD_SYN[k].some(w => word.includes(w))) return k;
  return null;
}

// 拆出「苏唐批：」「心情：」「菜单：」「纸条：」结构块（宽容版）：
// 标记可在行首、也可跟在正文同行（AI 常写「……苏唐批：xxx」）；苏唐批可跨行直到
// 下一个标记或结尾，心情/菜单/纸条取单行；其余文字归 main
export function extractComment(t) {
  let s = (t || "");
  const out = { comment: "", mood: "", menu: "", note: "", wish: "" };
  // 心愿行（AI 在行首写「心愿：」）：纯字符串剥离，不用正则；心愿由 AI 判断提取
  const lines = s.split("\n");
  const wi = lines.findIndex(l => l.trim().startsWith("心愿：") || l.trim().startsWith("心愿:"));
  if (wi >= 0) {
    out.wish = lines[wi].trim().slice(3).trim();
    lines.splice(wi, 1);
    s = lines.join("\n");
  }
  const LABEL = /(?:^|[，。！？…\s])[ \t]*(苏唐批|心情|菜单|纸条)[：:][ \t]*/;
  const CM = new RegExp(LABEL.source + "([\\s\\S]*?)(?=" + "(?:^|[，。！？…\\s])[ \\t]*(?:苏唐批|心情|菜单|纸条)[：:]|$)", "g");
  const ONE = /(?:^|[，。！？…\s])[ \t]*(心情|菜单|纸条)[：:][ \t]*([^\n]+)/g;
  let m;
  while ((m = CM.exec(s))) if (m[1] === "苏唐批") out.comment = m[2].trim();
  while ((m = ONE.exec(s))) {
    if (m[1] === "心情") out.mood = m[2].trim();
    else if (m[1] === "菜单") out.menu = m[2].trim();
    else if (m[1] === "纸条") out.note = m[2].trim();
  }
  return { main: s.replace(CM, "").replace(ONE, "").trim(), comment: out.comment, mood: out.mood, menu: out.menu, note: out.note, wish: out.wish };
}

// ── 第一轮·武学裁决：看食材/技法/意图，判练到哪几门功、配合几分 ─────────
export function parseMartial(t) {
  if (!t) return null;
  const o = t.includes("{") ? parseJSONRescue(t) : {};
  let ext = Array.isArray(o.external) ? o.external : [];
  ext = ext.filter(x => ["刀法", "剑法", "拳掌", "枪法", "投掷", "轻功"].includes(x)).slice(0, 3);
  const internal = o.internal === true || o.internal === "true";
  let syn = parseInt(o.synergy, 10);
  if (!Number.isFinite(syn)) syn = 60;
  syn = Math.max(0, Math.min(100, syn));
  if (!ext.length && !o.internal) return null;
  return { external: ext, internal, synergy: syn };
}

export async function genMartial(cfg, ctx) {
  if (cfgReady(cfg)) {
    const user = [
      `小厨开火做菜。食材：${ctx.materials.join("、")}`,
      `技法：${ctx.technique}。炊具：${ctx.cookware.name}。`,
      `小厨打算做：${ctx.intended || "（没说，自己看着办）"}`,
      `请判断这套动作真正练到哪几门外功（从 刀法/剑法/拳掌/枪法/棍法/斧法/腿法/指爪/投掷/轻功 里选 1-3 个，贴合切配、翻锅、火候、身法），`,
      `internal 判断要不要运内功（true/false），synergy 给这组食材搭配做这道菜的合理度 0-100。`,
      `只输出 JSON：{"external":[...],"internal":bool,"synergy":n}`,
    ].join("\n");
    try {
      const raw = await callAI(cfg, "你是武学裁判，懂厨也懂武。只输出 JSON，不要多余文字。", user, "武学裁决");
      const o = parseMartial(raw);
      if (o) return { ...o, ai: true };
    } catch { /* 降级 */ }
  }
  return { external: ["刀法", "拳掌"], internal: true, synergy: ctx.recipe ? 90 : 60, ai: false };
}

// ── 出菜叙事（第二轮）─────────────────────────────────────────────────
const DISH_SYS = STYLE + "\n严格按指定格式输出，禁止多余内容。";

export async function genDish(cfg, ctx, onChunk) {
  if (cfgReady(cfg)) {
    const userText = dishUser({ ...ctx, words: cfg.dishWords || 360, tol: cfg.tolPct ?? 15 });
    const t0 = Date.now();
    try {
      const raw = streamOn(cfg) && onChunk
        ? await callAIStream(cfg, DISH_SYS, userText, onChunk, "出菜")
        : await callAI(cfg, DISH_SYS, userText, "出菜");
      const ms = Date.now() - t0;
      const obj = parseDishText(raw, ctx);
      if (obj) return { ...obj, ms, ai: true };
    } catch { /* 降级 */ }
  }
  return fallbackDish(ctx);
}

export function fallbackDishName(ctx) {
  if (ctx.recipeName) return ctx.recipeName;
  const main = ctx.materials.find(m => ING_BY_NAME[m]?.kind === "食材") || ctx.materials[0];
  const fl = ctx.flavorId ? FLAVOR_BY_ID[ctx.flavorId].name : "";
  return `${fl}${ctx.technique}${main}`;
}

const FALLBACK_COMMENTS = [
  ["师兄这火候，今日算过关，我如实记。", 0],
  ["嗯……咸了半口。下回盐罐子我来递。", 5],
  ["香得我多添了半勺，锅底的别刮走。", 3],
  ["我在边上画了个小灶，灶边那个抹汗的是师兄。", 4],
];

export function menuDescOf(ctx, name) {
  const fl = ctx.flavorId ? FLAVOR_BY_ID[ctx.flavorId] : null;
  return `${name}：以${ctx.materials.join("、")}入馔，用「${ctx.technique}」法，${fl ? fl.label : "家常滋味"}，火候到位，香气扑鼻。`;
}
export function fallbackDish(ctx) {
  const name = fallbackDishName(ctx);
  const fl = ctx.flavorId ? FLAVOR_BY_ID[ctx.flavorId] : null;
  const prose =
    `师兄把${ctx.materials.join("、")}下了锅，${TECHNIQUES[ctx.technique].desc}` +
    `苏唐在灶边添柴，${ctx.cookware.name}用得顺手。火候到了，${fl ? `调出一味「${fl.name}」——${fl.label}。` : "家常滋味，胜在踏实。"}` +
    `「${name}」出锅，香气从灶房一直飘到村口。`;
  const [comment, mood] = FALLBACK_COMMENTS[Math.floor(Math.random() * FALLBACK_COMMENTS.length)];
  return { name, prose, comment, mood, menu: menuDescOf(ctx, name), ai: false };
}

// ── 客人反应（只输出客人说的话，流式直接上屏）─────────────────────────
const TIER_DESC = ["赞不绝口", "满意", "觉得一般", "不太满意"];
const TIER_SAY = [
  ["好手艺！这味正，跟我惦记的一模一样。", "筷子没停过，碗底见空才抬头。"],
  ["不错，吃得舒坦。", "吃得干净，抹了抹嘴。"],
  ["嗯……还行吧，差点意思。", "吃了一半，放下筷子。"],
  ["这……不是我想吃的那个味。", "扒了两口，不再动筷。"],
];

export function parseSayText(t) {
  if (!t || !t.trim()) return null;
  if (t.includes("{")) {
    const o = parseJSONRescue(t);
    if (o.say) return o.say;
  }
  let line = t.trim().split("\n")[0].trim();
  line = line.replace(/^客人[：:]\s*/, "").replace(/^「|」$/g, "").trim();
  return line || null;
}

// 拆客人的话 + 末尾「心情：」（苏唐旁观的心情）
export function splitSayMood(t) {
  let s = (t || "");
  let mood = "";
  const mm = s.match(/\n?[ \t]*心情[：:][ \t]*([^\n]+)/);
  if (mm) { mood = mm[1].trim(); s = s.replace(mm[0], ""); }
  return { say: parseSayText(s), mood };
}

export async function genReaction(cfg, ctx, onChunk) {
  if (cfgReady(cfg)) {
    const user = reactionUser({ ...ctx, tierDesc: TIER_DESC[ctx.tier] });
    const t0 = Date.now();
    try {
      const sys = STYLE + "\n现在写出餐品尝场景。";
      const raw = streamOn(cfg) && onChunk
        ? await callAIStream(cfg, sys, user, onChunk, "客人品尝")
        : await callAI(cfg, sys, user, "客人品尝");
      const ms = Date.now() - t0;
      const { mood } = splitSayMood(raw);
      return { mood: moodIndex(mood), ms, ai: true };
    } catch { /* 降级 */ }
  }
  return { mood: null, ms: null, ai: false, scene: fallbackScene(ctx) };
}

function fallbackScene(ctx) {
  const g = ctx.guest;
  const snack = ctx.snackName ? `又尝了口「${ctx.snackName}」，神色稍缓。` : "";
  const react = [
    `「这味正，合我意。」${g.name} 筷子没停，碗底见空。`,
    `「还行，吃得舒坦。」${g.name} 抹了抹嘴。`,
    `「差点意思。」${g.name} 吃了一半便放下筷子。`,
    `「不是我想吃的那个味。」${g.name} 扒了两口，不再动筷。`,
  ][ctx.tier] || "";
  return `${g.name} 先尝了口「${ctx.dishName}」，${snack}${react}`;
}

// ── 苏唐备小吃（玩家只口述，做什么/用料/几份/品质全凭她）──────────────
export function parseSnack(t, ctx) {
  if (!t) return null;
  const o = t.includes("{") ? parseJSONRescue(t) : {};
  if (!o.made && !o.say) return null;
  const made = o.made || "苏唐小吃";
  let used = Array.isArray(o.used) ? o.used : [];
  used = used.filter(n => (ctx.inv[n] || 0) > 0);
  let portions = parseInt(o.portions, 10);
  if (!Number.isFinite(portions)) portions = 3;
  portions = Math.max(1, Math.min(6, portions));
  let q = parseInt(o.quality, 10);
  if (!Number.isFinite(q)) q = 60;
  q = Math.max(0, Math.min(100, q));
  const fl = FLAVORS.find(f => f.name === (o.flavor || "")) || null;
  return { made, used, portions, quality: q, say: o.say || "……", mood: o.mood || "", cat: o.cat || "小吃", desc: o.desc || "", proc: o.proc || "", note: o.note || "", flavor: fl ? fl.id : null };
}

const SU_SNACK_SYS = "你是苏唐，西蜀豆花庄的师妹，红衣汉服，手艺好。你是店家，对顾客要客气热情、招呼周到；对师兄则调情撒娇、逗他嗔他带甜，绝不责备。小剧情分 3-5 个自然段、段间空一行；对话用「」（不要用“”），心理用 *...*。先写小剧情，再输出 JSON。";
export async function genSnack(cfg, ctx) {
  if (cfgReady(cfg)) {
    const starOfN = (n) => (ctx.stars && ctx.stars[n]) || 0;
    const invStr = Object.entries(ctx.inv).map(([n, c]) => `${n}${starOfN(n) ? "★".repeat(starOfN(n)) : ""}×${c}`).join("、") || "（没有）";
    const user = snackUser({ ...ctx, invStr, words: ctx.words || cfg.snackWords || 300 });
    try {
      const raw = await callAI(cfg, SU_SNACK_SYS, user, "苏唐备小吃");
      const o = parseSnack(raw, ctx);
      let narrative = (raw || "").trim();
      const ji = narrative.indexOf("{");
      if (ji >= 0) narrative = narrative.slice(0, ji).trim();
      if (o) return { ...o, narrative, ai: true };
    } catch { /* 降级 */ }
  }
  return fallbackSnack(ctx);
}

function fallbackSnack(ctx) {
  const req = ctx.request || "";
  const hit = SNACKS.find(s => req.includes(s.name))
    || (req.includes("甜") ? SNACKS.find(s => s.cat === "点心") : null)
    || (req.includes("汤") ? SNACKS.find(s => s.cat === "汤") : null)
    || (req.includes("串") ? SNACKS.find(s => s.cat === "串") : null)
    || SNACKS[Math.floor(Math.random() * SNACKS.length)];
  const used = Object.keys(ctx.inv).slice(0, 2);
  const says = [
    "就这些料？行吧，凑合做，不好吃别赖我。",
    "师兄躲开点，油星子可不长眼。",
    "这锅我掌着，你忙你的去。",
  ];
  return {
    made: hit.name, cat: hit.cat, used,
    portions: 2 + Math.floor(Math.random() * 3),
    quality: 55 + Math.floor(Math.random() * 20),
    desc: `${hit.name}：以${used.join("、") || "手头现成"}做成，${hit.cat}类小食，苏唐手作，火候与调味全凭她心意。`,
    proc: `苏唐把${used.join("、") || "手头现成"}归置到案上，刀下手利落，火候拿捏得稳，不一会儿「${hit.name}」就出了锅。`,
    say: says[Math.floor(Math.random() * says.length)],
    mood: "专注", ai: false,
    narrative: `苏唐把${used.join("、") || "手头现成"}归置到案上，朝客人笑了笑：「稍等，这就来。」刀下手利落，火候拿捏得稳，不一会儿「${hit.name}」出了锅，香气扑鼻。`,
    flavor: req.includes("甜") ? "tian" : req.includes("酸") ? "suanla" : req.includes("辣") ? "mala" : (hit.cat === "点心" ? "tian" : "xianxiang"),
  };
}

// ── 副本·探秘（轻度武侠，统一主叙事文风：第三人称师兄/苏唐+苏唐批）──
// 探秘三步走 · 第一步：主叙事（500字）+ 预判收获 special（出题/结算各自单独调用）
export async function genExpedition(cfg, ctx) {
  const c = { ...cfg, maxTokens: Math.max(cfg.maxTokens || 0, 4096) };
  if (cfgReady(cfg)) {
    const user = [
      ctx.context ? `【上下文】\n${ctx.context}` : "",
      ctx.intent
        ? `【玩家钦定主线】${ctx.intent}。这是此行唯一主线，凌驾于一切预设情节之上——情节、细节、关口、收获全部围绕它展开；不许另起剧情脉络、不许淡化、不许忽略，你只负责把玩家钦定的方向写成好故事。`
        : "",
      ctx.calendarStrong
        ? `【节庆背景·强关联】今日正值${ctx.calendarStrong}。这是此行的背景底色，据点性质与节庆高度相关——narrative、special 收获都要紧扣这个节庆真实展开的活动来写，不可当成无关的寻常探秘${ctx.intent ? "（玩家另有钦定主线时，节庆仍作背景铺陈，情节主干仍以玩家主线为准）" : ""}。`
        : "",
      ctx.calendarMention
        ? `【时节】${ctx.calendarMention}。可在细节里带一两笔应景描写（天气、吃食、村人闲谈），不必展开，不可喧宾夺主，主体仍按今次情境走。`
        : "",
      `今次的情境是：${ctx.scenario}。情境只是背景底色，玩家钦定主线存在时以玩家主线为准。`,
      ctx.rescueTarget
        ? `【同行】${ctx.rescueTarget.name}（${ctx.rescueTarget.ident}，与师兄好感${ctx.rescueTarget.aff}${ctx.rescueTarget.aff <= 5 ? "，几乎是陌生人，别写成老相识那样熟络" : ""}）这趟一起在场。${ctx.rescueTarget.name === "余味" ? RYUWEI_VOICE : ctx.rescueTarget.name === "何雨谢" ? HEYUXIE_VOICE : ""}`
        : "",
      ctx.guestList && ctx.guestList.length
        ? `【此地常客】${ctx.guestList.map(g => `${g.name}（${g.gender === "女" ? "她" : "他"}，好感${g.aff}${g.mem ? `，记得「${g.mem}」` : "，还不熟"}${g.ryuwei ? `；余味是峨眉破戒的女侠食评人，年轻姑娘，一律用「她」，别称前辈/大哥/兄台；${RYUWEI_VOICE}` : ""}${g.heyuxie ? `；何雨谢是雪山派掌门师母、守寡的寡妇，温声细语持重体面；${HEYUXIE_VOICE}` : ""}${g.lore ? `；${g.lore}` : ""}${g.wu ? `，武功${g.wu}` : ""}${g.koupi ? `，口癖「${g.koupi}」` : ""}）`).join("；")}。好感≥40 的常客愿意搭把手（带路/递料/保料），好感≥60 的肯把压箱底的好料让给你；剧情里自然地勾连他们，别生硬。`
        : "",
      `师兄（武功约 ${ctx.skillAvg}、凭平日见识与智慧）与苏唐（手艺 ${ctx.suAvg}）同行，寻稀有食材。`,
      `只输出一个 JSON：{"narrative":"约500字（±10%）第三人称主叙事，3-5段，师兄化解阻碍、苏唐辨认得手，穿插「」对话与*心理*，收尾回店","comment":"苏唐批一句","mood":"八个心情词之一(开心/悠闲/兴奋/心动/得意/不满/吃惊/专注)","special":[{"name":"高级带星食材名，武侠/市井感","stars":1-3,"desc":"一句"}]}`,
      `special 给 1-2 种，种类要多样：肉/河鲜/野果/药材/菌菇/酒/主食等都要有机会，别全是药材菌菇。全部放进同一个 JSON 对象，不要 JSON 之外的多余文字。`,
    ].filter(Boolean).join("\n");
    const t0 = Date.now();
    try {
      const raw = await callAI(c, "你是探秘总编排：输出主叙事与收获。只输出 JSON，不写多余文字。", user, "探秘", 180000, true);
      const o = parseJSONRescue(raw);
      const narrative = (o.narrative || "").trim();
      if (narrative) {
        let special = Array.isArray(o.special) ? o.special : [];
        special = special.filter(s => s && s.name).map(s => ({
          name: s.name, stars: Math.max(1, Math.min(3, parseInt(s.stars, 10) || 2)), desc: s.desc || "",
        }));
        return {
          narrative,
          comment: (o.comment || "").trim(),
          mood: moodIndex(o.mood),
          special,
          ms: Date.now() - t0, ai: true,
        };
      }
    } catch { /* 降级 */ }
  }
  return {
    narrative: "师兄与苏唐深入险地，凭一身武功与苏唐的眼力，觅得几样罕见食材，满载而归。",
    comment: "师兄腿脚还行，就是话少。", mood: 4,
    special: [], ai: false,
  };
}

// 探秘三步走 · 第二步：出题（独立调用，叙事后单独给关卡题干+选项）
export async function genChallenge(cfg, ctx) {
  const pool = challengeDims(ctx.category);
  const ta = ctx.rescueTarget ? (ctx.rescueTarget.gender === "女" ? "她" : "他") : "";
  if (cfgReady(cfg)) {
    const sys = "你是探秘总编排，出关卡。只输出 JSON，不写多余文字。";
    const user = [
      `【情境】${ctx.scenario}`,
      `【背景】${ctx.background || ""}`,
      ctx.intent ? `【玩家钦定主线】${ctx.intent}——关卡要贴合这条主线。` : "",
      ctx.rescueTarget ? `【同行】${ctx.rescueTarget.name}这趟在场，关卡可围绕${ta}可能身陷的风险设计——是"师兄这一手要护住${ta}"还是"${ta}自己反手救场"，成败留到玩家选了再定，题干只写悬念，别提前剧透。${ctx.rescueTarget.name === "余味" ? RYUWEI_VOICE : ctx.rescueTarget.name === "何雨谢" ? HEYUXIE_VOICE : ""}` : "",
      `可用维度池：${pool.join(" / ")}。`,
      `只输出一个 JSON：{"prompt":"约80-120字文学化题干，只写关口与悬而未决的处境，绝不写解法/维度名/成功率","options":[{"text":"玩家可选动作，8-20字，文学化，不写维度名/成功率","dim":"从可用维度池里选"}...]}`,
      `options 给 4-6 个，尽量覆盖不同路子：硬闯硬碰、巧取身法、细看辨认、上前搭话、押一把赌注等；题干与选项像小说正文，让玩家自己猜要考什么。`,
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, sys, user, "探秘出题", 45000, true); // 出题是小 JSON：45s 兜底 fallback，别让玩家干等
      const o = parseJSONRescue(raw);
      let opts = Array.isArray(o?.options) ? o.options : [];
      opts = opts.filter(x => x && x.text && RESOLVABLE_DIMS.includes(x.dim)).slice(0, 6);
      const prompt = (o?.prompt || "").trim();
      if (prompt && opts.length) return { prompt, options: opts, ai: true };
    } catch { /* 降级 */ }
  }
  return { prompt: fallbackChallengePrompt(pool), options: fallbackChallengeOpts(pool), ai: false };
}
function fallbackChallengePrompt(pool) {
  const d = pool[0];
  return CH_FALLBACK_PROMPTS[d] || CH_FALLBACK_PROMPTS.见识;
}
function fallbackChallengeOpts(pool) {
  return pool.slice(0, 3).map(d => ({ text: CH_FALLBACK_OPTS[d] || CH_FALLBACK_OPTS.见识, dim: d }));
}
// ── 探秘出题：叙事之后的一道「小考题」，玩家选维度骰检 ──────────────
// 维度池从 data.js 的权威数据推导：据点分类 → 任务类型 → 维度，覆盖全部可判定维度
// （骰子三围 见识/口才/赌博 + 属性四维 轻功/投掷/武艺/内功/胆识；眼力并入见识）。
// 题干永远文学化，不出现维度名。
const CHECK_DIM_MAP = { 眼力: "见识" };
// 可判定维度全集：骰子三围 + 属性四维（资源/苏唐 v1 不出题）
export const RESOLVABLE_DIMS = [...CHECK_DIMS, ...["轻功", "投掷", "武艺", "内功", "胆识"]];
const CH_FALLBACK_PROMPTS = {
  见识: "雾又厚了一层，脚边的痕迹半新不旧，分不清是走兽还是人来过；再往前一步，兴许就踩进了岔路。",
  口才: "守摊的老汉上下打量着你，话到嘴边又咽回去，像有什么想说，又等着你先开口。",
  赌博: "集市边支了个摊，摊主把骰盅在你面前晃了三晃，笑而不语——赢不赢，全看这一下。",
  轻功: "崖壁湿滑，落脚处只够半只脚掌，藤蔓在风里晃。",
  武艺: "道口横着一根拦路槊，来人抱臂而立，不言不语。",
  内功: "寒气从地底逼上来，呼出的气凝成白雾，越往里越刺骨。",
  胆识: "黑窟窿里的风呜呜作响，深不见底，看不见尽头的路在脚边分岔。",
};
const CH_FALLBACK_OPTS = {
  见识: "蹲下细看，辨个分明", 口才: "上前搭话，套个虚实", 赌博: "押一把，赌它个运气",
  轻功: "借力腾身，涉险而过", 武艺: "拔刀，正面硬闯", 内功: "运起内功，硬抗过去", 胆识: "稳住心神，不露怯意",
};
export function challengeDims(category) {
  const taskTypes = CATEGORY_TASK_TYPES[category] || [];
  const seen = new Set();
  const out = [];
  for (const t of taskTypes) {
    for (const d of (EXPEDITION_TASK_TYPES[t]?.dims || [])) {
      const dim = CHECK_DIM_MAP[d] || d;
      if (RESOLVABLE_DIMS.includes(dim) && !seen.has(dim)) { seen.add(dim); out.push(dim); }
    }
  }
  return out.length ? out : [...CHECK_DIMS];
}

// ── 探秘结算：玩家选定后，生成该选项约500字的完整收尾叙事，回扣背景 ──
// 多选项时无法预生成全部 pass/fail 各500字，改为选中再写，保证剧情厚度。
export async function genSettlement(cfg, ctx) {
  const c = { ...cfg, maxTokens: Math.max(cfg.maxTokens || 0, 4096) }; // 500字+别截断
  if (cfgReady(cfg)) {
    const user = [
      ctx.background ? `【来龙去脉】\n${ctx.background}` : "",
      `【关口】\n${ctx.prompt}`,
      `师兄选了「${ctx.choice}」，以${ctx.dim}化解。`,
      `结果：${ctx.ok ? "成了" : "没成"}。`,
      ctx.special ? `此行收成：${ctx.special}。` : "",
      ctx.rescueName
        ? (ctx.ok
            ? `这一手是护住了同行的${ctx.rescueName}——写出${ctx.rescueShe ? "英雄救美的高光，但别落公主抱那种俗套" : "侠义救场的高光，干净利落"}，给点新意与分寸感。${ctx.rescueName === "余味" ? RYUWEI_VOICE : ctx.rescueName === "何雨谢" ? HEYUXIE_VOICE : ""}`
            : `这一手没成，反倒是${ctx.rescueName}眼疾手快救场/扶住了师兄——${ctx.rescueShe ? "美救英雄，她的干练果决要写出来" : "他反手救场，那份利落果决要写出来"}，师兄可以嘴上讨饶或事后打趣，别写得太狼狈失了体面。${ctx.rescueName === "余味" ? RYUWEI_VOICE : ctx.rescueName === "何雨谢" ? HEYUXIE_VOICE : ""}`)
        : "",
      `写约 500 字（±10%）、2-4 段的第三人称收尾叙事：交代这一手如何奏效/如何落空，务必回扣【来龙去脉】里的具体细节（雾、石、摊、人言等），自然带出收成——${ctx.ok ? "此次手到擒来，收成丰硕" : "此番失手，收成潦草"}。用「」对话与 *心理*。`,
      `只输出正文本身，不要旁白总结，不要「心情：」「苏唐批：」。`,
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(c, STYLE + "\n你是探秘收尾官，只输出正文。", user, "探秘结算", 180000, true);
      const t = (raw || "").trim();
      if (t) return { text: t, ai: true };
    } catch { /* 降级 */ }
  }
  return { text: "", ai: false };
}

// ── 新客生成：AI 生成一位新顾客，加入 st.customGuests 池（日后可能被抽到）──
export async function genNewGuest(cfg) {
  if (cfgReady(cfg)) {
    const flavorList = FLAVORS.map(f => `${f.name}(${f.id})`).join("/");
    const techList = TECHNIQUE_IDS.join("/");
    const ingNames = INGREDIENTS.map(i => i.name).join("、");
    const user = [
      `【背景】鱼定村「西蜀豆花庄」门口来了个陌生客人。`,
      `只输出 JSON：{"name":"名字（2-3字，带村味）","gender":"女或男","ident":"身份一句","spend":20-90整数,"flavor":"从 ${flavorList} 里选一个","tech":"从 ${techList} 里选一个","fav":"从食材表里选一样，须一字不差：${ingNames}","order":"点菜时说的话，30字内，带口味偏好"}`,
    ].join("\n");
    try {
      const raw = await callAI(cfg, "你是新客生成官，只输出 JSON，不写多余文字。", user, "新客", 60000, true);
      const o = parseJSONRescue(raw);
      const name = (o.name || "").trim();
      if (name && FLAVOR_BY_ID[o.flavor] && TECHNIQUES[o.tech]) {
        return {
          id: "cg_" + Date.now(),
          name,
          gender: o.gender === "女" ? "女" : "男",
          ident: (o.ident || "路过的客人").trim(),
          spend: Math.max(10, Math.min(120, parseInt(o.spend, 10) || 30)),
          flavor: o.flavor,
          tech: o.tech,
          fav: ING_BY_NAME[o.fav] ? o.fav : null,
          order: (o.order || "来份拿手的。").trim(),
          custom: true,
        };
      }
    } catch { /* 降级 */ }
  }
  return null;
}

// ── 苏唐 NSFW 表情映射（三套精灵图的 8 姿势帧序，见 assets/sutang_nsfw*.png）──
export const POSE_INDEX = { 脸红出汗: 0, 微微翻白眼: 1, 憋气: 2, 吐舌: 3, wink: 4, 嘟嘴: 5, 鼓气: 6, 娇羞比耶: 7 };
export function extractFace(t) {
  const m = (t || "").match(/表情[：:]\s*([^\n]+)/);
  return m ? m[1].trim() : "";
}

// ── 苏唐全包·主菜：苏唐看现有库存判断做什么，扣料出菜 ───────────────
export async function genSuCook(cfg, ctx) {
  if (cfgReady(cfg)) {
    const invStr = Object.entries(ctx.inv).filter(([, n]) => n > 0).map(([n, c]) => `${n}×${c}`).join("、") || "（没有）";
    const user = [
      ctx.context ? `【上下文】\n${ctx.context}` : "",
      `苏唐掌勺做主菜。现有食材：${invStr}。`,
      `已会技法：${ctx.techs.join("、")}。已会味型：${ctx.flavors.map(f => FLAVOR_BY_ID[f]?.name || f).join("、")}。`,
      `只输出 JSON：{"name":"菜名","materials":["从现有食材里选2-4样，须够数"],"technique":"从已会技法里选一个","flavor":"已会味型id或null","prose":"约300字苏唐手笔做菜小剧情，穿插「」对话与*心理*"}`,
    ].join("\n");
    try {
      const raw = await callAI(cfg, "你是苏唐，掌勺做主菜，只输出 JSON，不写多余文字。", user, "苏唐主菜", 120000, true);
      const o = parseJSONRescue(raw);
      const mats = (Array.isArray(o.materials) ? o.materials : []).filter(m => (ctx.inv[m] || 0) > 0).slice(0, 4);
      if (o.name && mats.length && ctx.techs.includes(o.technique)) {
        return {
          name: (o.name || "").trim(), materials: mats, technique: o.technique,
          flavor: ctx.flavors.includes(o.flavor) ? o.flavor : null,
          prose: (o.prose || "").trim(), ai: true,
        };
      }
    } catch { /* 降级 */ }
  }
  return null;
}

// ── 爆料生成：AI 按来由（踢馆者/女客）生成贴合场景的带星食材，避免固定池重复 ──
export async function genDropIngredient(cfg, ctx) {
  if (cfgReady(cfg)) {
    const user = [
      ctx.context ? `【来由】\n${ctx.context}` : "",
      `只输出 JSON：{"name":"带星食材名，贴合来由（武侠/市井感，别与商店常见食材重复）","stars":1-3,"desc":"一句"}`,
    ].join("\n");
    try {
      const raw = await callAI(cfg, "你是战利品生成官，只输出 JSON，不写多余文字。", user, "爆料", 60000, true);
      const o = parseJSONRescue(raw);
      if (o.name) return { name: (o.name || "").trim(), stars: Math.max(1, Math.min(3, parseInt(o.stars, 10) || 2)), desc: (o.desc || "").trim() };
    } catch { /* 降级 */ }
  }
  return null;
}

// ── 送礼剧情：新的一天，好感高的熟客托人送高级食材，像总评一样生成一段 ──
export async function genGifts(cfg, ctx) {
  if (cfgReady(cfg)) {
    const user = [
      ctx.givers ? `【送礼】${ctx.givers.map(g => `${g.name}（${g.ident}）送来「${g.gift.name}」（${g.gift.desc}）`).join("；")}` : "",
      `以日记笔法写一小段（2-3 段，约 200 字）：清晨开店前，这些熟客陆续托人/亲自送来心意，苏唐在旁边点评打趣。用「」对话与 *心理*，别写总结。`,
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, STYLE + "\n你是日记的笔，写送礼拜帖这段，只输出正文。", user, "送礼", 60000, true);
      const t = (raw || "").trim();
      if (t) return { text: t, ai: true };
    } catch { /* 降级 */ }
  }
  return { text: "", ai: false };
}

export async function genReview(cfg, ctx) {
  if (cfgReady(cfg)) {
    const lines = (ctx.dayLog || []).map(d => {
      const main = `主菜「${d.dish}」${d.mainBy === "苏唐" ? "是苏唐" : "是师兄"}做的，${d.mainScore ?? d.score}分`;
      const snack = d.snackName ? `；小吃「${d.snackName}」苏唐做的，${d.snackScore ?? "—"}分` : "";
      return `${d.name}那桌（点「${d.order}」）：${main}${snack}，${d.flavorMatch ? "口味对上了" : "口味偏了"}，总体${d.score}分。`;
    });
    const snackLines = (ctx.snacks || []).map(s => `苏唐自己做了「${s.name}」（品质${s.quality}）。`);
    const user = ["今日收工，逐客复盘（按上菜先后）：", ...lines,
      ...(snackLines.length ? ["今日苏唐做的小吃：", ...snackLines] : []),
      `请苏唐总评：按上菜先后一位位说，每位客人的主菜是师兄还是她做的、各多少分，她推测TA爱吃什么、谁做得更好；也评一评她自己今日做的小吃（得意/嫌弃/自省）。用苏唐口吻，分短段，嘴硬心软。`].join("\n");
    try {
      const raw = await callAI(cfg, "你是苏唐，西蜀豆花庄的师妹，红衣汉服，嘴硬心软，眼力好。只输出总评文字。", user, "苏唐总评");
      if (raw && raw.trim()) return { text: raw.trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { text: fallbackReview(ctx), ai: false };
}
function fallbackReview(ctx) {
  const dl = ctx.dayLog || [];
  const sn = ctx.snacks || [];
  if (!dl.length && !sn.length) return "【苏唐】今日没开张，锅都凉了，省柴。";
  const guest = dl.map(d => {
    const main = `主菜「${d.dish}」${d.mainBy === "苏唐" ? "我做的" : "你做的"}，${d.mainScore ?? d.score}分`;
    const snack = d.snackName ? `，我顺手的小吃「${d.snackName}」${d.snackScore ?? "—"}分` : "";
    return `【苏唐】${d.name} 那桌：${main}${snack}，${d.flavorMatch ? "口味对上了。" : "口味没对上，还得练。"}`;
  });
  const self = sn.map(s => `【苏唐】我自个儿的「${s.name}」，${s.quality >= 80 ? "火候拿捏得正好，得意。" : s.quality >= 60 ? "还成，下回更细些。" : "失手了，下回找补。"}`);
  return [...guest, ...self].join("\n");
}

// ── 自由闲聊（终端里跟说书人说话）────────────────────────────────────
const CHAT_FALLBACK = [
  ["灶膛里的火噼啪响了一声，算是回答。苏唐抬头看了师兄一眼，又低头擦碗。",
   "师兄有话就直说，汤还温着呢。", 1],
  ["苏唐把师兄这话记进日记，旁边画了个小火苗。",
   "记下了。收功之后再说，灶上还炖着。", 4],
  ["村口的狗叫了两声，又安静下去。",
   "师兄别跟狗聊天了，来帮我揉面。", 5],
  ["锅里汤还温着。师兄想做什么菜，说一声就是。",
   "说菜名就行，料我来递。", 0],
];
let chatIdx = 0;

// ── 酿造叙事：下坛/蒸馏时 AI 写苏唐酿酒的小剧情（数值系统判定，AI 不碰）──
export async function genBrew(cfg, brew) {
  if (cfgReady(cfg)) {
    const sys = "你是西蜀豆花庄的说书人。第三人称写苏唐酿酒的一段小剧情：蒸料、下曲、封坛（蒸馏酒则写甑锅里的火光与滴露），动作白描，带「」对话与 *心理*，有烟火气。分 2-3 段。";
    const user = `【酿酒】苏唐要酿「${brew.name}」：基底 ${brew.base}，曲用 ${brew.qu}${brew.extra && brew.extra.length ? `，辅料 ${brew.extra.join("、")}` : ""}。${brew.needsStill ? "这酒要上甑蒸馏——烧酒，打箭炉马帮带来的新法，蜀地人起初嫌烈。" : brew.kind === "黄酒" ? "黄酒讲究低温慢酵、陈酿数周，急不得。" : "封坛等它发酵，日子到了才开。"}`;
    try {
      const raw = await callAI(cfg, sys, user, "酿酒");
      return { prose: (raw || "").trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { prose: `苏唐把${brew.base}蒸透，拌进${brew.qu}，封了坛口，在坛沿画了道记号。`, ai: false };
}

// ── 擂台比武出题（两轮抉择，选项用武功维度，复用探秘的检定/结算链）──
export async function genDuel(cfg, ctx, onChunk) {
  if (cfgReady(cfg)) {
    const sys = "你是擂台判官，出比武关。只输出 JSON，不写多余文字。";
    const user = [
      `【对手】${ctx.foe}。${ctx.round === 2 ? "这是第二回合" : "第一回合"}。${ctx.stance || ""}`,
      ctx.background ? `【擂台】${ctx.background}` : "",
      `可用武功维度：刀法 / 剑法 / 拳掌 / 枪法 / 棍法 / 斧法 / 腿法 / 指爪 / 投掷 / 轻功 / 内功；智谋维度：见识 / 口才 / 胆识。`,
      `只输出一个 JSON：{"prompt":"50-90字文学化比武情景，写对手的招式与擂台局势，只写悬念不写解法","options":[{"text":"文学化动作，8-16字，点出用的武功（如：掣刀如电，劈开他刀势 / 双掌灌劲，硬撼其锋 / 弹指如爪，锁他腕脉 / 横扫一棍，荡开刀网）","dim":"从可用维度里选"}...]}`,
      `options 给 3-4 个：至少两个武功维度（刀法/剑法/拳掌/枪法/棍法/斧法/腿法/指爪/投掷/轻功/内功），可以有一个智谋维度（见识/口才/胆识）。写成小说正文，让玩家自己猜要考什么。`,
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, sys, user, "擂台出题", 45000, true);
      const o = parseJSONRescue(raw);
      const DIMS = ["刀法", "剑法", "拳掌", "枪法", "棍法", "斧法", "腿法", "指爪", "投掷", "轻功", "内功", "见识", "口才", "胆识"];
      let opts = Array.isArray(o?.options) ? o.options : [];
      opts = opts.filter(x => x && x.text && DIMS.includes(x.dim)).slice(0, 4);
      const prompt = (o?.prompt || "").trim();
      if (prompt && opts.length) return { prompt, options: opts, ai: true };
    } catch { /* 降级 */ }
  }
  const FALLBACKS = [
    { prompt: `${ctx.foe}刀光一卷，擂台上的尘土都扬了起来，这一刀是虚是实？`, options: [{ text: "掣刀如电，劈开他刀势", dim: "刀法" }, { text: "惊鸿掠影，绕背一击", dim: "轻功" }, { text: "观其刀路，寻隙而入", dim: "见识" }] },
    { prompt: `${ctx.foe}拳风虎虎，步步紧逼，擂台角落的旗杆被震得嗡嗡作响。`, options: [{ text: "金刚坐桩，以静制动", dim: "内功" }, { text: "双掌灌劲，硬撼其锋", dim: "拳掌" }, { text: "声东击西，诈败诱敌", dim: "胆识" }] },
  ];
  return { ...(FALLBACKS[(ctx.round || 1) - 1] || FALLBACKS[0]), ai: false };
}

// ── 瓦舍 · 说书/戏台：演出文本（AI 现场编，可点单）──
export async function genTheater(cfg, { kind, topic, world }) {
  if (cfgReady(cfg)) {
    const isStory = kind === "说书";
    const sys = isStory
      ? "你是西蜀豆花庄所在曲措乡的说书先生。用「话本」腔（且说…/正是：收尾）讲一段 250 字上下的江湖段子，素材要贴这方世界的人和事（豆花庄、余味、苏唐、探秘寻料、擂台比武都行）。只输出正文，不要标题旁白。"
      : "你是瓦舍戏班的班主。把这方世界近期的事唱成一场小戏（【生】【旦】【丑】对唱 + 念白），250 字上下，喜庆热闹。只输出唱词正文，不要旁白。";
    const user = [
      world ? `【这方世界近况】${world}` : "",
      topic ? `【点单】观众要听：${topic}` : "（观众没点单，你自己挑一段拿手的。）",
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, sys, user, kind === "说书" ? "说书" : "戏台", 60000, true);
      if (raw && raw.trim()) return { prose: raw.trim(), ai: true };
    } catch { /* 降级 */ }
  }
  const FALLBACK = isStory
    ? `且说那豆花庄的师兄，一身灶上功夫比刀剑还利落，今儿又给余味女侠治了一桌好菜。正是：灶火一燃天下暖，江湖谁不识豆花。`
    : `【生】提起那豆花庄，好菜飘香十里街——【旦】师兄勺下翻江海，苏唐手底起云霞——【丑】馋得我呀，口水淌了半条街！`;
  return { prose: FALLBACK, ai: false };
}
// ── 瓦舍 · 围炉夜话：篝火边多人互相接话的群聊（玩家可插话），酒后吐真言 ──
// 输出格式：每行「名字：说的话」一行一人，可夹不带名字的白描行；【真言】在末尾
export async function genWeiluChat(cfg, npcs, thread, input) {
  if (cfgReady(cfg) && npcs.length) {
    const sys = "你是《西蜀豆花庄》的围炉夜话群聊。篝火边几位熟人喝酒闲谈，互相接话、抢话、抬杠、碰碗（贴各人设；余味自称「奴家」称人「这位小哥」；何雨谢温声细语称人「这位小友」）。师兄也在火边。输出格式：每行「名字：说的话」，一行一人；可夹一行不带名字的白描（火堆/酒碗/风声）；一轮最多 3 行人物话 + 1 行白描。若有人酒后吐真言，末尾加一行「【真言】」+ 一句可传的江湖消息或可做的小事。";
    const user = [
      `在场：${npcs.map(n => `${n.name}（${n.ident}）`).join("、")}。`,
      thread ? `此前对话：\n${thread}` : "开场：人刚围着火坐下，酒碗还没递到第三个人。",
      input ? `师兄插话：「${input}」——写大家接住他的话。` : "",
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, sys, user, "围炉夜话", 60000, true);
      return { text: String(raw || "").trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { text: "", ai: false };
}

// ── 广场出现的 NPC：每周从角色池随机刷 2-4 位（有名有姓，能聊能交易）──
// 身份固定（游戏角色），来意/带货/想买的全 AI 现场编；数值系统钳制。
export async function genSquareFolks(cfg, npcs) {
  if (cfgReady(cfg) && npcs.length) {
    const sys = "你是《西蜀豆花庄》这方世界的广场布事官。这些角色本周出现在广场上——给每人编：带什么货卖（可带可不带，食材或江湖物件都行）、想从豆花庄买什么（可没有）、一句开场白。写的内容要贴人物身份。只输出 JSON 数组，不要多余文字。";
    const user = [
      "这些角色（id、名字、身份）：\n" + npcs.map(n => `${n.id}：${n.name}（${n.ident}）`).join("\n"),
      "输出（顺序一致）：[{\"id\":\"对应角色id\",\"sell\":[{\"name\":\"货物名\",\"desc\":\"一句\",\"price\":\"文价\",\"star\":\"1-3或省略\"}...]或[],\"want\":{\"name\":\"想买的东西（菜/小吃/酒/食材名）\",\"offer\":\"出价\"}或null,\"line\":\"开场白一句\"}]",
      "sell 别超 3 样；price 1-300 文；offer 1-300 文。",
    ].join("\n");
    try {
      const raw = await callAI(cfg, sys, user, "广场NPC", 45000, true);
      const o = parseJSONRescue(raw);
      if (Array.isArray(o)) {
        const byId = {};
        for (const f of o) if (f && f.id) byId[f.id] = f;
        const out = [];
        for (const n of npcs) {
          const f = byId[n.id] || {};
          out.push({
            npcId: n.id, name: n.name, ident: n.ident,
            sell: Array.isArray(f.sell) ? f.sell.filter(s => s && s.name).slice(0, 3).map(s => ({ name: String(s.name).slice(0, 14), desc: String(s.desc || "").slice(0, 24), price: Math.max(1, Math.min(300, Math.round(Number(s.price) || 15))), star: Math.max(1, Math.min(3, parseInt(s.star, 10) || 0)) })) : [],
            want: (f.want && f.want.name) ? { name: String(f.want.name).slice(0, 14), offer: Math.max(1, Math.min(300, Math.round(Number(f.want.offer) || 20))) } : null,
            line: String(f.line || "……").slice(0, 30),
          });
        }
        if (out.length) return out;
      }
    } catch { /* 降级 */ }
  }
  // 模板兜底（AI 挂了）：每人带 0-2 样货（随机池），want 随机
  const sellPool = [
    { name: "雪山野蜂蜜", desc: "崖上取的野蜜", price: 30, star: 1 },
    { name: "熊山松茸", desc: "松林里捡的鲜货", price: 45, star: 2 },
    { name: "怪石砚台", desc: "石纹如山水", price: 25, star: 0 },
    { name: "会唱曲的蛐蛐", desc: "叫起来有调儿", price: 15, star: 0 },
    { name: "旧话本一册", desc: "纸页泛黄", price: 12, star: 0 },
    { name: "豹胎膏", desc: "跌打良药", price: 35, star: 0 },
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return npcs.map(n => ({
    npcId: n.id, name: n.name, ident: n.ident,
    sell: Math.random() < 0.7 ? [1, 2].map(() => pick(sellPool)).filter((v, j, a) => a.findIndex(x => x.name === v.name) === j).slice(0, 1 + Math.floor(Math.random() * 2)) : [],
    want: Math.random() < 0.4 ? { name: pick(["清溪蜜酿绿豆羹", "玫瑰蜜醋煎饵块", "玉泉青稞酒", "龙须金砂糯"]), offer: 20 + Math.floor(Math.random() * 30) } : null,
    line: "（AI 未接线——她在广场上闲逛。）",
  }));
}

// ── 每周新鲜事生成（周初批量 roll 各地点事件卡，数值归系统）──
export async function genFreshEvents(cfg, locs) {
  if (cfgReady(cfg)) {
    const sys = "你是《西蜀豆花庄》这方世界的江湖布事官。给本周每个地点出「新鲜事」：一件能让玩家想去看看/聊聊/互动的事。有的地点可以无事（null）——不是每个地方每周都有大事。事件要像真江湖：市井生计、人情往来、小冲突、小热闹，别都搞成大灾大难。只输出 JSON 数组，不要多余文字。";
    const user = [
      `第 ${locs[0] ? "" : ""}周。以下地点：`,
      locs.map(l => `${l.id}：${l.name}——${l.desc}`).join("\n"),
      "输出 JSON 数组，元素对应每个地点（顺序一致）：{\"title\":\"新鲜事名，6-12字\",\"desc\":\"一句话描述，30字内\",\"npc\":\"相关人物名（可以是常客或路人）\",\"kind\":\"小买卖/人情/热闹/险情/宴席/比武之一\"}；无事的地点给 null。",
    ].filter(Boolean).join("\n");
    try {
      const raw = await callAI(cfg, sys, user, "周初新鲜事", 45000, true);
      const o = parseJSONRescue(raw);
      if (Array.isArray(o) && o.length === locs.length) return o;
    } catch { /* 降级 */ }
  }
  // 模板兜底：随机挑 2-3 个地点给事，其余无事
  const POOL = [
    { title: "街口新支了个馄饨摊", desc: "汤鲜馅大，摊主说想跟豆花庄换点酱料。", npc: "馄饨摊主", kind: "小买卖" },
    { title: "有戏班子过路", desc: "班子缺个打杂的，管一顿饭。", npc: "班主", kind: "热闹" },
    { title: "谁家的牛走丢了", desc: "牛信儿传得满街都是，找到有赏。", npc: "老李头", kind: "人情" },
    { title: "城西夜里闹动静", desc: "有人说是野物，有人说是贼。", npc: "更夫", kind: "险情" },
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chosen = [...locs].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
  return locs.map(l => chosen.includes(l) ? pick(POOL) : null);
}

// ── 地点互动流水线（学 jihaitang）：MAIN_TEXT 叙事流式 + SIDE_NOTE 结构化旁注 ──
// 说话改变量的骨架：AI 只写文字（MAIN_TEXT），数值全在 SIDE_NOTE JSON 里由系统结算。
export function extractMainText(raw) {
  if (!raw) return "";
  const m = String(raw).match(/<MAIN_TEXT>\s*([\s\S]*?)\s*<\/MAIN_TEXT>/);
  if (m) return m[1].trim();
  const s = String(raw).split("<SIDE_NOTE>")[0];
  return s.replace(/<\/?MAIN_TEXT>/g, "").trim();
}
export function extractSideNote(raw) {
  if (!raw) return null;
  const m = String(raw).match(/<SIDE_NOTE>\s*([\s\S]*?)\s*<\/SIDE_NOTE>/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[1]);
    return (o && typeof o === "object") ? o : null;
  } catch {
    // 容错（学 jihaitang json-repair）：从末尾往前找第一个能解析的完整对象
    const s = m[1];
    for (let i = s.length; i > 0; i--) {
      if (s[i - 1] === "}") {
        try { const o = JSON.parse(s.slice(0, i)); if (o && typeof o === "object") return o; } catch { /* continue */ }
      }
    }
    return null;
  }
}
export async function genLocChat(cfg, ctx, onChunk) {
  if (cfgReady(cfg)) {
    const sys = [
      STYLE,
      "你是《西蜀豆花庄》这方世界的互动说书人，写一段人物互动场景。",
      ctx.npc ? `【对方】${ctx.npc}` : "",
      ctx.loc ? `【地点】${ctx.loc}` : "",
      ctx.fresh ? `【今有新鲜事】${ctx.fresh}` : "",
      "【写法】第三人称写互动，带「」对话与 *心理*，2-3 段，收尾留余味。对方说话要贴人设（余味时刻自称「奴家」、称呼旁人「这位小哥」）。",
      "【输出格式】先输出 <MAIN_TEXT> 包裹的叙事正文；最后单独一行 <SIDE_NOTE> 包裹的 JSON：{\"aff\":{\"<对方名字>\":±1到3},\"coins\":±整数,\"fame\":±1到2,\"wish\":\"对方真说出口想吃的或null\",\"info\":\"可传遍街巷的江湖消息或null\",\"event\":{\"kind\":\"种类\",\"title\":\"事件名\",\"desc\":\"一句话\"}或null,\"mood\":\"八个心情词之一\"}。aff 的键必须用对方名字（如 余味），不是代号；数值克制：好感一回合最多±3；银钱别凭空暴富；wish 必须对方亲口说；info 要像街巷传言；event 只在聊出大事时给。",
    ].filter(Boolean).join("\n");
    const user = [
      ctx.thread ? `【此前对话】\n${ctx.thread}` : "",
      `【玩家说】${ctx.input}`,
    ].filter(Boolean).join("\n");
    try {
      let raw = "";
      let sideStarted = false;
      const h = (chunk) => {
        raw += chunk;
        if (sideStarted || !onChunk) return;
        const v = chunk.replace(/<MAIN_TEXT>/g, "").replace(/<\/MAIN_TEXT>/g, "");
        const idx = v.indexOf("<SIDE_NOTE>");
        if (idx >= 0) { sideStarted = true; onChunk(v.slice(0, idx)); return; }
        onChunk(v);
      };
      raw = await callAIStream(cfg, sys, user, h, "地点互动");
      const main = extractMainText(raw);
      return { main, note: extractSideNote(raw), raw, ai: true };
    } catch { /* 降级 */ }
  }
  return { main: "", note: null, raw: "", ai: false };
}

// ── 世界回响：每件事后的市井反应（话本/邸报/传闻/戏/说书/壁画）──
// 200 字左右，写这对侠侣（师兄+苏唐）的快意恩仇做菜故事，世界因他们而变；
// 结尾一行「纸条：」客观小结（进小纸条，夺舍现有小纸条流）
export async function genEcho(cfg, ctx) {
  const FORMS = ["话本", "邸报", "市井传闻", "戏文", "说书", "后世壁画"];
  const form = FORMS[Math.floor(Math.random() * FORMS.length)];
  if (cfgReady(cfg)) {    const sys = `你是《西蜀豆花庄》这方世界的回响笔官。用「${form}」文体写这段事件的市井反应，正文 200 字左右（±10%）：
文体特征——话本：「且说…」章回体，有「正是：」收尾；邸报：官府公报口吻（「西蜀豆花庄讯」），字句板正；市井传闻：街头巷尾的闲话，带人名的嚼舌根；戏文：【生】【旦】【丑】唱念做打，一句唱词一句念白；说书：醒木一拍，市井书场腔；后世壁画：百年后考据者对着壁画残片推测的记载。
写这对侠侣（师兄+苏唐）的快意恩仇做菜小故事，体现这方世界因为他们的变化；可带 NPC 客人的心理。写得有意思，别平铺直叙。这是公开流传的市井文字，只写烟火气与名声，不写私密暧昧。
结尾单独一行「纸条：」+ 一行客观小纸条（≤30字，供存档回看）。`;
    const user = `【事件】${ctx.event}\n【结果】${ctx.result}\n【世界】${ctx.world}`;
    try {
      const raw = await callAI(cfg, sys, user, "世界回响", 45000, true); // 回响是装饰性的：45s 超时，别拖主流程；skipMode 不注入 ■NSFW
      const { main, note } = extractComment(raw || "");
      return { prose: (main || (raw || "").trim()), note, form, ai: true };
    } catch { /* 降级 */ }
  }
  return { prose: `市井里有人说，${ctx.result}。`, note: (ctx.result || "").slice(0, 30), form, ai: false };
}

// ── 余味进场：苏唐迎接「又来了！」+ 状态（首次介绍/熟络/簪子期待）──
export async function genRyuweiEnter(cfg, ctx) {
  if (cfgReady(cfg)) {
    const sys = "你是西蜀豆花庄的苏唐，红衣汉服、灶边递料擦碗的师妹（这段是苏唐的笔迹，写右栏）。余味是峨眉破戒的女侠食评人——任性少女、口味刁钻、年轻一流高手，没架子，但给银簪很谨慎。她进店，你迎上去。以苏唐第一人称写迎接的话和心理：先来一句「又来了！」式的熟络话，高兴里带点紧张。对话用「」，心理用 *...*。分 2-3 段。" + RYUWEI_VOICE;
    const user = `【来客】余味（峨眉·品馔录人）进店。\n${ctx.ryuweiVisits === 0
      ? "这是她第一次来——借苏唐或旁白之口介绍她的来头：峨眉破戒的女侠，吃酒吃肉破了戒，但仍是峨眉系的一流高手；任性、口味刁钻，别叫她前辈。"
      : `她已经来过 ${ctx.ryuweiVisits} 次，跟店里熟络了——苏唐迎接带着高兴，又有点紧张（怕这次菜不够格）。`}\n${ctx.tier > 0
      ? `店里挂着余味送的 ${ctx.tier} 支银簪（一支=一星）——苏唐和师兄都带着这份骄傲，也紧张这次够不够再添一支。`
      : "店里还没拿到银簪——苏唐和师兄都盼着这次能不能让余味点头。两人心里都在期待：这次给不给簪？"}\n写余味进门、苏唐迎上（先来一句「又来了！」式的熟络话），把两人对簪子的期待自然带出来。`;
    try {
      const raw = await callAI(cfg, sys, user, "余味进场");
      return { prose: (raw || "").trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { prose: "", ai: false };
}

// ── 余味开席：四样大阵仗的品评叙事（分数系统判定，AI 只写戏）────
export async function genFeastReview(cfg, ctx) {
  if (cfgReady(cfg)) {
    const sys = "你是西蜀豆花庄的说书人。写余味（峨眉破戒的女侠食评人，任性少女、口味刁钻、年轻一流高手）吃大阵仗的场景：四样摆满一桌，她逐样尝，每样一句点评（火候/滋味/酒的劲儿），最后收在总评上。第三人称，带「」对话与 *心理*。分 3-4 段。" + RYUWEI_VOICE;
    const user = `【大阵仗】余味面前摆了四样：大菜「${ctx.feast.main.dish.name}」(${ctx.scores.mainScore}分)、汤「${ctx.feast.soup.dish.name}」(${ctx.scores.soupScore}分)、小吃「${ctx.feast.snack.name}」(${ctx.scores.snackScore}分)、酒「${ctx.feast.wine.name}」(${ctx.scores.winePts}分)。总分 ${ctx.total}/100（四样各 25%）。她的点评跟分数实打实对应：高的夸到实处，低的点破毛病，别夸成满分也没给分。`;
    try {
      const raw = await callAI(cfg, sys, user, "开席");
      return { prose: (raw || "").trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { prose: `四样摆齐。余味逐一尝过，放下筷子：「${ctx.total >= 75 ? "这一席，够格让我惦记。" : "还差些火候，下次再来讨教。"}」`, ai: false };
}

export async function genChat(cfg, text, onChunk, context) {
  if (cfgReady(cfg)) {
    const sys = STYLE + `\n师兄在日记里写了句话，你以日记的笔法接下去，分 2-4 段，用上对话「」与心理 *...*。正文总字数约 ${cfg.chatWords || 160} 字（±${cfg.tolPct ?? 15}%）。【上下文】里是店里实况（今日来客、近况、最近对话、银簪名声）——苏唐的回应要接住这些：提到的人与事要跟上下文对得上（来过的客人、做过的菜、师兄的招牌名声都是谈资），别凭空造人造事，也别生硬报清单，自然勾连即可。若对话里在场的客人说出了想吃什么（口味/食材/做法），末尾再单独一行「心愿：」+ 客人原话（一字不改，他说了什么就写什么）；客人没提就不写这行。末尾照例附「苏唐批：」一句和「心情：」一个词（八个里选）；再一行「表情：」——若这回应答里有暧昧/亲密/逗弄氛围，从 脸红出汗/微微翻白眼/憋气/吐舌/wink/嘟嘴/鼓气/娇羞比耶 里选一个最贴的，否则写「平常」；再一行「好感：+N」，N 取 0-3，按这回应答的甜度/用心/文本质量来定，被逗乐、暖心、撩到位就给高；${getNsfw() ? `再一行「亲密：」——若涉及亲热/做爱情节，判断有没有做到位，写「无」「未尽兴」或「到位」。` : ""}`;
    const user = (context ? `【上下文】\n${context}\n` : "") + `【师兄写道】${text}`;
    const t0 = Date.now();
    try {
      const raw = streamOn(cfg) && onChunk
        ? await callAIStream(cfg, sys, user, onChunk, "闲聊")
        : await callAI(cfg, sys, user, "闲聊");
      const ms = Date.now() - t0;
      if (raw && raw.trim()) {
        const { main, comment, mood, wish } = extractComment(raw.trim());
        if (main) {
          const affM = (raw || "").match(/好感[：:]\s*\+?\s*(\d)/);
          const aff = affM ? Math.max(0, Math.min(3, parseInt(affM[1], 10))) : 0;
          const intM = (raw || "").match(/亲密[：:]\s*([^\n]+)/);
          const intimacy = intM ? intM[1].trim() : "";
          return { prose: main, comment, mood: moodIndex(mood), wish, ms, ai: true, aff, intimacy };
        }
      }
    } catch { /* 降级 */ }
  }
  const p = CHAT_FALLBACK[chatIdx++ % CHAT_FALLBACK.length];
  return { prose: p[0], comment: p[1], mood: p[2], ms: null, ai: false };
}
