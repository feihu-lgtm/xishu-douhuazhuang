// 西蜀豆花庄 · 界面层（DOM）
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE_BY_ID, FLAVORS, FLAVOR_BY_ID,
  ING_BY_NAME, HOURS, SNACKS, ingTag, ING_TAGS, EXPEDITION_MAP, DIMENSIONS, GUESTS, RIVAL_SCHOOLS, weekLabel,
  BREW_RECIPES, SHOP_WINES, WINE_DESSERTS, MEDICINE_HERBS,
} from "./data.js?v=v12";
import { judgeStove, shopStock, currentGuest, affName, SKILLS, rankLabel, CHECK_DIMS, inviteCandidates, findKnownGuest, ryuweiTierName, rivalGuestForSchool, GUESTS_PER_DAY } from "./state.js?v=v12";
import { loadCfg, saveCfg, listModels, getTrace, clearTrace, fmtMs, rateDots, rateState, getNsfw, setNsfw, MOOD_WORDS } from "./ai.js?v=v12";
import { BGM_TRACKS, bgmState, bgmPlay, bgmPause, bgmToggle, bgmNext, bgmSetVolume, bgmSetLoop, bgmInit } from "./bgm.js?v=v12";

// 顶部限流五点是空心/实心 + 12s 计时
export function renderRate() {
  const el = document.querySelector("#rate");
  if (!el) return;
  const { wait } = rateState();
  el.innerHTML = rateDots().map(d => `<span class="dot ${d ? "on" : ""}"></span>`).join("") +
    (wait > 0 ? `<span class="cd">${Math.ceil(wait / 1000)}s</span>` : "");
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 旁白/对话「」/心理 *...* 三色渲染 + 多分段左对齐
const RICH = new Set(["narr", "say", "su"]); // su=苏唐，右栏分段+变色
function richHtml(text) {
  const esc = escapeHtml(text);
  const colored = esc.replace(/(「[^」]*」|“[^”\n]*”|\*[^*\n]+\*)/g, (m) =>
    (m[0] === "「" || m[0] === "“") ? `<span class="seg-say">${m}</span>` : `<span class="seg-thought">${m}</span>`);
  return colored.split(/\n{2,}/)
    .map(p => `<p class="para">${p.replace(/\n/g, "<br>")}</p>`).join("");
}

const $ = (sel) => document.querySelector(sel);

// ── 线描小图标（Roadwarden 式玫瑰线稿）────────────────────────────────
const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const ICONS = {
  coin: SVG(`<circle cx="12" cy="12" r="7"/><rect x="9.8" y="9.8" width="4.4" height="4.4"/>`),
  cookware: SVG(`<path d="M5 10h14v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M3 10h18"/><path d="M10 6.5h4"/><path d="M12 6.5V10"/>`),
  tech: SVG(`<path d="M12 4c2 3 5 4.6 5 8a5 5 0 0 1-10 0c0-2 1-3.6 2.2-5.2.4 1.1 1.3 1.7 1.3 1.7C10.6 7 11 5.5 12 4z"/>`),
  ingredient: SVG(`<path d="M12 4c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/><path d="M12 9v9"/>`),
  flavor: SVG(`<path d="M5 12h14a7 7 0 0 1-14 0z"/><path d="M9 8.5c0-1.5 1-1.5 1-3"/><path d="M13.5 8.5c0-1.5 1-1.5 1-3"/>`),
};
const coin = (n) => `${n} <span class="coin-ic" style="display:inline-block;width:12px;height:12px">${ICONS.coin}</span>`;

// ── 终端日志（打字机 + 队列，点击跳过，带时间戳）──────────────────────
let queue = Promise.resolve();
let skip = false;
document.addEventListener("click", (e) => { if (e.target.closest("#log")) skip = true; });
const ts = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const mkEntry = (target, type, extraClass = "") => {
  const div = document.createElement("div");
  div.className = `entry ${type}${extraClass ? " " + extraClass : ""}`;
  div.innerHTML = `<span class="ts">${ts()}</span><span class="bd"></span>`;
  target.appendChild(div);
  return div.querySelector(".bd");
};

// ── 伪流式打字节奏：中文逐字、西文快、标点停顿、段落顿挫（点击可跳过）──
const charMs = (ch) => {
  if (ch === "\n") return 45;
  if (/[A-Za-z0-9 ]/.test(ch)) return 10;
  if ("。！？…".includes(ch)) return 120;
  if ("；，、：—".includes(ch)) return 60;
  return 24;
};
// 在 bd 里逐字渐显文本，打完全量收尾；fast=true 快速出字（系统消息用）
function typeInto(bd, target, text, put, { fast = false, done = () => {} } = {}) {
  const el = bd.parentElement;
  el.classList.add("typing");
  let i = 0;
  const step = () => {
    if (skip || document.hidden || i >= text.length) {  // 后台标签页 setTimeout 被浏览器节流到 ~1/s，逐字打 500 字会卡死几百秒；tab 隐藏则整段瞬显、立刻 done()，绝不阻塞探秘/结算的 await
      put(text);
      el.classList.remove("typing");
      target.scrollTop = target.scrollHeight;
      done();
      return;
    }
    const ch = text[i];
    i += 1;
    put(text.slice(0, i));
    target.scrollTop = target.scrollHeight;
    // 段间（\n\n）再多停一拍，读起来有呼吸感
    const nl = ch === "\n" && text[i] === "\n" ? 90 : 0;
    setTimeout(step, (fast ? 6 : charMs(ch)) + nl);
  };
  setTimeout(step, fast ? 4 : 16);
}

// ── 分段滑块：每轮 prompt 的开始在两侧滚动条旁打点（左=主叙事，右=苏唐）──
let pendingLeft = false, pendingRight = false;
export function markPrompt() { pendingLeft = pendingRight = true; } // 玩家输入 → 新一轮开始
function marksBar(sc) {
  let bar = sc.querySelector(":scope > .log-marks");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "log-marks";
    sc.appendChild(bar);
    sc.addEventListener("scroll", syncMarks);
  }
  return bar;
}
function addMark(sc, entry) {
  const bar = marksBar(sc);
  const top = entry.offsetTop;
  const m = document.createElement("div");
  m.className = "log-mark";
  m.dataset.top = top;
  m.style.top = (top + 4) + "px";
  m.title = "本轮开始";
  m.onclick = (e) => { e.stopPropagation(); sc.scrollTo({ top: top - 60, behavior: "smooth" }); };
  bar.appendChild(m);
  syncMarks.call(sc);
}
function syncMarks() {
  const sc = this, bar = sc.querySelector(":scope > .log-marks");
  if (!bar) return;
  const top = sc.scrollTop, viewH = sc.clientHeight;
  let cur = null;
  for (const m of bar.querySelectorAll(".log-mark")) {
    if (parseFloat(m.dataset.top) <= top + viewH * 0.25) cur = m;
  }
  for (const m of bar.querySelectorAll(".log-mark")) m.classList.toggle("cur", m === cur);
}

export function log(type, text, { instant = false, extraClass = "" } = {}) {
  queue = queue.then(() => new Promise((done) => {
    const bd = mkEntry($("#log"), type, extraClass);
    if (pendingLeft && type === "player") { addMark($("#log"), bd.parentElement); pendingLeft = false; }
    const put = (str) => { if (RICH.has(type)) bd.innerHTML = richHtml(str); else bd.textContent = str; };
    if (skip || text.length <= 1) { put(text); skip = false; return done(); }
    typeInto(bd, $("#log"), text, put, { fast: instant, done: () => { skip = false; done(); } });
  }));
  return queue;
}

// 右栏·苏唐日志（粉色，伪流式打字，带时间戳；独立队列不挤主栏）
let suQueue = Promise.resolve();
export function slog(type, text) {
  suQueue = suQueue.then(() => new Promise((done) => {
    const bd = mkEntry($("#sulog"), type);
    if (pendingRight) { addMark($("#sulog"), bd.parentElement); pendingRight = false; }
    const put = (str) => { if (RICH.has(type)) bd.innerHTML = richHtml(str); else bd.textContent = str; };
    if (text.length <= 1) { put(text); return done(); }
    typeInto(bd, $("#sulog"), text, put, { done });
  }));
  return suQueue;
}
// 流式上屏：AI 边写边长，返回句柄。
// 走同一条日志队列排队创建 div，保证排在未打完的条目之后（不往上插）。
export function logStream(type, { extraClass = "" } = {}) {
  let entry = null, bd = null, text = "", ready = false, pendingApply = null;
  const put = (str) => { if (RICH.has(type)) bd.innerHTML = richHtml(str); else bd.textContent = str; };
  const doApply = (main, comment, face = 0) => {
    put(main);
    if (comment) {
      const c = document.createElement("div");
      c.className = `entry comment${extraClass ? " " + extraClass : ""}${face ? ` su-face-${face}` : ""}`;
      c.innerHTML = `<span class="ts">${ts()}</span><span class="bd"></span>`;
      entry.after(c);
      // 评语也伪流式渐显（textContent 安全，流光/图标 CSS 照常生效）
      typeInto(c.querySelector(".bd"), $("#log"), comment, (s) => { c.querySelector(".bd").textContent = s; });
    }
    $("#log").scrollTop = $("#log").scrollHeight;
  };
  queue = queue.then(() => new Promise(done => {
    bd = mkEntry($("#log"), type, extraClass);
    entry = bd.parentElement;
    if (text) put(text);
    ready = true;
    if (pendingApply) { doApply(pendingApply.main, pendingApply.comment, pendingApply.face); pendingApply = null; }
    $("#log").scrollTop = $("#log").scrollHeight;
    done();
  }));
  return {
    append(c) {
      text += c;
      if (ready) { put(text); $("#log").scrollTop = $("#log").scrollHeight; }
    },
    apply(main, comment, face = 0) {
      if (ready) doApply(main, comment, face);
      else pendingApply = { main, comment, face };
    },
    remove() {
      if (ready) entry.remove();
      else queue = queue.then(() => entry?.remove());
    },
    get text() { return text; },
  };
}

// 右栏（苏唐）流式上屏
export function slogStream(type) {
  let entry = null, bd = null, text = "", ready = false;
  const putR = (s) => { if (RICH.has(type)) bd.innerHTML = richHtml(s); else bd.textContent = s; };
  queue = queue.then(() => new Promise(done => {
    bd = mkEntry($("#sulog"), type);
    entry = bd.parentElement;
    if (text) putR(text);
    ready = true;
    $("#sulog").scrollTop = $("#sulog").scrollHeight;
    done();
  }));
  return {
    append(c) { text += c; if (ready) { putR(text); $("#sulog").scrollTop = $("#sulog").scrollHeight; } },
    remove() { if (ready) entry.remove(); else queue = queue.then(() => entry?.remove()); },
    get text() { return text; },
  };
}

export const narr = (t) => log("narr", t);
export const narrGlow = (t) => log("narr", t, { extraClass: "ryuwei-comment" }); // 余味评语 · 流光炫彩
export const say = (t) => log("say", t);
export const sys = (t) => log("sys", t, { instant: true });
export const gold = (t) => log("gold", t);
export const playerLine = (t) => log("player", t, { instant: true });
// 苏唐批 · 高兴评带表情图标（su_face_1..4，四个 favicon 表情），不高兴/中性评不带
const HAPPY_MOODS = new Set([0, 2, 3, 4]); // 开心/兴奋/心动/得意（MOOD_WORDS 索引）
export const faceOf = (mood) => (HAPPY_MOODS.has(mood) ? 1 + Math.floor(Math.random() * 4) : 0);
export const commentLine = (t, face = 0) => log("comment", `苏唐批：${t}`, { extraClass: face ? `su-face-${face}` : "" });
export const commentGlow = (t, face = 0) => log("comment", `苏唐批：${t}`, { extraClass: `ryuwei-comment${face ? ` su-face-${face}` : ""}` }); // 余味场景评语 · 流光炫彩
export const suLine = (t) => slog("su", t);      // 苏唐的话 → 右栏，粉色
export const suSys = (t) => slog("susys", t);    // 苏唐的练功/用料/买卖 → 右栏

// ── 苏唐表情（左栏师妹栏目八格，随文本切换）───────────────────────────
// 0 勺笑 1 比耶 2 握拳兴奋 3 捧心 4 攥拳得意 5 抱臂哼 6 吃惊 7 搅锅
const MOOD_POS = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]];
const moodPos = (i) => {
  const [c, r] = MOOD_POS[i] || [0, 0];
  return `${c * 100 / 3}% ${r * 100}%`;
};
let currentMood = 0;
export function setMood(i) {
  if (Number.isInteger(i) && i >= 0 && i < 8) currentMood = i;
  const el = document.querySelector(".sutang");
  if (!el) return;
  el.style.backgroundImage = "";   // 回到默认 sutang.png（清掉 NSFW 表情皮肤）
  el.style.backgroundPosition = moodPos(currentMood);
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  // 余味立绘表情框同步
  const rf = document.querySelector(".ryuwei-face");
  if (rf) rf.style.backgroundPosition = moodPos(currentMood);
}

// ── NSFW 表情：■模式+闲聊区，按 AI 情节标签匹配姿势（poseIdx=8姿势帧序）──
// 只用这一套（红衣浴袍·出浴 8 姿势），别的删掉了。
const NSFW_SKIN = "assets/sutang_nsfw.png";
export function rollNsfwFace(poseIdx) {
  const el = document.querySelector(".sutang");
  if (!el) return;
  el.style.backgroundImage = `url(${NSFW_SKIN})`;
  const i = Number.isInteger(poseIdx) ? poseIdx : Math.floor(Math.random() * 8); // 脸红出汗/翻白眼/憋气/吐舌/wink/嘟嘴/鼓气/娇羞比耶
  el.style.backgroundPosition = moodPos(i);
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

// ── 三栏渲染 ───────────────────────────────────────────────────────────
export function renderStatus(st) {
  const hour = st.phase === "closing" ? HOURS[4] : HOURS[Math.min(st.served, 3)];
  $("#status").innerHTML =
    `第<b>${st.day}</b>周 · ${weekLabel(st.day)} · ${hour} · 客人 <b>${st.served}/3</b> · <b>${st.coins}</b> 文`;
  // 左上角标题后 · 食评人余味的鱼尾银簪评级徽章
  const rb = document.querySelector("#ryuwei-badge");
  if (rb) {
    const t = (st.ryuweiRating || {}).tier ?? 0;
    // 没拿到银簪之前（tier 0）不显示鱼尾银簪，只有称号
    rb.innerHTML = t > 0
      ? `<img src="./assets/ryuwei_fishtail.png" alt="鱼尾银簪"> <span>${ryuweiTierName(st)} · 银簪×${t}</span>`
      : `<span>${ryuweiTierName(st)}</span>`;
    rb.className = "ryuwei-badge t" + t;
  }
}

// 余味名字 · 氪金装饰框（配流光炫彩，彰显顶级食评人的排面）
const ryuweiTag = (name) => `꧁༺✧${name}✧༻꧂`;

// 食评人余味 · 出场特效（星星文字 + 渐变炫彩，贴合 UI 玫瑰色系）
export function ryuweiIntro(g) {
  const bd = mkEntry($("#log"), "ryuwei");
  bd.innerHTML = `✦ ✧ ✦ 奴家·小鱼儿 ✦ ✧ ✦<br><span class="ryuwei-line">${escapeHtml(`“${g.order}”`)}</span>`;
  bd.parentElement.classList.remove("typing");
  $("#log").scrollTop = $("#log").scrollHeight;
}

export function renderLeft(st, hideGuest) {
  // hideGuest：翻篇后客人已经定好但还没走到「门帘一掀」那句叙事——先不露客人卡，
  // 免得（尤其是余味这种带出场特效的重量级客人）左栏抢跑，把 guestArrives() 的登场都剧透没了。
  const guest = (!hideGuest && st.phase === "guest") ? currentGuestSafe(st) : null;
  let html = `<h3>灶 房</h3>
    <div class="row"><span>日子</span><span class="v">第 ${st.day} 周 · ${weekLabel(st.day)}</span></div>
    <div class="row"><span>文钱</span><span class="v">${st.coins}</span></div>
    <div class="row"><span>累计迎客</span><span class="v">${st.totalServed} 位</span></div>`;
  html += `<h3>客 人</h3>`;
  if (guest) {
    const portrait = guest.ryuwei
      ? `<div id="ryuwei-face" class="ryuwei-face" style="background-position:${moodPos(currentMood)}"></div>`
      : `<div class="portrait">${guest.name[0]}</div>`;
    html += `<div id="guestcard" class="pcard">
      ${portrait}
      <div class="gname${guest.ryuwei ? " ryuwei-name" : ""}">${guest.ryuwei ? ryuweiTag(guest.name) : guest.name}</div>
      <div class="gid">${guest.ident}${guest.ryuwei ? ` · <span class="ryuwei-glow">顶级食评人</span>` : ""} · 消费力 ${guest.spend} 文</div>
      <div class="gid">好感 ${(st.aff || {})[guest.id] || 0} · ${affName((st.aff || {})[guest.id] || 0)}</div>
      <div class="gorder">「${guest.order}」</div>
    </div>`;
  } else {
    html += `<div id="guestcard" class="pcard"><div class="gid">${hideGuest ? "灶房空着" : st.phase === "closing" ? "今日客已送完" : "灶房空着"}</div></div>`;
  }
  html += `<h3>菜 库</h3>`;
  html += (st.dishStore || []).length
    ? `<div id="dishcard">${st.dishStore.map(d =>
        `<div class="dname">「${d.name}」</div><div class="gid">${d.technique} · ${d.flavorId ? FLAVOR_BY_ID[d.flavorId].name : "家常"}${d.suCook ? " · 苏唐做" : ""}</div>`).join("")}</div>`
    : `<div id="dishcard"><div class="gid">菜库空着，先做菜</div></div>`;
  html += `<h3>家 什</h3>` +
    st.cookware.map(id => `<div class="row"><span>${COOKWARE_BY_ID[id].name}</span></div>`).join("");
  html += `<h3>手 艺</h3>
    <div class="row"><span>技法</span><span class="v">${st.techs.join(" / ")}</span></div>
    <div class="row"><span>味型</span><span class="v">${st.flavors.map(f => FLAVOR_BY_ID[f].name).join(" / ")}</span></div>
    <div class="row"><span>苏唐好感</span><span class="v" style="color:#f2a6c0">${st.suAff || 0}</span></div>`;
  html += `<h3>武 学</h3><div class="skills">` +
    SKILLS.map(s => `<span class="skill">${s}<b>${(st.skills || {})[s] || 0}</b></span>`).join("") +
    `</div>`;
  $("#left").innerHTML = html;
}

function currentGuestSafe(st) {
  return currentGuest(st);
}

export function renderSide(st, h) {
  const can = {
    cook: st.phase === "guest",
    snack: true,       // 副厨：小吃面板（苏唐做小吃）
    serve: st.phase === "guest" && !!currentGuestSafe(st), // 备餐：准备上菜（选 3 菜 + 1 酒）
    shop: st.phase === "closing" || st.served >= 3,
    exp: st.phase === "closing" || st.served >= 3,
    next: st.phase === "closing" || st.served >= 3,
  };
  const item = (label, key, enabled, fn) =>
    `<div class="menu-item ${enabled ? "" : "disabled"}" data-act="${fn}">
       <span>${label}</span><span class="key">${key}</span></div>`;
  $("#side").innerHTML =
    item("主厨", "C", can.cook, "cook") +
    item("副厨", "U", can.snack, "snack") +
    item("酿酒", "W", true, "brew") +
    item("备餐", "X", can.serve, "serve") +
    item("商店", "T", can.shop, "shop") +
    item("探秘", "M", can.exp, "exp") +
    item("下一日", "N", can.next, "next") +
    `<div class="sep"></div>` +
    item("仓库", "I", true, "bag") +
    item("设置", "F", true, "settings") +
    item("流程", "L", true, "trace") +
    item("纸条", "P", true, "notes") +
    item("存档", "Q", true, "save") +
    item("读档", "R", true, "load") +
    item("帮助", "H", true, "help") +
    `<div class="sucard" aria-hidden="true">
       <div id="sutang" class="sutang" style="background-position:${moodPos(currentMood)}"></div>
       <div class="suname">苏唐</div>
       <div class="sumood">心情：${MOOD_WORDS[currentMood] ?? "专注"}</div>
     </div>`;
  $("#side").querySelectorAll(".menu-item:not(.disabled)").forEach(el => {
    el.onclick = () => h[el.dataset.act]?.();
  });
}

export function renderAll(st, h, { hideGuest } = {}) {
  renderStatus(st);
  renderLeft(st, hideGuest);
  renderSide(st, h);
}

// ── 浮层骨架 ───────────────────────────────────────────────────────────
export function openModal(inner, onClose, cls = "") {
  const root = $("#modal-root");
  root.innerHTML = `<div class="scrim"></div><div class="modal ${cls}">${inner}</div>`;
  root.classList.add("open");
  root.querySelector(".scrim").onclick = () => closeModal(onClose);
  return root.querySelector(".modal");
}
export function closeModal(onClose) {
  $("#modal-root").classList.remove("open");
  $("#modal-root").innerHTML = "";
  onClose?.();
}

// ── 做菜界面（六格槽位，移植 qucuo CookingScreen 交互）────────────────
export function openCook(st, { onFire, prefill, onSuAll } = {}) {
  const slots = [null, null, null, null];
  for (const m of (prefill?.materials || [])) {
    const i = slots.indexOf(null);
    if (i >= 0 && (st.inv[m] || 0) > 0) slots[i] = m;
  }
  let techId = (prefill?.technique && st.techs.includes(prefill.technique))
    ? prefill.technique : st.techs[0];
  let cwId = st.cookware[0];
  let flavorId = null;
  let intended = "";
  let warn = "";
  let activeTag = null; // 灶台标签筛选：点了哪个只显示哪个，再点一下/点别的都会变

  function draw() {
    const judge = judgeStove(st, slots, techId, cwId, flavorId);
    const filled = slots.filter(Boolean);
    const counts = {};
    slots.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });

    const mats = Object.entries(st.inv).filter(([name, n]) => n > 0 && (!activeTag || ingTag(name) === activeTag));
    const modal = openModal(`
      <h2>灶 台 · 烹饪</h2>
      <div class="ck-label">料 · 调味料与食材混装（点击放入，点格取回）</div>
      <div class="ck-slots">${slots.map((s, i) =>
        `<div class="ck-slot ${s ? "" : "empty"}" data-slot="${i}">
           <span class="tag">料${i + 1}</span>${s || "空"}</div>`).join("")}</div>

      <div class="tagbar">${ING_TAGS.map(t =>
        `<span class="tagchip ${t === activeTag ? "on" : ""}" data-tag="${t}">${t}</span>`).join("")}</div>
      <div class="ck-label">🎒 可用材料</div>
      <div class="ck-mats">${mats.length ? mats.map(([name, n]) => {
        const left = n - (counts[name] || 0);
        const stx = (st.stars && st.stars[name]) || 0;
        return `<span class="ck-mat ${left > 0 ? "" : "zero"}" data-mat="${name}">${stx ? "★".repeat(stx) : ""}${name}<i style="color:var(--ink-dim);font-size:10px"> ${ingTag(name)}</i> ×${left}</span>`;
      }).join("") : `<span class="ck-mat zero">囊中无料，去商店买些食材。</span>`}</div>

      <div class="ck-label">技法 · 五选一</div>
      <div class="ck-chips">${TECHNIQUE_IDS.map(t => {
        const owned = st.techs.includes(t);
        const need = TECHNIQUES[t].needsSteamer && !COOKWARE_BY_ID[cwId].canSteam;
        return `<span class="ck-chip ${t === techId ? "on" : ""} ${owned ? "" : "off"}" data-tech="${t}"
          title="${TECHNIQUES[t].desc}">${TECHNIQUES[t].icon} ${t}${!owned ? "·未学" : need ? "·需蒸笼" : ""}</span>`;
      }).join("")}</div>

      <div class="ck-label">炊具 · 囊中所有</div>
      <div class="ck-chips">${st.cookware.map(id => {
        const c = COOKWARE_BY_ID[id];
        return `<span class="ck-chip ${id === cwId ? "on" : ""}" data-cw="${id}" title="${c.desc}">${c.name}${c.canSteam ? " ♨" : ""}</span>`;
      }).join("")}</div>

      <div class="ck-label">味型 · 调出才算（括号里是需要的核心调料）</div>
      <div class="ck-chips">
        <span class="ck-chip ${flavorId === null ? "on" : ""}" data-fl="">家常</span>
        ${FLAVORS.map(f => {
          const owned = st.flavors.includes(f.id);
          const has = f.requires.every(r => filled.includes(r));
          return `<span class="ck-chip ${flavorId === f.id ? "on" : ""} ${owned && has ? "" : "off"}"
            data-fl="${f.id}" title="${f.desc}">${f.name}（需${f.requires.join("、")}）${!owned ? "·未学" : !has ? "·缺料" : ""}</span>`;
        }).join("")}
      </div>

      <div class="ck-label">打算做什么菜 · 说给灶神听（武学裁决用）</div>
      <input id="ck-intent" class="ck-intent" placeholder="如：回锅肉 / 见手青炒火腿 / 随便来一个" value="${intended}">

      <div class="ck-scroll">${judge.ok ? (judge.recipe
        ? `<span class="ok">可烹 · 「${judge.recipe.name}」</span> · 火候品质 ${judge.quality}`
        : `<span class="ok">妙手偶得 · 灶神来起名</span> · 火候品质 ${judge.quality}`)
        + (judge.flavorId ? ` · 味型「${FLAVOR_BY_ID[judge.flavorId].name}」` : " · 家常味")
        : (filled.length ? "灶神摇头——这几样凑不成一道菜。" : "卷轴空着，等你下料。")}</div>
      <div class="ck-warn">${warn}</div>
      <div class="ck-btns">
        ${(st.suAff || 0) > 40 ? `<span class="ck-btn plain" data-suall>苏唐全包</span>` : ""}
        <span class="ck-btn" data-fire>开 火</span>
        <span class="ck-btn plain" data-clear>清空</span>
        <span class="ck-btn plain" data-back>返回</span>
      </div>
    `, () => {});

    const suall = modal.querySelector("[data-suall]");
    if (suall) suall.onclick = () => { closeModal(); onSuAll?.(); };

    modal.querySelectorAll("[data-slot]").forEach(el => el.onclick = () => {
      const i = +el.dataset.slot;
      if (slots[i]) { slots[i] = null; draw(); }
    });
    modal.querySelectorAll("[data-mat]").forEach(el => el.onclick = () => {
      const name = el.dataset.mat;
      const left = (st.inv[name] || 0) - (counts[name] || 0);
      const i = slots.indexOf(null);
      if (left > 0 && i >= 0) { slots[i] = name; warn = ""; draw(); }
    });
    modal.querySelectorAll("[data-tech]").forEach(el => el.onclick = () => {
      const t = el.dataset.tech;
      if (st.techs.includes(t)) { techId = t; warn = ""; draw(); }
    });
    modal.querySelectorAll("[data-cw]").forEach(el => el.onclick = () => { cwId = el.dataset.cw; draw(); });
    modal.querySelectorAll("[data-fl]").forEach(el => el.onclick = () => {
      const f = el.dataset.fl || null;
      if (f && (!st.flavors.includes(f) || !FLAVOR_BY_ID[f].requires.every(r => filled.includes(r)))) return;
      flavorId = f; draw();
    });
    modal.querySelectorAll("[data-tag]").forEach(el => el.onclick = () => {
      const t = el.dataset.tag;
      activeTag = activeTag === t ? null : t; // 再点一下同一个＝取消，回到显示全部
      draw();
    });
    modal.querySelector("#ck-intent").oninput = (e) => { intended = e.target.value; };
    modal.querySelector("[data-clear]").onclick = () => { slots = [null, null, null, null]; warn = ""; draw(); };
    modal.querySelector("[data-back]").onclick = () => closeModal();
    modal.querySelector("[data-fire]").onclick = () => {
      const res = onFire(slots, techId, cwId, flavorId, intended.trim());
      if (!res.ok) { warn = res.warn; draw(); }
    };
  }
  draw();
}

// ── 商店（全屏 · 钱数+购物车 · 份数锁定 · 标签筛选 · 买不跳顶）──────
export function openShop(st, { onBuy, onLeave, onRefresh, onBuyAll }) {
  let tab = "ingredient";
  let cartOpen = false;
  let activeTag = null; // 食材标签筛选：点了哪个只显示哪个，不是排除
  const TABS = { ingredient: ["食材", "ingredient"], cookware: ["厨具", "cookware"],
    tech: ["技法", "tech"], flavor: ["味型", "flavor"] };
  const qkey = (id) => `${tab}:${id}`;
  const qtyOf = (id) => st.buyQty[qkey(id)] || 0; // 从 0 开始加

  const modal = openModal(`
    <div class="shop-head">
      <span class="shop-coins" id="shop-coins">${st.coins} 文</span>
      <span class="shop-cartbtn" data-cart>🧺 购物车</span>
      <span class="shop-refresh" data-stockall>备菜全套</span>
      <div class="shop-tabs">${Object.entries(TABS).map(([k, [label]]) =>
        `<span class="${k === tab ? "on" : ""}" data-tab="${k}">${label}</span>`).join("")}
        <span class="shop-refresh" data-refresh>↻ 刷新食材</span>
      </div>
      <span class="return" data-leave style="margin-left:auto">Return · 返回</span>
    </div>
    <div class="shop-body" id="shop-body"></div>
  `, () => {}, "fullscreen");

  const body = () => modal.querySelector("#shop-body");

  function stockFor() {
    const s = shopStock(st)[tab];
    return tab === "ingredient" ? s.filter(i => !activeTag || ingTag(i.name) === activeTag) : s;
  }
  function iconFor() {
    return ICONS[tab === "tech" ? "tech" : tab === "flavor" ? "flavor" : tab === "ingredient" ? "ingredient" : "cookware"];
  }
  function cardHtml(it) {
    const isIng = tab === "ingredient";
    const q = qtyOf(it.id);
    const poor = !it.owned && st.coins < it.price;
    return `<div class="scard ${poor && !isIng ? "poor" : ""} ${it.owned && !isIng ? "owned" : ""}">
      <div class="sname">${it.name}${isIng ? ` <i style="color:var(--ink-dim);font-size:11px">${ingTag(it.name)}</i>` : ""}</div>
      <div class="sicon">${iconFor()}</div>
      <div class="sdesc">${it.extra ? `<i>${it.extra}</i><br>` : ""}${it.desc}</div>
      <div class="scost">价：${coin(it.price)}</div>
      ${isIng
        ? `<div class="qty"><span data-q="-1" data-id="${it.id}">−</span><b>${q}</b><span data-q="1" data-id="${it.id}">＋</span></div>
           <div class="sbuy" data-add="${it.id}">＋1 入车</div>`
        : `<div class="sbuy" data-buy="${it.id}">${it.owned ? "已拥有" : poor ? "买不起" : "买下"}</div>`}
    </div>`;
  }
  function tagbarHtml() {
    return `<div class="tagbar">${ING_TAGS.map(t =>
      `<span class="tagchip ${t === activeTag ? "on" : ""}" data-tag="${t}">${t}</span>`).join("")}</div>`;
  }
  function cartHtml() {
    const rows = [];
    for (const [k, q] of Object.entries(st.buyQty || {})) {
      if (q <= 0) continue;
      const [tb, id] = k.split(":");
      const item = (shopStock(st)[tb] || []).find(x => x.id === id);
      if (item) rows.push(`<div class="row"><span>${item.name} ×${q}</span><span class="v">${item.price * q} 文</span></div>`);
    }
    const total = Object.entries(st.buyQty || {}).reduce((a, [k, q]) => {
      const [tb, id] = k.split(":");
      const item = (shopStock(st)[tb] || []).find(x => x.id === id);
      return a + (item ? item.price * q : 0);
    }, 0);
    return `<div class="shop-cart">${rows.length ? rows.join("") + `<div class="row"><span>合计</span><span class="v">${total} 文</span></div>` : "购物车是空的。"}
      <div class="ck-btns"><span class="ck-btn plain" data-checkout>全部买下</span></div></div>`;
  }
  function renderGrid(keepScroll) {
    const b = body();
    const sc = keepScroll ? b.scrollTop : 0;
    b.innerHTML = (cartOpen ? cartHtml() : "") + (tab === "ingredient" ? tagbarHtml() : "") +
      `<div class="shop-grid">${stockFor().map(cardHtml).join("")}</div>`;
    b.scrollTop = sc;
    bindBody(b);
  }
  function bindBody(b) {
    b.querySelectorAll("[data-tag]").forEach(el => el.onclick = () => {
      const t = el.dataset.tag;
      activeTag = activeTag === t ? null : t; // 再点一下同一个＝取消，回到显示全部
      renderGrid(true);
    });
    b.querySelectorAll("[data-q]").forEach(el => el.onclick = () => {
      const id = el.dataset.id;
      const d = +el.dataset.q;
      st.buyQty[qkey(id)] = Math.max(0, Math.min(9, qtyOf(id) + d)); // 从 0 加
      renderGrid(true);
    });
    b.querySelectorAll("[data-add]").forEach(el => el.onclick = () => {
      const id = el.dataset.add;
      st.buyQty[qkey(id)] = Math.min(9, qtyOf(id) + 1);
      renderGrid(true);
    });
    b.querySelectorAll("[data-buy]").forEach(el => el.onclick = () => {
      if (el.textContent === "买不起" || el.textContent === "已拥有") return;
      const r = onBuy(tab, el.dataset.buy, 1);
      if (r.ok) { modal.querySelector("#shop-coins").textContent = `${st.coins} 文`; renderGrid(true); }
    });
    const co = b.querySelector("[data-checkout]");
    if (co) co.onclick = () => {
      for (const [k, q] of Object.entries(st.buyQty || {})) {
        if (q <= 0) continue;
        const [tb, id] = k.split(":");
        onBuy(tb, id, q);
      }
      st.buyQty = {}; // 结算后清空购物车
      modal.querySelector("#shop-coins").textContent = `${st.coins} 文`;
      renderGrid(true);
    };
  }

  modal.querySelectorAll("[data-tab]").forEach(el => el.onclick = () => { tab = el.dataset.tab; renderGrid(false); });
  modal.querySelector("[data-refresh]").onclick = () => { onRefresh?.(); renderGrid(true); };
  modal.querySelector("[data-stockall]").onclick = () => {
    const r = onBuyAll?.();
    if (r?.ok && !cartOpen) { /* 已由回调刷新 */ }
    renderGrid(true);
  };
  modal.querySelector("[data-cart]").onclick = () => { cartOpen = !cartOpen; renderGrid(true); };
  modal.querySelector("[data-leave]").onclick = () => closeModal(onLeave);
  renderGrid(false);
}

// ── 探秘地图（全屏 · 图钉流，点据点去对应主题探秘）──────────────────
export function openMap(st, { onGo }) {
  let fit = () => {};
  const cleanup = () => window.removeEventListener("resize", fit);
  const modal = openModal(`
    <div class="map-head">
      <span class="map-title">探 秘 · 择地而往</span>
      <span class="return" data-leave style="margin-left:auto">Return · 返回</span>
    </div>
    <div class="map-body">
      <div class="map-frame">
        <img class="map-img" src="./assets/map_bg.png" alt="">
        ${EXPEDITION_MAP.map(n => `
          <div class="map-pin" data-id="${n.id}" style="top:${n.top}%;left:${n.left}%" title="${n.category}">
            <span class="map-dot"></span>
            <span class="map-label">${n.name}</span>
          </div>`).join("")}
      </div>
    </div>
  `, cleanup, "fullscreen");

  const body = modal.querySelector(".map-body");
  const frame = modal.querySelector(".map-frame");
  const img = modal.querySelector(".map-img");
  fit = () => {
    const availW = body.clientWidth - 40;
    const availH = body.clientHeight - 40;
    const ratio = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 3 / 2;
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    frame.style.width = `${Math.round(w)}px`;
    frame.style.height = `${Math.round(h)}px`;
  };
  fit(); // 先按占位比例定一次，不等图片——图没加载出来/404 时也不会缩没
  img.onload = fit;
  img.onerror = fit;
  window.addEventListener("resize", fit);

  modal.querySelectorAll("[data-id]").forEach(el => el.onclick = () => {
    const node = EXPEDITION_MAP.find(n => n.id === el.dataset.id);
    if (node) onGo(node);
  });
  modal.querySelector("[data-leave]").onclick = () => closeModal(cleanup);
}

// ── 探秘出发前：问一句特殊要求（对这次探秘活动的指令，可留空）────────
export function openExpeditionAsk(node, { onGo, guests = [] }) {
  let intent = "";
  const modal = openModal(`
    <div class="map-head">
      <span class="map-title">探 秘 · ${node.name}</span>
      <span class="return" data-leave style="margin-left:auto">Return · 返回</span>
    </div>
    <div class="exp-guests" style="margin:12px 22px 0">
      <div class="ck-label">此地常客 · 好感 &gt; 高愿意搭手，&gt; 更高肯让压箱底好料</div>
      ${guests.length ? guests.map(g => `
        <div class="exp-guest">
          <span class="exp-gname">${g.ryuwei ? `<span class="ryuwei-glow">${ryuweiTag(g.name)}</span>` : g.name}<i>${g.ident} · 好感 ${g.aff}（${affName(g.aff)}）</i></span>
          ${g.mem ? `<span class="exp-gmem">记得：${g.mem}</span>` : `<span class="exp-gmem none">还没有来往。</span>`}
        </div>`).join("") : `<span class="ck-mat zero">此地暂无熟人。</span>`}
    </div>
    <div class="set-note" style="margin:14px 22px">此行可有特殊要求？（你钦定的方向，AI 必须照办——可勾连上面的常客或他们的记忆）</div>
    <div class="ck-label" style="padding:0 22px">特殊要求</div>
    <div style="padding:0 22px"><input id="exp-intent" class="ck-intent" placeholder="如：去找条大鱼 / 去温掌柜那赊账 / 要能做甜点的料"></div>
    <div class="ck-btns" style="justify-content:flex-start;padding:0 22px"><span class="ck-btn plain" data-go>出 发</span></div>
  `, () => {});
  modal.querySelector("#exp-intent").oninput = (e) => { intent = e.target.value; };
  modal.querySelector("#exp-intent").addEventListener("keydown", (e) => { if (e.key === "Enter") modal.querySelector("[data-go]").click(); });
  modal.querySelector("[data-go]").onclick = () => { const v = intent.trim(); closeModal(); onGo(v); };
  modal.querySelector("[data-leave]").onclick = () => closeModal();
}

// ── 探秘关卡：右栏(#sulog)临时"夺舍"成选项面板，左栏(#log)继续主叙事 ──
let sulogSaved = null;
export function takeoverSulog(html) {
  const el = $("#sulog");
  sulogSaved = el.innerHTML;              // 先存苏唐历史，探秘结束再还原
  el.innerHTML = `<div class="exp-panel">${html}</div>`;
  el.scrollTop = 0;
}
export function restoreSulog() {
  if (sulogSaved !== null) {
    $("#sulog").innerHTML = sulogSaved;
    sulogSaved = null;
    $("#sulog").scrollTop = $("#sulog").scrollHeight;
  }
}
export function openChallengePanel(st, ch, { onPick, onSkip }) {
  takeoverSulog(`
    <div class="exp-panel-head">关 口</div>
    <div class="exp-prompt">${ch.prompt}</div>
    <div class="exp-label">师兄，此事如何处置？</div>
    <div class="exp-opts">
      ${(ch.options || []).map(o => {
        const d = o.dim;
        const c = (st.checks || {})[d] || {};
        const isDice = CHECK_DIMS.includes(d);
        const rank = isDice ? rankLabel(c.succ || 0, !!c.achieve) : "";
        const hint = isDice ? (c.achieve ? "此道已臻化境" : "成不成的，全看平日熟不熟此道") : "这一下，全凭平日功夫";
        const icon = DIMENSIONS[d]?.icon;
        return `<button class="exp-opt" data-dim="${d}" title="${hint}">
          ${icon ? `<img class="fav" src="./assets/${icon}">` : ""}<span>${o.text}</span>${rank ? `<i class="rank">${rank}</i>` : ""}</button>`;
      }).join("")}
      <button class="exp-opt skip" data-skip>算了，不掺和</button>
    </div>
  `);
  document.querySelectorAll("#sulog [data-dim]").forEach(el => el.onclick = () => { restoreSulog(); onPick(el.dataset.dim); });
  document.querySelector("#sulog [data-skip]").onclick = () => { restoreSulog(); onSkip?.(); };
}

// ── 邀请面板：收功后右栏底部浮层，可最小化，邀请好感>15的女客留坐 ──
let inviteCollapsed = false;
// 第二天开门：移除前一天晚上的邀请面板
export function dismissInvite() {
  const el = document.querySelector("#invite-panel");
  if (el) el.remove();
}
export function renderInvite(st, { onInvite, onCancel } = {}) {
  let el = document.querySelector("#invite-panel");
  if (!el) {
    el = document.createElement("div");
    el.id = "invite-panel";
    el.className = "invite-panel";
    document.body.appendChild(el);
  }
  const invited = st.invitedGuest ? findKnownGuest(st, st.invitedGuest) : null;
  const cands = inviteCandidates(st);
  const ordered = [...cands].sort((a, b) => (b.ryuwei ? 1 : 0) - (a.ryuwei ? 1 : 0)); // 食评人余味置顶
  el.classList.toggle("collapsed", inviteCollapsed);
  el.innerHTML = `
    <div class="invite-bar" data-toggle>🪑 请客坐坐${invited ? ` · ${invited.name}` : ""}<span class="invite-min">${inviteCollapsed ? "展开" : "收起"}</span></div>
    ${inviteCollapsed ? "" : `
    <div class="invite-body">
      <div class="invite-note">好感 &gt; 15 的女客可留坐闲聊——苏唐和她一起陪你说话。</div>
      ${ordered.length ? ordered.map(g => {
        const a = st.aff[g.id] || 0;
        const isInv = invited && invited.id === g.id;
        return `<div class="invite-row">
          <span class="invite-name">${g.ryuwei ? `<span class="ryuwei-glow">${ryuweiTag(g.name)}</span>` : g.name}<i>${g.ident}</i></span>
          <span class="invite-aff">好感 ${a}</span>
          ${isInv ? `<span class="ck-btn plain" data-cancel="${g.id}">请她回去</span>` : `<span class="ck-btn plain" data-invite="${g.id}">邀请</span>`}
        </div>`;
      }).join("") : `<div class="invite-none">还没有好感够的女客。多照顾几位姑娘的好感。</div>`}
    </div>`}
  `;
  el.querySelector("[data-toggle]").onclick = () => { inviteCollapsed = !inviteCollapsed; renderInvite(st, { onInvite, onCancel }); };
  el.querySelectorAll("[data-invite]").forEach(b => b.onclick = () => onInvite?.(b.dataset.invite));
  el.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => onCancel?.());
}

// ── 余味 CG 播放：点左上角圆圈(#spiral)，全屏夺舍播 16:9 CG ──────────
// 左上角圆圈能翻到的 CG 合集：随手气随机一张，池子以后加图直接往这加一条就行
const CG_LIST = [
  { src: "./assets/ryuwei_cg.png", alt: "余味" },
  { src: "./assets/sutang_cg.png", alt: "苏唐" },
];
export function openCg() {
  const pick = CG_LIST[Math.floor(Math.random() * CG_LIST.length)];
  const modal = openModal(`
    <div class="cg-wrap">
      <img class="cg-img" src="${pick.src}" alt="${pick.alt}">
      <span class="ck-btn plain" data-close>收 起</span>
    </div>
  `, null, "fullscreen");
  modal.querySelector("[data-close]").onclick = () => closeModal();
}

// ── 晨间送礼领取：仪式感弹层，玩家点「领取」才展示熟客送礼剧情 ──────
export function waitGiftClaim() {
  return new Promise(res => {
    const modal = openModal(`
      <div class="gift-wrap">
        <div class="gift-box">🎁</div>
        <div class="gift-title">晨 间 送 礼</div>
        <div class="gift-note">门边堆着几份心意——夜里熟客托人捎来的好东西，等着你收。</div>
        <span class="ck-btn plain" data-claim>🎁 领 取</span>
      </div>
    `, () => res());
    modal.querySelector("[data-claim]").onclick = () => { closeModal(); res(); };
  });
}

// ── 小吃面板（玩家只口述，苏唐自决；已会的可复做）──────────────────
export function openSnack(st, { onRequest, onRemake, onTag }) {
  let note = "";
  const HINTS = ["甜的", "辣的", "酸的", "来点汤", "烤串", "豆花饭", "点心", "随便"];
  function draw() {
    const stock = Object.entries(st.snacks || {}).filter(([, n]) => n > 0);
    const known = st.snackRecipes || [];
    const modal = openModal(`
      <h2>小 吃 · 招呼苏唐</h2>
      <div class="set-note">小吃是苏唐的活计。你只能口述（师妹，甜的/烤串做几个），做什么、用料、几份、品质，全凭她判断，都会写进主叙事。</div>
      <div class="ck-label">跟苏唐说</div>
      <input id="sn-note" class="ck-intent" placeholder="如：师妹，小吃甜的 / 烤串做几个" value="${note}">
      <div class="tagbar">${HINTS.map(hh => `<span class="tagchip on" data-hint="${hh}">${hh}</span>`).join("")}
        <span class="ck-btn plain" data-go>招呼苏唐</span></div>
      <div class="ck-label">已会的小吃 · 点标签换类，可复做</div>
      <div class="sn-list">${known.length ? known.map(k => `
        <div class="sn-row">
          <span class="sn-name">${k.name}<i>${k.cat}</i></span>
          <span class="tagchip on" data-tagcycle="${k.name}">${k.tag}</span>
          <span class="ck-btn plain" data-remake="${k.name}">复做</span>
        </div>`).join("") : `<span class="ck-mat zero">苏唐还没做过新小吃，先口述一个。</span>`}</div>
      <div class="ck-label">已备好</div>
      <div class="ck-mats">${stock.length ? stock.map(([n, c]) => `<span class="ck-mat zero">${n} ×${c}</span>`).join("") : `<span class="ck-mat zero">还没备。</span>`}</div>
      <div class="ck-label">苏唐手艺</div>
      <div class="skills">${Object.entries(st.suSkills || {}).map(([k, v]) => `<span class="skill">${k}<b>${v}</b></span>`).join("")}</div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelector("#sn-note").oninput = (e) => { note = e.target.value; };
    modal.querySelectorAll("[data-hint]").forEach(el => el.onclick = () => { note = el.dataset.hint; draw(); });
    modal.querySelector("[data-go]").onclick = () => onRequest(note.trim());
    modal.querySelectorAll("[data-remake]").forEach(el => el.onclick = () => onRemake(el.dataset.remake));
    modal.querySelectorAll("[data-tagcycle]").forEach(el => el.onclick = () => onTag(el.dataset.tagcycle));
    modal.querySelector("[data-back]").onclick = () => closeModal();
  }
  draw();
  return { redraw: draw };
}

// ── 佐餐（选小吃 → 出餐按钮）────────────────────────────────────────
export function openSet(st, { onSet, feast = false }) {
  let selSnack = null, selWine = null;
  const stock = Object.entries(st.snacks || {}).filter(([, n]) => n > 0);
  const wines = Object.entries(st.wines || {}).filter(([, n]) => n > 0);
  const wineInfo = (n) => (st.wineRecipes || []).find(r => r.name === n) || SHOP_WINES.find(w => w.name === n) || { quality: 60, desc: "" };
  function draw() {
    const modal = openModal(`
      <h2>佐 餐 ${feast ? "· 余味大阵仗" : "· 上菜搭个边"}</h2>
      <div class="set-note">${feast
        ? `大菜 ✓ 汤 ✓ ——选小吃和酒水，四样齐了「开席」，余味按 25%×4 评星。`
        : `给客人多搭一份苏唐备的小吃（可选酒水）。选好点「出餐」。`}</div>
      <div class="ck-label" style="padding:0 22px">小吃（苏唐备）</div>
      <div class="ck-mats">
        <span class="ck-mat ${selSnack === null ? "zero" : ""}" data-snack="">${feast ? "不配小吃" : "不佐餐"}</span>
        ${stock.map(([n, c]) => `<span class="ck-mat ${selSnack === n ? "" : "zero"}" data-snack="${n}" style="${selSnack === n ? "border-color:var(--gold);color:var(--gold)" : ""}">${n} ×${c}</span>`).join("")}
      </div>
      ${feast || wines.length ? `<div class="ck-label" style="padding:0 22px">酒水（酒库）</div>
      <div class="ck-mats">
        <span class="ck-mat ${selWine === null ? "zero" : ""}" data-wine="">不配酒</span>
        ${wines.map(([n, c]) => `<span class="ck-mat ${selWine === n ? "" : "zero"}" data-wine="${n}" style="${selWine === n ? "border-color:var(--gold);color:var(--gold)" : ""}">${n} ×${c} <i style="font-style:normal;opacity:.7">(品质${wineInfo(n).quality})</i></span>`).join("")}
      </div>` : ""}
      <div class="ck-btns"><span class="ck-btn" data-serve>${feast ? "开 席" : "出 餐"}</span></div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelectorAll("[data-snack]").forEach(el => el.onclick = () => { selSnack = el.dataset.snack || null; draw(); });
    modal.querySelectorAll("[data-wine]").forEach(el => el.onclick = () => { selWine = el.dataset.wine || null; draw(); });
    modal.querySelector("[data-serve]").onclick = () => { onSet(feast ? { snack: selSnack, wine: selWine } : selSnack); closeModal(); };
    modal.querySelector("[data-back]").onclick = () => closeModal();
  }
  draw();
}

// ── 世界回响 · 播放（主栏金色卷轴条目，等待时轮播）─────────────
const ECHO_BAR_KEY = "xiaochu-echo-bar";
export function echoBarOn() { return localStorage.getItem(ECHO_BAR_KEY) !== "0"; }
export function setEchoBar(v) { localStorage.setItem(ECHO_BAR_KEY, v ? "1" : "0"); }

export function showEcho(echo) {
  // 世界回响 → 底部滚动条（一条一条滚）；不再写左栏 log
  const bar = $("#echo-bar");
  if (!bar) return;
  if (!echoBarOn()) return; // 设置里关了就静默
  bar.classList.remove("hidden-bar");
  $("#term")?.classList.add("eb-space"); // 输入行抬高，别被滚动条盖住
  const txt = bar.querySelector(".echo-bar-text");
  txt.innerHTML = `<i>【${escapeHtml(echo.form || "传闻")}】</i><span class="eb-body">${escapeHtml(echo.prose || "")}</span>`;
  const body = txt.querySelector(".eb-body");
  body.style.animation = "none";
  void body.offsetWidth; // 重触发跑马灯
  body.style.animation = "";
}

// ── 上菜面板（多选）：菜库 + 小吃 + 酒，合计 ≤3 菜 + 1 酒 ──────
// 余味开席：必须 3 道菜 + 1 道酒（各 25%）；其他客人任意组合。先校验后扣料，选错不吞菜。
export function openServe(st, g, { onServe }) {
  const isRyu = !!g.ryuwei;
  let dishes = [], snacks = [], wine = null;
  const maxFood = 3;
  function draw() {
    const stock = Object.entries(st.snacks || {}).filter(([, n]) => n > 0);
    const wines = Object.entries(st.wines || {}).filter(([, n]) => n > 0);
    const nFood = dishes.length + snacks.length;
    const canGo = nFood > 0 && (!isRyu || (nFood === 3 && !!wine));
    const modal = openModal(`
      <h2>上 菜 ${isRyu ? "· 余味开席" : ""}</h2>
      <div class="set-note">${isRyu
        ? `余味开席要 <b>3 道菜 + 1 道酒</b>（菜库/小吃随意凑，各 25%）——凑不齐不能开席，选了的不会扣。已选 ${nFood}/3 菜${wine ? "+1酒" : ""}。`
        : `菜 + 小吃最多 <b>3 样</b> + 1 道酒，随意搭配。已选 ${nFood}/3 样${wine ? "+1酒" : ""}。`}</div>
      <div class="ck-label">菜库（你做的）</div>
      <div class="ck-mats">
        ${(st.dishStore || []).length
          ? st.dishStore.map((d, i) => `<span class="ck-mat ${dishes.includes(i) ? "" : "zero"}" data-dish="${i}">${d.name}${d.suCook ? "(苏唐做)" : ""}</span>`).join("")
          : `<span class="ck-mat zero">菜库空——先「主厨」做菜。</span>`}
      </div>
      <div class="ck-label">小吃（苏唐备）</div>
      <div class="ck-mats">
        ${stock.length
          ? stock.map(([n]) => `<span class="ck-mat ${snacks.includes(n) ? "" : "zero"}" data-snack="${n}">${n}</span>`).join("")
          : `<span class="ck-mat zero">苏唐还没备小吃。</span>`}
      </div>
      ${wines.length ? `<div class="ck-label">酒水</div>
      <div class="ck-mats">
        <span class="ck-mat ${wine === null ? "" : "zero"}" data-wine="">不配酒</span>
        ${wines.map(([n]) => `<span class="ck-mat ${wine === n ? "" : "zero"}" data-wine="${n}">${n}</span>`).join("")}
      </div>` : ""}
      <div class="ck-btns"><span class="ck-btn ${canGo ? "" : "off"}" data-serve>${isRyu ? "开 席" : "上 菜"}</span></div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelectorAll("[data-dish]").forEach(el => el.onclick = () => {
      const i = +el.dataset.dish;
      if (dishes.includes(i)) dishes = dishes.filter(x => x !== i);
      else if (nFood < maxFood) dishes.push(i);
      draw();
    });
    modal.querySelectorAll("[data-snack]").forEach(el => el.onclick = () => {
      const n = el.dataset.snack;
      if (snacks.includes(n)) snacks = snacks.filter(x => x !== n);
      else if (nFood < maxFood) snacks.push(n);
      draw();
    });
    modal.querySelectorAll("[data-wine]").forEach(el => el.onclick = () => { wine = el.dataset.wine || null; draw(); });
    modal.querySelector("[data-serve]").onclick = () => {
      if (!canGo) return;
      closeModal();
      onServe({ items: [...dishes.map(i => ({ kind: "dish", idx: i })), ...snacks.map(n => ({ kind: "snack", name: n }))], wine });
    };
    modal.querySelector("[data-back]").onclick = () => closeModal();
  }
  draw();
}

// ── 酿造面板（灶台式 4 格自由选料）· 基酒/甜点/入药/在酿一览 ──
export function openBrew(st, { onBrew, onBuy, onDessert, onMedicate }) {
  const BASE_OPTS = ["蜀南大米", "鱼定村青稞", "麦芽"];
  const QU_OPTS = ["甜酒曲", "麦曲", "大曲", "藏曲"];
  const EXTRA_OPTS = ["酸木瓜", "雕梅", "内江红糖", "雪山野蜂蜜", "玫瑰花酱", "避雨浆果窖藏酒", "乳扇", "牛奶", "喇嘛庙藏红花", "熊山松茸"];
  let slots = [null, null, null, null]; // 基底 / 曲 / 辅料 / 辅料（水是灶房常备，不占格）
  let distill = false;
  const pool = (i) => i === 0 ? BASE_OPTS.filter(n => (st.inv[n] || 0) > 0)
    : i === 1 ? QU_OPTS.filter(n => (st.inv[n] || 0) > 0)
    : EXTRA_OPTS.filter(n => (st.inv[n] || 0) > 0 && !slots.includes(n));
  const wineStr = Object.entries(st.wines || {}).map(([n, c]) => `${n}×${c}`).join("、") || "空";
  const brewing = (st.brewing || []).map(b => {
    const wait = Math.max(0, b.dueDay - st.day);
    return `「${b.name}」${wait === 0 ? "今周可取" : `再等 ${wait} 周`}`;
  }).join("；") || "坛子都空着";
  const hasRiceWine = Object.keys(st.wines || {}).some(n => (st.wines[n] || 0) > 0
    && ((st.wineRecipes || []).find(r => r.name === n)?.kind === "米酒" || SHOP_WINES.some(w => w.name === n)));
  const medWines = Object.keys(st.wines || {}).filter(n => (st.wines[n] || 0) > 0
    && ((st.wineRecipes || []).find(r => r.name === n)?.kind === "白酒" || (st.wineRecipes || []).find(r => r.name === n)?.kind === "黄酒" || SHOP_WINES.some(w => w.name === n && (w.strong || w.flavor === "chun"))));

  function draw() {
    const canGo = !!slots[0] && !!slots[1] && (st.inv[slots[0]] || 0) > 0 && (st.inv[slots[1]] || 0) > 0
      && slots.slice(2).every(s => !s || (st.inv[s] || 0) > 0);
    const modal = openModal(`
      <h2>酿 酒 · 苏唐的活计</h2>
      <div class="set-note">手艺 <b>${st.suSkills?.酿酒 ?? 5}</b> · 内功催酿（≥50 米酒立等可取）。水是灶房常备，基酒 = 水 + 粮食。</div>
      <div class="ck-label">4 格自由配（基底 / 曲 / 辅料×2，点击放入，点格取回）</div>
      <div class="ck-slots">${slots.map((s, i) =>
        `<div class="ck-slot ${s ? "" : "empty"}" data-slot="${i}">
           <span class="tag">${["基底", "曲", "辅料", "辅料"][i]}</span>${s || "空"}</div>`).join("")}</div>
      <div class="ck-label">可选料</div>
      <div class="ck-mats">
        ${pool(0).map(n => `<span class="ck-mat ${slots[0] === n ? "" : "zero"}" data-pick="0|${n}">${n}<i style="font-style:normal;opacity:.65"> 基底</i></span>`).join("")}
        ${pool(1).map(n => `<span class="ck-mat ${slots[1] === n ? "" : "zero"}" data-pick="1|${n}">${n}<i style="font-style:normal;opacity:.65"> 曲</i></span>`).join("")}
        ${pool(2).map(n => `<span class="ck-mat zero" data-pick="2|${n}">${n}</span>`).join("")}
        ${!pool(0).length && !pool(1).length && !pool(2).length ? `<span class="ck-mat zero">囊中无料——商店买基底/曲，或探秘寻料。</span>` : ""}
      </div>
      <div class="ck-label">工序</div>
      <div class="ck-chips">
        <span class="ck-chip ${!distill ? "on" : ""}" data-distill="0">封坛发酵</span>
        <span class="ck-chip ${distill ? "on" : ""}" data-distill="1">上甑蒸馏${(st.inv["蒸馏器"] || 0) ? "" : "（需蒸馏器）"}</span>
      </div>
      <div class="ck-btns"><span class="ck-btn ${canGo ? "" : "off"}" data-go>下 坛</span></div>
      <div class="set-note">酒库：${wineStr} ｜ 在酿：${brewing}</div>
      <div class="ck-label">商店基酒（应急）</div>
      ${SHOP_WINES.map(w => `<div class="brew-row" data-buy="${w.name}">
        <b>${w.name}</b><i>品质 ${w.quality} · ${w.price}文${w.strong ? " · 烈" : ""}</i><p>${w.desc}</p>
      </div>`).join("")}
      ${hasRiceWine ? `<div class="ck-label">米酒配甜（苏唐做甜点）</div>
      ${WINE_DESSERTS.map(d => `<div class="brew-row" data-dessert="${d.name}">
        <b>${d.name}</b><i>${d.cat} · 米酒 + ${d.sweet}</i><p>${d.desc}</p>
      </div>`).join("")}` : ""}
      ${medWines.length ? `<div class="ck-label">入药（白酒/黄酒泡药材 → 药酒）</div>
      ${medWines.map(w => MEDICINE_HERBS.map(h => `<div class="brew-row" data-med="${w}|${h.name}">
        <b>${h.name}药酒</b><i>${w} + ${h.name}</i><p>${h.desc}</p>
      </div>`).join("")).join("")}` : ""}
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelectorAll("[data-slot]").forEach(el => el.onclick = () => { slots[+el.dataset.slot] = null; draw(); });
    modal.querySelectorAll("[data-pick]").forEach(el => el.onclick = () => {
      const [i, n] = el.dataset.pick.split("|");
      slots[+i] = n; draw();
    });
    modal.querySelectorAll("[data-distill]").forEach(el => el.onclick = () => { distill = el.dataset.distill === "1"; draw(); });
    modal.querySelector("[data-go]").onclick = () => {
      if (!canGo) return;
      closeModal();
      onBrew({ base: slots[0], qu: slots[1], extras: slots.slice(2).filter(Boolean), distill });
    };
    modal.querySelectorAll("[data-buy]").forEach(el => el.onclick = () => onBuy(el.dataset.buy));
    modal.querySelectorAll("[data-dessert]").forEach(el => el.onclick = () => onDessert(el.dataset.dessert));
    modal.querySelectorAll("[data-med]").forEach(el => {
      const [w, h] = el.dataset.med.split("|");
      el.onclick = () => onMedicate(w, h);
    });
    modal.querySelector("[data-back]").onclick = () => closeModal();
  }
  draw();
}

// ── 邀客·点将明日（最多 GUESTS_PER_DAY 位，任何人，含踢馆八线当前挑战者，点/取消即改）──
export function openInviteGuest(st, { onToggle, onDone }) {
  const ryu = GUESTS.find(g => g.ryuwei);
  const known = [ryu, ...GUESTS.filter(g => !g.ryuwei), ...(st.customGuests || [])].filter(Boolean); // 食评人余味置顶
  const rivals = RIVAL_SCHOOLS.map((s, i) => ({ school: s, guest: rivalGuestForSchool(st, i) })).filter(x => x.guest);
  const card = (g, picks) => `
      <div class="menu-item-card pick ${picks.includes(g.id) ? "on" : ""}" data-pick="${g.id}">
        <b>${g.ryuwei ? `<span class="ryuwei-glow">${g.name}</span>` : g.name}</b><i>${g.ident}${g.ryuwei ? " · 顶级食评人" : ""}</i>
        <p>${g.order || ""}</p>
      </div>`;
  function draw() {
    const picks = st.nextGuestPicks || [];
    const modal = openModal(`
      <h2>邀 客 · 点 将 明 日</h2>
      <div class="set-note">最多选 ${GUESTS_PER_DAY} 位，不管认不认得、平日在哪个据点——明日准来，各占一个客位。已选 ${picks.length}/${GUESTS_PER_DAY}，点一下选中/取消。</div>
      ${rivals.length ? `<div class="ck-label">踢馆 · 八线各自进度，当前该来的挑战者</div>
      <div class="menu-list">${rivals.map(r => card(r.guest, picks)).join("")}</div>` : ""}
      <div class="ck-label">熟客</div>
      <div class="menu-list">${known.map(g => card(g, picks)).join("")}</div>
      <span class="return" data-back>Return · 返回</span>
    `, () => onDone?.());
    modal.querySelectorAll("[data-pick]").forEach(el => el.onclick = () => { onToggle(el.dataset.pick); draw(); });
    modal.querySelector("[data-back]").onclick = () => closeModal(() => onDone?.());
  }
  draw();
}

// ── 小纸条（每轮动作/对话的小总结，按天回看）────────────────────────
export function openNotes(st) {
  const list = (st.notes || []).slice().reverse();
  openModal(`
    <h2>小 纸 条</h2>
    <div class="set-note">每个动作与每轮对话的小总结，按天回看。</div>
    <div class="menu-list">${list.length ? list.map(n =>
      `<div class="menu-item-card"><b>第${n.day}周 · ${n.ts} · ${n.act}</b><p>${n.text}</p></div>`).join("")
      : `<span class="ck-mat zero">还没有纸条。</span>`}</div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}

// ── 背包 ───────────────────────────────────────────────────────────────
export function openBag(st) {
  const mats = Object.entries(st.inv).filter(([, n]) => n > 0);
  openModal(`
    <h2>仓 库</h2>
    <div class="ck-label">文钱 · ${st.coins}</div>
    <div class="ck-label">食材与调味品</div>
    <div class="ck-mats">${mats.length ? mats.map(([n, c]) =>
      `<span class="ck-mat zero">${n} ×${c}</span>`).join("") : "空空如也。"}</div>
    <div class="ck-label">炊具</div>
    <div class="ck-chips">${st.cookware.map(id => `<span class="ck-chip off">${COOKWARE_BY_ID[id].name}</span>`).join("")}</div>
    <div class="ck-label">技法 / 味型</div>
    <div class="ck-chips">
      ${st.techs.map(t => `<span class="ck-chip off">${t}</span>`).join("")}
      ${st.flavors.map(f => `<span class="ck-chip off">${FLAVOR_BY_ID[f].name}</span>`).join("")}
    </div>
    <div class="ck-label">师兄菜单（大菜）</div>
    <div class="menu-list">${(st.menu || []).length ? (st.menu || []).map(m =>
      `<div class="menu-item-card"><b>「${m.name}」</b><i>${(m.used || []).join("、")}</i><p>${m.desc || ""}</p></div>`).join("") : `<span class="ck-mat zero">还没做过大菜。</span>`}</div>
    <div class="ck-label">苏唐菜单（小吃）</div>
    <div class="menu-list">${(st.snackRecipes || []).length ? (st.snackRecipes || []).map(m =>
      `<div class="menu-item-card"><b>「${m.name}」</b><i>${m.tag} · ${(m.used || []).join("、")}</i><p>${m.desc || ""}</p></div>`).join("") : `<span class="ck-mat zero">苏唐还没做过小吃。</span>`}</div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}

// ── 设置 ───────────────────────────────────────────────────────────────
export function openSettings() {
  const cfg = loadCfg();
  const bst = bgmState();
  const bgmOptions = () => BGM_TRACKS.map((t, i) => `<option value="${i}" ${bst.idx === i ? "selected" : ""}>${t.name} · ${t.artist}</option>`).join("");
  const modal = openModal(`
    <h2>设 置 · AI 说书人</h2>
    <div class="set-row"><label>接口地址</label><input id="set-url" placeholder="OpenAI 兼容端点，如 https://api.deepseek.com" value="${cfg.endpoint || ""}"></div>
    <div class="set-row"><label>密钥</label><input id="set-key" type="password" placeholder="sk-... 只存本地浏览器" value="${cfg.apiKey || ""}"></div>
    <div class="set-row"><label>模型</label><input id="set-model" placeholder="如 deepseek-chat" value="${cfg.model || ""}"><span class="ck-btn plain" data-fetch>检索</span></div>
    <div class="set-row" id="set-list-row" style="display:none"><label>可选模型</label><select id="set-list"></select></div>
    <div class="set-row"><label>流式</label><input id="set-stream" type="checkbox" ${cfg.stream !== false ? "checked" : ""}></div>
    <div class="set-row"><label>■ 方块模式</label><input id="set-nsfw" type="checkbox" ${getNsfw() ? "checked" : ""}><span class="set-hint">亲密/做爱情节的写作规则注入</span></div>
    <div class="set-row"><label>长度上限</label><input id="set-max" type="number" min="1" step="1" value="${cfg.maxTokens ?? 200000}"></div>
    <div class="set-row"><label>出菜字数</label><input id="set-dish" type="number" min="40" step="10" value="${cfg.dishWords ?? 360}"></div>
    <div class="set-row"><label>闲聊字数</label><input id="set-chat" type="number" min="20" step="10" value="${cfg.chatWords ?? 160}"></div>
    <div class="set-row"><label>苏唐对话字数</label><input id="set-suwords" type="number" min="50" step="10" value="${cfg.suWords ?? 300}"></div>
    <div class="set-row"><label>小吃剧情字数</label><input id="set-snackwords" type="number" min="50" step="10" value="${cfg.snackWords ?? 300}"></div>
    <div class="set-row"><label>浮动 %</label><input id="set-tol" type="number" min="0" max="60" step="5" value="${cfg.tolPct ?? 15}"></div>
    <div class="set-row"><label>回响滚动条</label><input id="set-echo" type="checkbox" ${echoBarOn() ? "checked" : ""}><span class="set-hint">底部一条一条滚说书人的市井回响；可收起，这里随时开回</span></div>
    <div class="set-row" style="border-top:1px dashed #d8c3bd;margin-top:10px;padding-top:10px"><label>留声机</label><select id="set-bgm"><option value="-1" ${bst.on ? "" : "selected"}>停</option>${bgmOptions()}</select><span class="ck-btn plain" data-bgm-toggle>${bst.on ? "暂停" : "播放"}</span><span class="ck-btn plain" data-bgm-next>下首</span></div>
    <div class="set-row"><label>音量</label><input id="set-vol" type="range" min="0" max="100" step="1" value="${Math.round(bst.vol * 100)}"></div>
    <div class="set-row"><label>循环播放</label><input id="set-loop" type="checkbox" ${bst.loop ? "checked" : ""}><span class="set-hint">单曲循环，听完自己接着放</span></div>
    <div class="set-note" id="set-msg">流式开着，说书人的字边写边上屏；关了则想完一次给出。<br>长度上限即 max_tokens，默认 65536，厂商报参数错就调小。<br>出菜/闲聊字数是说书人正文的目标字数（±浮动%），想长想短自己调。<br>留声机的曲目/音量/循环即时生效，不用点保存。<br>不填也能玩——说书人退成模板白描，灶神照样起名。</div>
    <div class="ck-btns"><span class="ck-btn plain" data-save>保存</span></div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  const q = (s) => modal.querySelector(s);
  bgmInit();
  const syncBgm = () => {
    const s = bgmState();
    q("#set-bgm").value = String(s.idx);
    q("[data-bgm-toggle]").textContent = s.on ? "暂停" : "播放";
  };
  q("#set-bgm").onchange = () => {
    const i = parseInt(q("#set-bgm").value, 10);
    if (i < 0) bgmPause(); else bgmPlay(i);
    syncBgm();
  };
  q("[data-bgm-toggle]").onclick = () => { bgmToggle(); syncBgm(); };
  q("[data-bgm-next]").onclick = () => { bgmNext(); syncBgm(); };
  q("#set-vol").oninput = () => bgmSetVolume(parseInt(q("#set-vol").value, 10) / 100);
  q("#set-loop").onchange = () => bgmSetLoop(q("#set-loop").checked);
  q("[data-fetch]").onclick = async () => {
    q("#set-msg").textContent = "检索模型中…";
    try {
      const ids = await listModels({
        endpoint: q("#set-url").value.trim(),
        apiKey: q("#set-key").value.trim(),
      });
      const sel = q("#set-list");
      sel.innerHTML = ids.map(id => `<option value="${id}">${id}</option>`).join("");
      const cur = q("#set-model").value.trim();
      if (cur && ids.includes(cur)) sel.value = cur;
      sel.onchange = () => { q("#set-model").value = sel.value; };
      q("#set-list-row").style.display = "";
      q("#set-msg").textContent = `检索到 ${ids.length} 个模型，点选即填入。`;
    } catch (e) {
      q("#set-list-row").style.display = "none";
      q("#set-msg").textContent = `检索失败：${e.message}（看看密钥与地址对不对）`;
    }
  };
  q("[data-save]").onclick = () => {
    setNsfw(q("#set-nsfw")?.checked ?? getNsfw()); // ■ 方块模式（从顶部移到设置）
    setEchoBar(q("#set-echo")?.checked ?? true);   // 回响滚动条开关（即时生效，关则收起 bar）
    const mt = parseInt(q("#set-max").value, 10);
    const dw = parseInt(q("#set-dish").value, 10);
    const cw = parseInt(q("#set-chat").value, 10);
    const sw = parseInt(q("#set-suwords").value, 10);
    const tl = parseInt(q("#set-tol").value, 10);
    saveCfg({
      endpoint: q("#set-url").value.trim(),
      apiKey: q("#set-key").value.trim(),
      model: q("#set-model").value.trim(),
      stream: q("#set-stream").checked,
      maxTokens: Number.isFinite(mt) && mt > 0 ? mt : 65536,
      dishWords: Number.isFinite(dw) && dw >= 40 ? dw : 360,
      chatWords: Number.isFinite(cw) && cw >= 20 ? cw : 160,
      suWords: Number.isFinite(sw) && sw >= 50 ? sw : 300,
      snackWords: Number.isFinite(parseInt(q("#set-snackwords").value, 10)) && parseInt(q("#set-snackwords").value, 10) >= 50 ? parseInt(q("#set-snackwords").value, 10) : 300,
      tolPct: Number.isFinite(tl) && tl >= 0 && tl <= 60 ? tl : 15,
    });
    closeModal();
  };
  q("[data-back]").onclick = () => closeModal();
}

// ── 流程日志（TraceView，学 qucuo：每次 AI 调用的 prompt/回复/耗时）──
export function openTrace() {
  let open = null;
  function draw() {
    const traces = getTrace();
    const modal = openModal(`
      <h2>流 程 · 说书人调用日志（${traces.length} 条）</h2>
      <div class="ck-btns"><span class="ck-btn plain" data-clear>清空</span></div>
      ${traces.length === 0
        ? `<div class="set-note">还没有行动记录。出动作就记，AI 回复继续记；展开可看每次调用注入的全部 system/输入/回复。</div>`
        : traces.map((t, i) => `
          <div class="tr-item">
            <div class="tr-head" data-open="${i}">
              <span class="tr-label">${open === i ? "▾" : "▸"} 【${escapeHtml(t.act || "")}】</span>
              <span class="tr-ms">${t._running ? "⏳ 进行中" : `✓ ${fmtMs(t.totalMs)}`}</span>
              <span class="tr-cnt">${(t.pipelines || []).length} 次调用${t.summary ? " · " + escapeHtml(t.summary) : ""}</span>
            </div>
            ${open === i ? `<div class="tr-body">
              ${(t.steps || []).map(s => `<div class="tr-step"><i>${s.status === "pass" ? "✓" : "✗"}</i> [${escapeHtml(s.layer)}] ${escapeHtml(s.detail || "")}</div>`).join("")}
              ${(t.pipelines || []).map((p, pi) => `
                <div class="tr-sub">调用${pi + 1} · ${escapeHtml(p.label || "")} · ${fmtMs(p.ms)}</div>
                <div class="tr-sub">System Prompt</div><pre>${escapeHtml(p.system || "")}</pre>
                <div class="tr-sub">输入</div><pre>${escapeHtml(p.user || "")}</pre>
                <div class="tr-sub">AI 回复</div><pre>${escapeHtml(p.response || (p.error ? "报错：" + p.error : "（无）"))}</pre>
              `).join("")}
            </div>` : ""}
          </div>`).join("")}
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelector("[data-clear]").onclick = () => { clearTrace(); draw(); };
    modal.querySelector("[data-back]").onclick = () => closeModal();
    modal.querySelectorAll("[data-open]").forEach(el => el.onclick = () => {
      const i = +el.dataset.open;
      open = (open === i ? null : i);
      draw();
    });
  }
  draw();
}

// ── 帮助 ───────────────────────────────────────────────────────────────
export function openHelp() {
  openModal(`
    <h2>帮 助</h2>
    <div class="ck-label">体 例</div>
    <div class="sdesc" style="min-height:0;text-align:left;line-height:2">
      这本《西蜀豆花庄》是师兄（你）与师妹苏唐合写的日记。<br>
      旁白一律第三人称：「师兄如何如何」，假装客观，只写所见所闻。<br>
      每段末尾附一句「苏唐批」和「心情：」一个词。左栏她的表情随心情切换。
    </div>
    <div class="ck-label">一天的活计</div>
    <div class="sdesc" style="min-height:0;text-align:left;line-height:2">
      卯时开门，迎三位客人。客人点菜，你开灶：四格料槽 + 技法 + 炊具 + 味型，开火。<br>
      命中配方是名菜；配不上就「妙手偶得」，灶神（AI）即兴起名写味。<br>
      佐餐之后客人按口味付文钱——味型、技法、兴趣食材对上，钱就多。<br>
      三位送完自动收功，逛商店：厨具 / 技法 / 食材 / 味型；还可「探秘」——点开地图选个据点，去寻带星高级食材。然后「下一日」。
    </div>
    <div class="ck-label">终端命令</div>
    <div class="sdesc" style="min-height:0;text-align:left;line-height:2">
      帮助 · 灶台/做菜 · 佐餐 · 小吃 · 邀客 · 商店 · 探秘 · 下一日 · 仓库 · 设置 · 存档<br>
      直接说话也行：说书人会接话；说「做 冷锅鱼」或提到食材，灶台自动备料。
    </div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}
