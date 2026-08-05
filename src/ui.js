// 西蜀豆花庄 · 界面层（DOM）
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE_BY_ID, FLAVORS, FLAVOR_BY_ID,
  ING_BY_NAME, HOURS, SNACKS, ingTag, ING_TAGS,
} from "./data.js";
import { judgeStove, shopStock, currentGuest, affName, SKILLS } from "./state.js";
import { loadCfg, saveCfg, listModels, getTrace, clearTrace, fmtMs, rateDots, rateState } from "./ai.js";

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
const RICH = new Set(["narr", "say"]);
function richHtml(text) {
  const esc = escapeHtml(text);
  const colored = esc.replace(/(「[^」]*」|\*[^*\n]+\*)/g, (m) =>
    m[0] === "「" ? `<span class="seg-say">${m}</span>` : `<span class="seg-thought">${m}</span>`);
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
const mkEntry = (target, type) => {
  const div = document.createElement("div");
  div.className = `entry ${type}`;
  div.innerHTML = `<span class="ts">${ts()}</span><span class="bd"></span>`;
  target.appendChild(div);
  return div.querySelector(".bd");
};

export function log(type, text, { instant = false } = {}) {
  queue = queue.then(() => new Promise((done) => {
    const bd = mkEntry($("#log"), type);
    const put = (str) => { if (RICH.has(type)) bd.innerHTML = richHtml(str); else bd.textContent = str; };
    const finish = () => {
      put(text);
      bd.parentElement.classList.remove("typing");
      $("#log").scrollTop = $("#log").scrollHeight;
      skip = false;
      done();
    };
    if (instant || skip) return finish();
    bd.parentElement.classList.add("typing");
    let i = 0;
    const timer = setInterval(() => {
      i += 5;
      put(text.slice(0, i));
      $("#log").scrollTop = $("#log").scrollHeight;
      if (skip || i >= text.length) { clearInterval(timer); finish(); }
    }, 10);
  }));
  return queue;
}

// 右栏·苏唐日志（粉色，即时，带时间戳）
export function slog(type, text) {
  const bd = mkEntry($("#sulog"), type);
  bd.textContent = text;
  $("#sulog").scrollTop = $("#sulog").scrollHeight;
}
// 流式上屏：AI 边写边长，返回句柄。
// 走同一条日志队列排队创建 div，保证排在未打完的条目之后（不往上插）。
export function logStream(type) {
  let entry = null, bd = null, text = "", ready = false, pendingApply = null;
  const put = (str) => { if (RICH.has(type)) bd.innerHTML = richHtml(str); else bd.textContent = str; };
  const doApply = (main, comment) => {
    put(main);
    if (comment) {
      const c = document.createElement("div");
      c.className = "entry comment";
      c.innerHTML = `<span class="ts">${ts()}</span><span class="bd">${escapeHtml(comment)}</span>`;
      entry.after(c);
    }
    $("#log").scrollTop = $("#log").scrollHeight;
  };
  queue = queue.then(() => new Promise(done => {
    bd = mkEntry($("#log"), type);
    entry = bd.parentElement;
    if (text) put(text);
    ready = true;
    if (pendingApply) { doApply(pendingApply.main, pendingApply.comment); pendingApply = null; }
    $("#log").scrollTop = $("#log").scrollHeight;
    done();
  }));
  return {
    append(c) {
      text += c;
      if (ready) { put(text); $("#log").scrollTop = $("#log").scrollHeight; }
    },
    apply(main, comment) {
      if (ready) doApply(main, comment);
      else pendingApply = { main, comment };
    },
    remove() {
      if (ready) entry.remove();
      else queue = queue.then(() => entry?.remove());
    },
    get text() { return text; },
  };
}

export const narr = (t) => log("narr", t);
export const say = (t) => log("say", t);
export const sys = (t) => log("sys", t, { instant: true });
export const gold = (t) => log("gold", t);
export const playerLine = (t) => log("player", t, { instant: true });
export const commentLine = (t) => log("comment", `苏唐批：${t}`);
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
  el.style.backgroundPosition = moodPos(currentMood);
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

// ── 三栏渲染 ───────────────────────────────────────────────────────────
export function renderStatus(st) {
  const hour = st.phase === "closing" ? HOURS[4] : HOURS[Math.min(st.served, 3)];
  $("#status").innerHTML =
    `第<b>${st.day}</b>天 · ${hour} · 客人 <b>${st.served}/3</b> · <b>${st.coins}</b> 文`;
}

export function renderLeft(st) {
  const guest = st.phase === "guest" ? currentGuestSafe(st) : null;
  let html = `<h3>灶 房</h3>
    <div class="row"><span>日子</span><span class="v">第 ${st.day} 天</span></div>
    <div class="row"><span>文钱</span><span class="v">${st.coins}</span></div>
    <div class="row"><span>累计迎客</span><span class="v">${st.totalServed} 位</span></div>`;
  html += `<h3>客 人</h3>`;
  if (guest) {
    html += `<div id="guestcard" class="pcard">
      <div class="portrait">${guest.name[0]}</div>
      <div class="gname">${guest.name}</div>
      <div class="gid">${guest.ident} · 消费力 ${guest.spend} 文</div>
      <div class="gid">好感 ${(st.aff || {})[guest.id] || 0} · ${affName((st.aff || {})[guest.id] || 0)}</div>
      <div class="gorder">「${guest.order}」</div>
    </div>`;
  } else {
    html += `<div id="guestcard" class="pcard"><div class="gid">${st.phase === "closing" ? "今日客已送完" : "灶房空着"}</div></div>`;
  }
  html += `<h3>手中菜</h3>`;
  html += st.dish
    ? `<div id="dishcard"><div class="dname">「${st.dish.name}」</div><div>${st.dish.technique} · ${st.dish.flavorId ? FLAVOR_BY_ID[st.dish.flavorId].name : "家常"}</div></div>`
    : `<div id="dishcard"><div class="gid">锅里还空着</div></div>`;
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
    snack: true,
    serve: st.phase === "guest" && !!st.dish, // 佐餐（含佐餐set）
    close: st.phase === "guest" && st.served >= 3,
    shop: st.phase === "closing",
    next: st.phase === "closing",
  };
  const item = (label, key, enabled, fn) =>
    `<div class="menu-item ${enabled ? "" : "disabled"}" data-act="${fn}">
       <span>${label}</span><span class="key">${key}</span></div>`;
  $("#side").innerHTML =
    item("灶台", "C", can.cook, "cook") +
    item("小吃", "X", can.snack, "snack") +
    item("佐餐", "S", can.serve, "serve") +
    item("收功", "R", can.close, "close") +
    item("商店", "T", can.shop, "shop") +
    item("下一日", "N", can.next, "next") +
    `<div class="sep"></div>` +
    item("仓库", "I", true, "bag") +
    item("设置", "F", true, "settings") +
    item("流程", "L", true, "trace") +
    item("存档", "Q", true, "save") +
    item("帮助", "H", true, "help") +
    `<div class="hint">说书人听着呢——<br>终端里直接说话也行，<br>说「做 XX」就开灶。</div>` +
    `<div class="sucard" aria-hidden="true">
       <div id="sutang" class="sutang" style="background-position:${moodPos(currentMood)}"></div>
       <div class="suname">苏唐</div>
     </div>`;
  $("#side").querySelectorAll(".menu-item:not(.disabled)").forEach(el => {
    el.onclick = () => h[el.dataset.act]?.();
  });
}

export function renderAll(st, h) {
  renderStatus(st);
  renderLeft(st);
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
export function openCook(st, { onFire, prefill } = {}) {
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
  const excluded = new Set(); // 灶台标签筛选（排除）

  function draw() {
    const judge = judgeStove(st, slots, techId, cwId, flavorId);
    const filled = slots.filter(Boolean);
    const counts = {};
    slots.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });

    const mats = Object.entries(st.inv).filter(([name, n]) => n > 0 && !excluded.has(ingTag(name)));
    const modal = openModal(`
      <h2>灶 台 · 烹饪</h2>
      <div class="ck-label">料 · 调味料与食材混装（点击放入，点格取回）</div>
      <div class="ck-slots">${slots.map((s, i) =>
        `<div class="ck-slot ${s ? "" : "empty"}" data-slot="${i}">
           <span class="tag">料${i + 1}</span>${s || "空"}</div>`).join("")}</div>

      <div class="tagbar">${ING_TAGS.map(t =>
        `<span class="tagchip ${excluded.has(t) ? "off" : "on"}" data-tag="${t}">${t}</span>`).join("")}</div>
      <div class="ck-label">🎒 可用材料</div>
      <div class="ck-mats">${mats.length ? mats.map(([name, n]) => {
        const left = n - (counts[name] || 0);
        return `<span class="ck-mat ${left > 0 ? "" : "zero"}" data-mat="${name}">${name}<i style="color:var(--ink-dim);font-size:10px"> ${ingTag(name)}</i> ×${left}</span>`;
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
        <span class="ck-btn" data-fire>开 火</span>
        <span class="ck-btn plain" data-clear>清空</span>
        <span class="ck-btn plain" data-back>返回</span>
      </div>
    `, () => {});

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
      excluded.has(t) ? excluded.delete(t) : excluded.add(t);
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
export function openShop(st, { onBuy, onLeave, onRefresh }) {
  let tab = "ingredient";
  let cartOpen = false;
  const excluded = new Set();
  const TABS = { ingredient: ["食材", "ingredient"], cookware: ["厨具", "cookware"],
    tech: ["技法", "tech"], flavor: ["味型", "flavor"] };
  const qkey = (id) => `${tab}:${id}`;
  const qtyOf = (id) => st.buyQty[qkey(id)] || 1;

  const modal = openModal(`
    <div class="shop-head">
      <span class="shop-coins" id="shop-coins">${st.coins} 文</span>
      <span class="shop-cartbtn" data-cart>🧺 购物车</span>
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
    return tab === "ingredient" ? s.filter(i => !excluded.has(ingTag(i.name))) : s;
  }
  function iconFor() {
    return ICONS[tab === "tech" ? "tech" : tab === "flavor" ? "flavor" : tab === "ingredient" ? "ingredient" : "cookware"];
  }
  function cardHtml(it) {
    const isIng = tab === "ingredient";
    const q = qtyOf(it.id);
    const poor = !it.owned && st.coins < it.price * q;
    return `<div class="scard ${poor ? "poor" : ""} ${it.owned && !isIng ? "owned" : ""}">
      <div class="sname">${it.name}${isIng ? ` <i style="color:var(--ink-dim);font-size:11px">${ingTag(it.name)}</i>` : ""}</div>
      <div class="sicon">${iconFor()}</div>
      <div class="sdesc">${it.extra ? `<i>${it.extra}</i><br>` : ""}${it.desc}</div>
      <div class="scost">价：${coin(it.price)}</div>
      ${isIng ? `<div class="qty"><span data-q="-1" data-id="${it.id}">−</span><b>${q}</b><span data-q="1" data-id="${it.id}">＋</span></div>` : ""}
      <div class="sbuy" data-buy="${it.id}">${it.owned && !isIng ? "已拥有" : poor ? "买不起" : (isIng ? `买 ${q} 份` : "买下")}</div>
    </div>`;
  }
  function tagbarHtml() {
    return `<div class="tagbar">${ING_TAGS.map(t =>
      `<span class="tagchip ${excluded.has(t) ? "off" : "on"}" data-tag="${t}">${t}</span>`).join("")}</div>`;
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
      excluded.has(t) ? excluded.delete(t) : excluded.add(t);
      renderGrid(true);
    });
    b.querySelectorAll("[data-q]").forEach(el => el.onclick = () => {
      const id = el.dataset.id;
      const d = +el.dataset.q;
      st.buyQty[qkey(id)] = Math.max(1, Math.min(9, qtyOf(id) + d)); // 锁定，以后默认这份数
      renderGrid(true);
    });
    b.querySelectorAll("[data-buy]").forEach(el => el.onclick = () => {
      if (el.textContent === "买不起" || el.textContent === "已拥有") return;
      const r = onBuy(tab, el.dataset.buy, qtyOf(el.dataset.buy));
      if (r.ok) { modal.querySelector("#shop-coins").textContent = `${st.coins} 文`; renderGrid(true); }
    });
    const co = b.querySelector("[data-checkout]");
    if (co) co.onclick = () => {
      for (const [k, q] of Object.entries(st.buyQty || {})) {
        if (q <= 0) continue;
        const [tb, id] = k.split(":");
        onBuy(tb, id, q);
      }
      modal.querySelector("#shop-coins").textContent = `${st.coins} 文`;
      renderGrid(true);
    };
  }

  modal.querySelectorAll("[data-tab]").forEach(el => el.onclick = () => { tab = el.dataset.tab; renderGrid(false); });
  modal.querySelector("[data-refresh]").onclick = () => { onRefresh?.(); renderGrid(true); };
  modal.querySelector("[data-cart]").onclick = () => { cartOpen = !cartOpen; renderGrid(true); };
  modal.querySelector("[data-leave]").onclick = () => closeModal(onLeave);
  renderGrid(false);
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
export function openSet(st, { onSet }) {
  let sel = null;
  const stock = Object.entries(st.snacks || {}).filter(([, n]) => n > 0);
  function draw() {
    const modal = openModal(`
      <h2>佐 餐 · 上菜搭个边</h2>
      <div class="set-note">给客人多搭一份苏唐备的小吃。选好点「出餐」。当前：${sel || "不佐餐"}。</div>
      <div class="ck-mats">
        <span class="ck-mat ${sel === null ? "zero" : ""}" data-set="">不佐餐</span>
        ${stock.map(([n, c]) => `<span class="ck-mat ${sel === n ? "" : "zero"}" data-set="${n}" style="${sel === n ? "border-color:var(--gold);color:var(--gold)" : ""}">${n} ×${c}</span>`).join("")}
      </div>
      <div class="ck-btns"><span class="ck-btn" data-serve>出 餐</span></div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    modal.querySelectorAll("[data-set]").forEach(el => el.onclick = () => { sel = el.dataset.set || null; draw(); });
    modal.querySelector("[data-serve]").onclick = () => { onSet(sel); closeModal(); };
    modal.querySelector("[data-back]").onclick = () => closeModal();
  }
  draw();
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
  const modal = openModal(`
    <h2>设 置 · AI 说书人</h2>
    <div class="set-row"><label>接口地址</label><input id="set-url" placeholder="OpenAI 兼容端点，如 https://api.deepseek.com" value="${cfg.endpoint || ""}"></div>
    <div class="set-row"><label>密钥</label><input id="set-key" type="password" placeholder="sk-... 只存本地浏览器" value="${cfg.apiKey || ""}"></div>
    <div class="set-row"><label>模型</label><input id="set-model" placeholder="如 deepseek-chat" value="${cfg.model || ""}"><span class="ck-btn plain" data-fetch>检索</span></div>
    <div class="set-row" id="set-list-row" style="display:none"><label>可选模型</label><select id="set-list"></select></div>
    <div class="set-row"><label>流式</label><input id="set-stream" type="checkbox" ${cfg.stream !== false ? "checked" : ""}></div>
    <div class="set-row"><label>长度上限</label><input id="set-max" type="number" min="1" step="1" value="${cfg.maxTokens ?? 200000}"></div>
    <div class="set-row"><label>出菜字数</label><input id="set-dish" type="number" min="40" step="10" value="${cfg.dishWords ?? 360}"></div>
    <div class="set-row"><label>闲聊字数</label><input id="set-chat" type="number" min="20" step="10" value="${cfg.chatWords ?? 160}"></div>
    <div class="set-row"><label>浮动 %</label><input id="set-tol" type="number" min="0" max="60" step="5" value="${cfg.tolPct ?? 15}"></div>
    <div class="set-note" id="set-msg">流式开着，说书人的字边写边上屏；关了则想完一次给出。<br>长度上限即 max_tokens，默认 200000，厂商报参数错就调小。<br>出菜/闲聊字数是说书人正文的目标字数（±浮动%），想长想短自己调。<br>不填也能玩——说书人退成模板白描，灶神照样起名。</div>
    <div class="ck-btns"><span class="ck-btn plain" data-save>保存</span></div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  const q = (s) => modal.querySelector(s);
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
    const mt = parseInt(q("#set-max").value, 10);
    const dw = parseInt(q("#set-dish").value, 10);
    const cw = parseInt(q("#set-chat").value, 10);
    const tl = parseInt(q("#set-tol").value, 10);
    saveCfg({
      endpoint: q("#set-url").value.trim(),
      apiKey: q("#set-key").value.trim(),
      model: q("#set-model").value.trim(),
      stream: q("#set-stream").checked,
      maxTokens: Number.isFinite(mt) && mt > 0 ? mt : 200000,
      dishWords: Number.isFinite(dw) && dw >= 40 ? dw : 360,
      chatWords: Number.isFinite(cw) && cw >= 20 ? cw : 160,
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
        ? `<div class="set-note">还没有调用记录。做道菜、说句话，这里就会记下喂给 AI 的完整 prompt、回复和每轮耗时。</div>`
        : traces.map((t, i) => `
          <div class="tr-item">
            <div class="tr-head" data-open="${i}">
              <span class="tr-label">${open === i ? "▾" : "▸"} ${escapeHtml(t.label)}</span>
              <span class="tr-ms">${fmtMs(t.ms)}${t.error ? " · ✗" : ""}</span>
              <span class="tr-cnt">prompt ${(t.system || "").length + (t.user || "").length} 字 · 回复 ${(t.response || "").length} 字</span>
            </div>
            ${open === i ? `<div class="tr-body">
              <div class="tr-sub">System Prompt</div><pre>${escapeHtml(t.system || "")}</pre>
              <div class="tr-sub">输入</div><pre>${escapeHtml(t.user || "")}</pre>
              <div class="tr-sub">AI 回复</div><pre>${escapeHtml(t.response || (t.error ? "报错：" + t.error : "（无）"))}</pre>
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
      上菜之后客人按口味付文钱——味型、技法、兴趣食材对上，钱就多。<br>
      三位送完，收功，逛商店：厨具 / 技法 / 食材 / 味型。然后睡觉，明日再开。
    </div>
    <div class="ck-label">终端命令</div>
    <div class="sdesc" style="min-height:0;text-align:left;line-height:2">
      帮助 · 灶台/做菜 · 上菜 · 收功 · 商店 · 背包 · 设置 · 存档<br>
      直接说话也行：说书人会接话；说「做 冷锅鱼」或提到食材，灶台自动备料。
    </div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}
