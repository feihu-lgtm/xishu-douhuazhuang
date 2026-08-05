// 西蜀豆花庄 · 主循环
import { ING_BY_NAME, RECIPES } from "./data.js";
import {
  newState, saveGame, loadGame, hasSave, currentGuest, judgeStove,
  scoreDish, tierOf, payOf, buyItem, nextDay, affDeltaFor, affName,
  applyMartialExp, applySuExp, computeBaseScore, refreshShop, shopStock,
} from "./state.js";
import {
  loadCfg, genDish, genReaction, genChat, genMartial, genSnack, genReview,
  extractComment, splitSayMood, moodIndex, fmtMs, rateDots, rateState, menuDescOf, tierOfScore,
} from "./ai.js";
import {
  narr, say, sys, gold, playerLine, renderAll, openCook, openShop,
  openBag, openSettings, openHelp, openTrace, closeModal, logStream,
  commentLine, setMood, suLine, suSys, openSnack, openSet, renderRate,
} from "./ui.js";

let st = null;
let busy = false;

const handlers = {
  cook: () => doCook(),
  snack: () => doSnackPanel(),
  serve: () => doZuocan(),
  close: () => doClose(),
  shop: () => doShop(),
  next: () => doNext(),
  bag: () => openBag(st),
  settings: () => openSettings(),
  trace: () => openTrace(),
  save: () => { saveGame(st); sys("存档完毕。"); },
  help: () => openHelp(),
};

// ── 开场 ───────────────────────────────────────────────────────────────
async function startNew() {
  st = newState();
  $("#start").style.display = "none";
  setMood(0);
  renderAll(st, handlers);
  await narr("卯时，溪边的雾还没散。师兄把旧铁锅刷了一遍，灶膛里火苗舔着锅底。");
  await say("「师兄，火旺了。」苏唐从灶后探出头，红衣汉服的一角掖在腰间，手里还擦着碗。");
  await narr("西蜀豆花庄，今天开张。这本日记，师兄和苏唐轮流动笔。");
  sys("你是师兄，小厨。两件事：做菜，迎客。输入「帮助」看命令。");
  await guestArrives();
}

async function continueGame() {
  st = loadGame();
  if (!st) return startNew();
  $("#start").style.display = "none";
  renderAll(st, handlers);
  sys(`读档完毕 · 第 ${st.day} 天，${st.coins} 文。`);
  if (st.phase === "guest") {
    const g = currentGuest(st);
    if (g) await narr(`${g.name} 还坐在灶边等菜。`);
  } else if (st.phase === "closing") {
    sys("今日已收功，商店开着。");
    doShop();
  }
}

// ── 客人 ───────────────────────────────────────────────────────────────
async function guestArrives() {
  const g = currentGuest(st);
  if (!g) return;
  setMood(1);
  renderAll(st, handlers);
  await narr(`门帘一掀，${g.name}（${g.ident}）走了进来，找个灶边位子坐下。`);
  await say(`「${g.order}」`);
  sys(`第 ${st.served + 1} 位客人。右栏「灶台」开火，做好了「上菜」。`);
}

// ── 做菜 ───────────────────────────────────────────────────────────────
function doCook(prefill) {
  if (st.phase !== "guest") { sys("这会儿不开灶。"); return; }
  openCook(st, { onFire, prefill });
}

function onFire(slots, techId, cwId, flavorId, intended) {
  if (busy) return { ok: false, warn: "说书人还在想词，稍等。" };
  const j = judgeStove(st, slots, techId, cwId, flavorId);
  if (!j.ok) return j;
  j.intended = intended || "";
  for (const m of j.materials) {
    st.inv[m] = (st.inv[m] || 0) - 1;
    if (st.inv[m] <= 0) delete st.inv[m];
  }
  st.dish = {
    name: j.recipe?.name || "……",
    materials: j.materials,
    technique: techId,
    cookwareId: cwId,
    flavorId: j.flavorId,
    quality: j.quality,
    recipe: !!j.recipe,
  };
  closeModal();
  cookNarrate(j);
  return { ok: true };
}

async function cookNarrate(j) {
  busy = true;
  setMood(7);
  renderAll(st, handlers);
  await narr("师兄开火。灶膛噼啪一声，火苗蹿高，苏唐往灶里添了把柴。");
  const lore = j.materials
    .map(m => ING_BY_NAME[m]?.lore)
    .filter(Boolean)
    .map((l, i) => `${j.materials[i]}——${l}`);
  // 第一轮·武学裁决：练哪几门功 + 食材配合分
  const cfg = loadCfg();
  const martial = await genMartial(cfg, {
    materials: j.materials, technique: st.dish.technique,
    cookware: j.cookware, intended: j.intended, recipe: j.recipe,
  });
  const got = applyMartialExp(st, martial.external, martial.internal);
  const baseScore = computeBaseScore(st, {
    technique: st.dish.technique, cookware: j.cookware,
    synergy: martial.synergy, external: martial.external,
  });
  st.dish.baseScore = baseScore;
  st.dish.martial = martial;
  renderAll(st, handlers);
  sys(`练功：${got.join("、")} 各+3 · 食材配合 ${martial.synergy} · 基础分 ${baseScore}`);
  // 第二轮·出菜叙事（带上任务：做给谁、TA 爱什么味）
  const g = currentGuest(st);
  const h = logStream("narr");
  const res = await genDish(cfg, {
    materials: j.materials,
    lore,
    technique: st.dish.technique,
    cookware: j.cookware,
    flavorId: j.flavorId,
    recipeName: j.recipe?.name || null,
    martial, baseScore,
    guest: g,
  }, c => h.append(c));
  if (res.ai && h.text) {
    const { main, comment, mood } = extractComment(h.text);
    h.apply(main, comment ? `苏唐批：${comment}` : "");
    setMood(moodIndex(mood) ?? 0);
  } else {
    h.remove(); await narr(res.prose);
    if (res.comment) await commentLine(res.comment);
    setMood(res.mood ?? 0);
  }
  st.dish.name = res.name || st.dish.name;
  st.dish.menuDesc = res.menu || menuDescOf({ materials: j.materials, technique: st.dish.technique, flavorId: j.flavorId }, st.dish.name);
  st.menu = st.menu || [];
  const mrec = st.menu.find(x => x.name === st.dish.name);
  if (mrec) { mrec.desc = st.dish.menuDesc; mrec.used = j.materials; }
  else st.menu.push({ name: st.dish.name, used: j.materials, desc: st.dish.menuDesc });
  gold(`「${st.dish.name}」出锅。`);
  if (res.ms != null) sys(`说书 ${fmtMs(res.ms)} · 正文 ${res.prose.length} 字`);
  if (!res.ai) sys("（说书人未接线，灶神模板白描。设置里填 AI 密钥可现写。）");
  busy = false;
  renderAll(st, handlers);
  saveGame(st);
}

// ── 上菜 ───────────────────────────────────────────────────────────────
function waitBusy() {
  return new Promise(res => {
    const t = setInterval(() => { if (!busy) { clearInterval(t); res(); } }, 80);
  });
}

async function doServe() {
  if (st.phase !== "guest" || !st.dish) return;
  await waitBusy();
  if (st.phase !== "guest" || !st.dish) return;
  const g = currentGuest(st);
  if (!g) return;
  busy = true;
  const dish = st.dish;
  const flavorMatch = dish.flavorId === g.flavor;
  const favMatch = !!(g.fav && dish.materials.includes(g.fav));
  let score = scoreDish(dish, g);
  // 配set 彩蛋：搭一份苏唐备的小吃；小吃味型由苏唐那次调用自己选定
  let setName = null, snackMatch = false;
  if (st.pendingSet && (st.snacks || {})[st.pendingSet] > 0) {
    setName = st.pendingSet;
    st.snacks[setName] -= 1;
    score = Math.min(100, score + 8);
    const srec = (st.snackRecipes || []).find(x => x.name === setName);
    snackMatch = !!srec && srec.flavor === g.flavor;
    if (snackMatch) score = Math.min(100, score + 6);
  }
  const tier = tierOf(score);
  (st.dayLog = st.dayLog || []).push({ id: g.id, name: g.name, order: g.order, dish: dish.name, tier, flavorMatch, favMatch, score });
  st.aff = st.aff || {};
  const affNow = st.aff[g.id] || 0;
  const pay = payOf(g, score, affNow) + (setName ? 2 : 0);
  const mainDesc = dish.menuDesc || "";
  const snackDesc = setName ? ((st.snackRecipes || []).find(x => x.name === setName)?.desc || "") : "";
  await narr(`师兄把「${dish.name}」端上桌，往 ${g.name} 面前一放。`);
  if (mainDesc) await narr(`【菜牌】${mainDesc}`);
  if (setName) {
    await suLine(`【苏唐】顺手给 ${g.name} 搭了份「${setName}」，算我请的边角。`);
    if (snackDesc) await narr(`【菜牌】${snackDesc}`);
  }
  const h = logStream("narr"); // 品尝场景进左栏
  const r = await genReaction(loadCfg(), {
    guest: g, dishName: dish.name, score, tier,
    aff: affNow, affName: affName(affNow),
    mainDesc, snackName: setName, snackDesc,
  }, c => h.append(c));
  if (r.ai && h.text) {
    setMood(r.mood ?? [2, 0, 5, 6][tier]);
  } else {
    h.remove(); await narr(r.scene || "");
    setMood(r.mood ?? [2, 0, 5, 6][tier]);
  }
  // 好感结算：满意度+口味匹配+配set 勾连
  const d = affDeltaFor(tier, flavorMatch || snackMatch, favMatch) + (setName ? 1 : 0);
  st.aff[g.id] = Math.max(0, Math.min(100, affNow + d));
  st.coins += pay;
  st.earned += pay;
  st.totalServed += 1;
  st.served += 1;
  st.dish = null;
  st.pendingSet = null;
  gold(`${g.name} 放下 ${pay} 文铜钱。（满意度 ${score}）`);
  sys(`「好感」${g.name} ${d >= 0 ? "+" : ""}${d}（今 ${st.aff[g.id]} · ${affName(st.aff[g.id])}）`);
  if (r.ms != null) sys(`说书 ${fmtMs(r.ms)}`);
  busy = false;
  if (st.served >= 3) {
    st.phase = "closing";
    await narr("最后一位客人走了。师兄卸下门板，灶膛压上火，抹了抹灶台。");
    sys("今日收功。右栏「商店」学艺备菜，可进出自由；「下一日」才翻篇。");
    renderAll(st, handlers);
    saveGame(st);
    await doReview();
  } else {
    saveGame(st);
    await guestArrives();
  }
}

// ── 收功 / 商店 / 新的一天 ─────────────────────────────────────────────
function doClose() {
  if (st.phase === "guest" && st.served >= 3) {
    st.phase = "closing";
    narr("你卸下门板，灶膛压上火。");
    sys("商店开了。");
    renderAll(st, handlers);
    saveGame(st);
    doShop();
  } else {
    sys("还有客人没送完呢。");
  }
}

// ── 收工总评（苏唐逐客复盘 + 添好感）────────────────────────────────
async function doReview() {
  if ((st.reviewedDay || 0) === st.day) return;
  st.reviewedDay = st.day;
  const r = await genReview(loadCfg(), { dayLog: st.dayLog || [] });
  for (const line of r.text.split("\n")) if (line.trim()) await suLine(line.trim());
  for (const d of (st.dayLog || [])) {
    if (d.tier <= 1 && d.id) {
      st.aff = st.aff || {};
      st.aff[d.id] = Math.max(0, Math.min(100, (st.aff[d.id] || 0) + 1));
    }
  }
  if ((st.dayLog || []).some(d => d.tier <= 1)) sys("苏唐给今日顺眼的客人又添了分好感。");
  st.dayLog = [];
  setMood(4);
  renderAll(st, handlers);
  saveGame(st);
}

function doShop() {
  if (st.phase !== "closing") { sys("收功之后货郎才摆摊。"); return; }
  setMood(3);
  openShop(st, {
    onBuy: (cat, id, qty) => {
      const item = (shopStock(st)[cat] || []).find(x => x.id === id);
      if (!item) return { ok: false };
      const q = cat === "ingredient" ? (qty || 1) : 1;
      if (item.owned && cat !== "ingredient") return { ok: false };
      const cost = item.price * q;
      if (st.coins < cost) { sys("文钱不够。"); return { ok: false }; }
      st.coins -= cost;
      if (cat === "ingredient") st.inv[id] = (st.inv[id] || 0) + q;
      else if (cat === "cookware") st.cookware.push(id);
      else if (cat === "tech") st.techs.push(id);
      else if (cat === "flavor") st.flavors.push(id);
      sys(`买下「${item.name}」×${q}，花 ${cost} 文。`);
      saveGame(st);
      renderAll(st, handlers);
      return { ok: true, item };
    },
    onLeave: () => {}, // 返回只关市集，可再进；翻篇交给「下一日」
    onRefresh: () => { refreshShop(st); sys("货郎翻了翻担子，换了批食材。"); saveGame(st); },
  });
}

// ── 小吃：招呼苏唐（玩家只口述，她自决）─────────────────────────────
function doSnackPanel() {
  openSnack(st, {
    onRequest: (txt) => doSnackRequest(txt),
    onRemake: (name) => doRemake(name),
    onTag: (name) => { cycleTag(name); },
  });
}
function cycleTag(name) {
  const rec = (st.snackRecipes || []).find(x => x.name === name);
  if (!rec) return;
  const cats = ["汤", "饭", "点心", "串", "小吃"];
  rec.tag = cats[(cats.indexOf(rec.tag) + 1) % cats.length];
  saveGame(st);
  doSnackPanel();
}

function suTierOf(s) {
  const v = Object.values(s.suSkills || {});
  const avg = v.reduce((a, b) => a + b, 0) / (v.length || 1);
  return tierOfScore(avg);
}

async function doSnackRequest(txt) {
  if (busy) return sys("苏唐正忙着呢。");
  busy = true;
  closeModal();
  suSys(`【行动·备小吃】师兄说：${txt || "随便"}`);
  suLine(`苏唐应了声「知道了」，挽起袖子正在备菜……`);
  const cfg = loadCfg();
  const r = await genSnack(cfg, { request: txt, inv: st.inv, guest: currentGuest(st), suTier: suTierOf(st) });
  for (const m of r.used) {
    st.inv[m] = (st.inv[m] || 0) - 1;
    if (st.inv[m] <= 0) delete st.inv[m];
  }
  st.snacks = st.snacks || {};
  st.snacks[r.made] = (st.snacks[r.made] || 0) + r.portions;
  st.snackRecipes = st.snackRecipes || [];
  const srec = st.snackRecipes.find(x => x.name === r.made);
  if (srec) { srec.desc = r.desc || srec.desc; srec.used = r.used; srec.quality = r.quality; srec.proc = r.proc || srec.proc; srec.flavor = r.flavor || srec.flavor; }
  else st.snackRecipes.push({ name: r.made, cat: r.cat, tag: r.cat, used: r.used, quality: r.quality, desc: r.desc, proc: r.proc, flavor: r.flavor });
  const got = applySuExp(st);
  st.suAff = (st.suAff || 0) + 1;
  setMood(moodIndex(r.mood) ?? 7);
  if (r.proc) await suLine(r.proc);
  await suLine(`【苏唐】${r.say}`);
  suSys(`【回复·备小吃】备下「${r.made}」${r.portions} 份 · 用 ${r.used.join("、") || "手头现成的"} · 品质 ${r.quality}`);
  suSys(`【苏唐】练功：${got.join("、")} 各+3 · 好感+1（今 ${st.suAff}）`);
  busy = false;
  renderAll(st, handlers);
  saveGame(st);
}

async function doRemake(name) {
  if (busy) return sys("苏唐正忙着呢。");
  const rec = (st.snackRecipes || []).find(x => x.name === name);
  if (!rec) return;
  for (const m of rec.used) if ((st.inv[m] || 0) <= 0) return sys(`缺「${m}」，苏唐巧妇难为无米之炊。`);
  busy = true;
  closeModal();
  suSys(`【行动·复做】师兄点名：${name}`);
  suLine(`苏唐照旧方复做「${name}」，手法熟得很。`);
  for (const m of rec.used) { st.inv[m] -= 1; if (st.inv[m] <= 0) delete st.inv[m]; }
  st.snacks = st.snacks || {};
  st.snacks[name] = (st.snacks[name] || 0) + 3;
  const got = applySuExp(st);
  st.suAff = (st.suAff || 0) + 1;
  if (rec.proc) await suLine(rec.proc);
  suSys(`【回复·复做】「${name}」3 份 · 品质 ${rec.quality}`);
  suSys(`【苏唐】练功：${got.join("、")} 各+3 · 好感+1（今 ${st.suAff}）`);
  busy = false;
  renderAll(st, handlers);
  saveGame(st);
}

// ── 佐餐（替代上菜+配set）──────────────────────────────────────────
function doZuocan() {
  if (st.phase !== "guest" || !st.dish) return;
  const has = Object.values(st.snacks || {}).some(n => n > 0);
  if (!has) return doServe();
  openSet(st, { onSet: (name) => { st.pendingSet = name; doServe(); } });
}

async function doNext() {
  if (st.phase !== "closing") { sys("还没收功呢。"); return; }
  nextDay(st);
  setMood(0);
  renderAll(st, handlers);
  saveGame(st);
  await narr(`第 ${st.day} 天，卯时。雾从溪面起来，小馆开门。`);
  await guestArrives();
}

// ── 终端输入 ───────────────────────────────────────────────────────────
async function onCommand(text) {
  const t = text.trim();
  if (!t) return;
  playerLine(t);
  const cmd = t.toLowerCase();
  if (["帮助", "help", "?"].includes(cmd)) return openHelp();
  if (["灶台", "做菜", "开灶"].includes(cmd)) return doCook();
  if (["上菜", "端菜", "佐餐"].includes(cmd)) return doZuocan();
  if (["小吃", "零食"].includes(cmd)) return doSnackPanel();
  if (["收功", "打烊"].includes(cmd)) return doClose();
  if (["商店", "买", "逛街"].includes(cmd)) return doShop();
  if (["下一日", "下一天", "等待", "睡觉", "明儿"].includes(cmd)) return doNext();
  if (["背包", "包袱"].includes(cmd)) return openBag(st);
  if (["设置"].includes(cmd)) return openSettings();
  if (["流程", "日志", "trace"].includes(cmd)) return openTrace();
  if (["存档"].includes(cmd)) { saveGame(st); return sys("存档完毕。"); }

  // 说「做 XX」/ 提到菜名或食材 → 灶台自动备料
  const recipe = RECIPES.find(r => t.includes(r.name));
  const mentioned = Object.keys(ING_BY_NAME).filter(n => t.includes(n));
  if (/做|炒|炖|烤|蒸|腌|来一|整一/.test(t) && (recipe || mentioned.length)) {
    const prefill = recipe
      ? { materials: [...recipe.materials], technique: st.techs.includes(recipe.technique) ? recipe.technique : null }
      : { materials: mentioned.slice(0, 4), technique: null };
    sys("好嘞，灶台备料。");
    return doCook(prefill);
  }

  if (busy) return sys("说书人正忙着呢。");
  busy = true;
  const h = logStream("narr");
  const r = await genChat(loadCfg(), t, c => h.append(c));
  if (r.ai && h.text) {
    const { main, comment, mood } = extractComment(h.text);
    h.apply(main, comment ? `苏唐批：${comment}` : "");
    setMood(moodIndex(mood) ?? 0);
  } else {
    h.remove(); await narr(r.prose);
    if (r.comment) await commentLine(r.comment);
    setMood(r.mood ?? 0);
  }
  if (r.ms != null) sys(`说书 ${fmtMs(r.ms)} · ${r.prose.length} 字`);
  busy = false;
}

// ── 绑定 ───────────────────────────────────────────────────────────────
function bind() {
  const input = $("#cmd");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = input.value;
      input.value = "";
      onCommand(v);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target === input) return;
    if ($("#modal-root").classList.contains("open")) return;
    if (!st) return;
    const k = e.key.toLowerCase();
    const map = { c: "cook", x: "snack", s: "serve", v: "set", r: "close", t: "shop", n: "next", i: "bag", f: "settings", l: "trace", q: "save", h: "help" };
    if (map[k]) handlers[map[k]]();
  });
  $("#btn-new").onclick = () => startNew();
  $("#btn-cont").onclick = () => continueGame();
  if (hasSave()) $("#btn-cont").style.display = "";
  renderRate();
  setInterval(renderRate, 1000); // 限流灯每秒刷新（12s 计时）
}

function $(sel) { return document.querySelector(sel); }

bind();
