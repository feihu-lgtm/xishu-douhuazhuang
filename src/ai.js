// 西蜀豆花庄 · AI 说书人（OpenAI 兼容端点，类酒馆接法；无 key 静默降级模板）
// 支持流式（SSE）输出与模型列表检索（GET /models）。
import { FLAVOR_BY_ID, FLAVORS, TECHNIQUES, ING_BY_NAME, SNACKS } from "./data.js";
import { STYLE, tierGuide, tierOfScore, dishUser, snackUser, reactionUser } from "./prompt.js";
export { tierOfScore, tierGuide };

const CFG_KEY = "xiaochu-ai-v1";

export function loadCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { stream: true, maxTokens: 200000, dishWords: 360, chatWords: 160, suWords: 300, tolPct: 15, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { endpoint: "", apiKey: "", model: "", stream: true, maxTokens: 200000, dishWords: 360, chatWords: 160, suWords: 300, tolPct: 15 };
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

// ── 限流：反代 1 分钟最多 5 次，间隔 12s ───────────────────────────────
const RATE_MAX = 5, RATE_WINDOW = 60000, RATE_GAP = 12000;
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

// max_tokens 默认 200000，设置里可调（厂商报错就调小）
export async function callAI(cfg, system, user, label) {
  await throttle();
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
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
        max_tokens: cfg.maxTokens || 200000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error("空回复");
    pushTrace({ ts: t0, label: label || "调用", system, user, response: text, ms: Date.now() - t0 });
    return text;
  } catch (e) {
    pushTrace({ ts: t0, label: label || "调用", system, user, response: "", error: e.message, ms: Date.now() - t0 });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 流式调用：SSE data: 行，逐块回调 onChunk，返回全文
export async function callAIStream(cfg, system, user, onChunk, label) {
  await throttle();
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
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
        max_tokens: cfg.maxTokens || 200000,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        eat(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
    eat(buf); // 收尾：最后一行可能不带换行
    pushTrace({ ts: t0, label: label || "流式", system, user, response: full, ms: Date.now() - t0 });
    return full;
  } catch (e) {
    pushTrace({ ts: t0, label: label || "流式", system, user, response: "", error: e.message, ms: Date.now() - t0 });
    throw e;
  } finally {
    clearTimeout(timer);
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

// 拆出末尾的「苏唐批：」与「心情：」
export function extractComment(t) {
  let s = (t || "");
  let comment = "", mood = "", menu = "";
  const cm = s.match(/\n?[ \t]*苏唐批[：:][ \t]*([^\n]+)/);
  if (cm) { comment = cm[1].trim(); s = s.replace(cm[0], ""); }
  const mm = s.match(/\n?[ \t]*心情[：:][ \t]*([^\n]+)/);
  if (mm) { mood = mm[1].trim(); s = s.replace(mm[0], ""); }
  const mu = s.match(/\n?[ \t]*菜单[：:][ \t]*([^\n]+)/);
  if (mu) { menu = mu[1].trim(); s = s.replace(mu[0], ""); }
  let noteTxt = "";
  const nt = s.match(/\n?[ \t]*纸条[：:][ \t]*([^\n]+)/);
  if (nt) { noteTxt = nt[1].trim(); s = s.replace(nt[0], ""); }
  return { main: s.trim(), comment, mood, menu, note: noteTxt };
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
      `请判断这套动作真正练到哪几门外功（从 刀法/剑法/拳掌/枪法/投掷/轻功 里选 1-3 个，贴合切配、翻锅、火候、身法），`,
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

export async function genSnack(cfg, ctx) {
  if (cfgReady(cfg)) {
    const invStr = Object.entries(ctx.inv).map(([n, c]) => `${n}×${c}`).join("、") || "（没有）";
    const user = snackUser({ ...ctx, invStr });
    try {
      const raw = await callAI(cfg,
        "你是苏唐，西蜀豆花庄的师妹，红衣汉服，手艺好，嘴硬心软，做小吃是她的活计。只输出 JSON。",
        user, "苏唐备小吃");
      const o = parseSnack(raw, ctx);
      if (o) return { ...o, ai: true };
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
    flavor: req.includes("甜") ? "tian" : req.includes("酸") ? "suanla" : req.includes("辣") ? "mala" : (hit.cat === "点心" ? "tian" : "xianxiang"),
  };
}

// ── 收工总评（苏唐逐客复盘）──────────────────────────────────────────
// ── 苏唐长对话（右栏，好感只要对话就加）──────────────────────────────
const SU_SYS = "你是苏唐，西蜀豆花庄的师妹，红衣汉服，手艺好，嘴硬心软。直接以苏唐的身份回应师兄，可带「」对话与 *心理*，不要写旁白总结。";
function fallbackSuTalk() {
  return "【苏唐】师兄说什么呢，灶上还忙着，别逗我。";
}
export async function genSuTalk(cfg, ctx, onChunk) {
  if (cfgReady(cfg)) {
    const user = [
      `师兄对苏唐说：${ctx.text}`,
      `苏唐对师兄的好感为 ${ctx.suAff ?? 0}。`,
      tierGuide(ctx.suTier || 1, "苏唐手艺"),
      `以苏唐的口吻与动作回一段话，约 ${ctx.words || 300} 字，嘴硬心软；好感越高语气越软。`,
      `回话末尾单独一行「好感：+N」，N 取 0-3，由你当时心情决定（被逗乐、暖心就高，被气就 0）。`,
    ].join("\n");
    const t0 = Date.now();
    try {
      const raw = streamOn(cfg) && onChunk
        ? await callAIStream(cfg, SU_SYS, user, onChunk, "苏唐对话")
        : await callAI(cfg, SU_SYS, user, "苏唐对话");
      const m = (raw || "").match(/好感[：:]\s*\+?\s*(\d)/);
      const aff = m ? Math.max(0, Math.min(3, parseInt(m[1], 10))) : 1;
      return { text: raw, aff, ms: Date.now() - t0, ai: true };
    } catch { /* 降级 */ }
  }
  return { text: fallbackSuTalk(), aff: 1, ai: false };
}

export async function genReview(cfg, ctx) {
  if (cfgReady(cfg)) {
    const lines = (ctx.dayLog || []).map(d =>
      `客人${d.name}，点菜时说「${d.order}」，师兄做了「${d.dish}」，${d.flavorMatch ? "合口味" : "不合口味"}${d.favMatch ? "、正中TA兴趣的料" : ""}，满意度${d.score}。`);
    const user = ["今日收工，逐客复盘：", ...lines,
      `请苏唐总评：每位客人是怎么说的、她推测TA爱吃什么、师兄做的好不好。用苏唐口吻，分短段，嘴硬心软。`].join("\n");
    try {
      const raw = await callAI(cfg, "你是苏唐，西蜀豆花庄的师妹，红衣汉服，嘴硬心软，眼力好。只输出总评文字。", user, "苏唐总评");
      if (raw && raw.trim()) return { text: raw.trim(), ai: true };
    } catch { /* 降级 */ }
  }
  return { text: fallbackReview(ctx), ai: false };
}
function fallbackReview(ctx) {
  if (!(ctx.dayLog || []).length) return "【苏唐】今日没开张，锅都凉了，省柴。";
  return (ctx.dayLog || []).map(d =>
    `【苏唐】${d.name} 那桌，${d.flavorMatch ? "口味对上了，下回还这么配。" : `没对上，TA 要的是那口，你偏了。`} ${d.tier === 0 ? "师兄这手，我服。" : d.tier === 1 ? "还行，凑合。" : "得练。"}`
  ).join("\n");
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

export async function genChat(cfg, text, onChunk) {
  if (cfgReady(cfg)) {
    const sys = STYLE + `\n师兄在日记里写了句话，你以日记的笔法接下去，分 2-4 段，用上对话「」与心理 *...*。正文总字数约 ${cfg.chatWords || 160} 字（±${cfg.tolPct ?? 15}%）。末尾照例附「苏唐批：」一句和「心情：」一个词（八个里选）。`;
    const t0 = Date.now();
    try {
      const raw = streamOn(cfg) && onChunk
        ? await callAIStream(cfg, sys, `师兄写道：${text}`, onChunk, "闲聊")
        : await callAI(cfg, sys, `师兄写道：${text}`, "闲聊");
      const ms = Date.now() - t0;
      if (raw && raw.trim()) {
        const { main, comment, mood } = extractComment(raw.trim());
        if (main) return { prose: main, comment, mood: moodIndex(mood), ms, ai: true };
      }
    } catch { /* 降级 */ }
  }
  const p = CHAT_FALLBACK[chatIdx++ % CHAT_FALLBACK.length];
  return { prose: p[0], comment: p[1], mood: p[2], ms: null, ai: false };
}
