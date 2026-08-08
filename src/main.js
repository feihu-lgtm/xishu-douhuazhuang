// 西蜀豆花庄 · 主循环
import { ING_BY_NAME, RECIPES, INGREDIENTS, starOf, starLabel, EXPEDITION_MAP, EXP_SCEN_BY_CAT, RIVAL_SCHOOLS, GUESTS, TECHNIQUES, FLAVOR_BY_ID, calendarContextFor, weekLabel, RESCUE_SCENARIOS, FEMALE_GUEST_IDS, BREW_RECIPES, SHOP_WINES, WINE_DESSERTS, MEDICINE_HERBS, WORLD_LOCATIONS } from "./data.js?v=v39";
import { JIANGHU_ROSTER } from "./jianghu.js?v=v39";
import {
  newState, saveGame, loadGame, hasSave, currentGuest, judgeStove,
  scoreDish, tierOf, payOf, buyItem, nextDay, affDeltaFor, affName,
  applyMartialExp, applySuExp, computeBaseScore, refreshShop, shopStock,
  rollCheck, checkChance, rankLabel, checkDim, CHECK_DIMS, ACHIEVE_DEFS, ACHIEVE_N,
  registerUse, unlockProgress, applyUnlocks, buyAllIngredients, rivalStageNext, rivalGuestForSchool, findKnownGuest, snackScoreOf, ryuweiGain, ryuweiTierName, RYUWEI_TIERS, wishMatchScore, settleBrewing, brewWeeks, brewQuality, wineScore, matchBrew, GUESTS_PER_DAY, pickNarrativeRescue, settleSideNote,
} from "./state.js?v=v39";
import {
  loadCfg, genDish, genReaction, genChat, genMartial, genSnack, genReview, genExpedition, genChallenge, genSettlement, genNewGuest, genSuCook, genDropIngredient, genGifts, genBrew, genFeastReview, genRyuweiEnter, genEcho, genLocChat, extractSideNote, genFreshEvents, genSquareFolks, genTheater, genWeiluChat, genDuel,
  extractComment, extractFace, POSE_INDEX, splitSayMood, moodIndex, fmtMs, rateDots, rateState, menuDescOf, tierOfScore,
  startTrace, stepTrace, endTrace, getNsfw, setNsfw,
} from "./ai.js?v=v39";
import { chatContext } from "./prompt.js?v=v39";
import {
  narr, say, sys, gold, playerLine, renderAll, openCook, openShop, openMap, openChallengePanel,
  openBag, openSettings, openHelp, openTrace, openNotes, openModal, closeModal, logStream,
  commentLine, commentGlow, setMood, suLine, suSys, slogStream, openSnack, openSet, openServe, openBrew, openInviteGuest, renderRate, rollNsfwFace, openExpeditionAsk, renderInvite, dismissInvite, waitGiftClaim, ryuweiIntro, openCg, narrGlow, faceOf, markPrompt, showEcho, echoBarOn, openWorldMap, openLocView, openJianghuChat, openWeiluChat, initMobileDrawers,
} from "./ui.js?v=v39";

let st = null;
let busy = false;        // 说书/做菜/上菜/对话 通道
let busySnack = false;   // 苏唐小吃 通道（可与做菜并行）

// ── 最近日志回显：读档/导入存档时把最近 5 轮（含AI叙事与系统消息，比如余味出场特效）铺回左右栏 ──
// 以 note() 调用为一轮的分界，把该轮里 #log/#sulog 新增的条目按原样(outerHTML)存进 st.recentLog。
let lastLogCount = 0, lastSuCount = 0;
let logRounds = [], suRounds = [];
function captureRoundLog() {
  const logEl = document.querySelector("#log"), suEl = document.querySelector("#sulog");
  if (logEl) {
    const kids = Array.from(logEl.children);
    const added = kids.slice(lastLogCount).map(el => el.outerHTML);
    lastLogCount = kids.length;
    if (added.length) { logRounds.push(added); if (logRounds.length > 5) logRounds.shift(); }
  }
  if (suEl) {
    const kids = Array.from(suEl.children);
    const added = kids.slice(lastSuCount).map(el => el.outerHTML);
    lastSuCount = kids.length;
    if (added.length) { suRounds.push(added); if (suRounds.length > 5) suRounds.shift(); }
  }
  if (st) st.recentLog = { main: logRounds.flat(), su: suRounds.flat() };
}
// 读档/导入后调用：把存档里的最近日志铺回左右栏，并重置轮次计数（回显内容不算"新一轮"）
function restoreRecentLog() {
  const logEl = document.querySelector("#log"), suEl = document.querySelector("#sulog");
  const rl = st?.recentLog;
  if (logEl && rl?.main?.length) { logEl.innerHTML = rl.main.join(""); logEl.scrollTop = logEl.scrollHeight; }
  if (suEl && rl?.su?.length) { suEl.innerHTML = rl.su.join(""); suEl.scrollTop = suEl.scrollHeight; }
  lastLogCount = logEl ? logEl.children.length : 0;
  lastSuCount = suEl ? suEl.children.length : 0;
  logRounds = rl?.main?.length ? [rl.main] : [];
  suRounds = rl?.su?.length ? [rl.su] : [];
}

const handlers = {
  cook: () => doCook(),
  snack: () => doSnackPanel(),   // 副厨：小吃面板（苏唐做小吃）
  invite: () => doPickGuest(),   // 邀请客人：钦点明日来吃的客人（点将明日）
  brew: () => openBrew(st, { onBrew: doBrew, onBuy: doBuyWine, onDessert: doWineDessert, onMedicate: doMedicate }),
  serve: () => doZuocan(),       // 备餐：准备上菜（选 3 菜 + 1 酒）

  shop: () => doShop(),
  next: () => doNext(),
  bag: () => openBag(st),
  settings: () => openSettings(),
  trace: () => openTrace(),
  notes: () => openNotes(st),
  pickGuest: () => doPickGuest(),
  exp: () => openExpeditionMap(),
  world: () => openWorld(),
  nsfw: () => { setNsfw(!getNsfw()); sys(getNsfw() ? "■ 模式开启：相关写作规则强制注入。" : "■ 模式关闭。"); renderAll(st, handlers); },
  save: () => exportSave(),
  load: () => importSave(),
  help: () => openHelp(),
};

// ── 开场 ───────────────────────────────────────────────────────────────
async function startNew() {
  st = newState();
  const jhBatch = jianghuRoll(st); // 新档第一天就有江湖客在野
  $("#start").style.display = "none";
  setMood(0);
  renderAll(st, handlers);
  if (jhBatch.length) sys(`（江湖客在野：${jianghuNames(jhBatch).join("、")}——地图各处可寻；刷新页面或翻篇会换新。）`);
  await narr("卯时，溪边的雾还没散。师兄把旧铁锅刷了一遍，灶膛里火苗舔着锅底。");
  await say("「师兄，火旺了。」苏唐从灶后探出头，红衣汉服的一角掖在腰间，手里还擦着碗。");
  await narr("西蜀豆花庄，今天开张。这本日记，师兄和苏唐轮流动笔。");
  sys("你是师兄，小厨。两件事：做菜，迎客。输入「帮助」看命令。");
  await guestArrives();
}

async function continueGame() {
  st = loadGame();
  if (!st) return startNew();
  const jhBatch = jianghuRoll(st); // 刷新页面 = 系统刷新：未相识的原地换新，相识的留在原地
  $("#start").style.display = "none";
  renderAll(st, handlers);
  restoreRecentLog();  // 把存档里最近5轮的左右栏内容铺回来，接着上次的往下看
  sys(`读档完毕 · 第 ${st.day} 周 · ${weekLabel(st.day)}，${st.coins} 文。`);
  if (jhBatch.length) sys(`（江湖客在野：${jianghuNames(jhBatch).join("、")}——刷新页面或翻篇，未相识的会换新。）`);
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
  renderAll(st, handlers); // 这才是真正露脸的时候，不带 hideGuest，左栏正常显示客人卡
  await narr(`门帘一掀，${g.name}（${g.ident}）走了进来，找个灶边位子坐下。`);
  if (g.ryuwei) {
    ryuweiIntro(g);   // 食评人余味 · 星星特效出场
    // 余味进场：苏唐右栏迎接「又来了！」/ 首次介绍 / 熟络 / 簪子期待
    const er = await genRyuweiEnter(loadCfg(), {
      ryuweiVisits: st.ryuweiVisits ?? 0,
      tier: (st.ryuweiRating || {}).tier ?? 0,
    });
    if (er.ai && er.prose) await suLine(er.prose);
  }
  else await say(`「${g.order}」`);
  sys(`第 ${st.served + 1} 位客人。右栏「灶台」开火，做好了「上菜」。`);
  note("迎客", `第${st.served + 1}位客人 ${g.name} 进门，说「${g.order}」。`);
  if (g.sister) {
    setMood(5); // 苏唐掉脸
    await suLine(`【苏唐】……她怎么来了。师兄你眼睛往哪儿看呢，菜自己做去。`);
    note("迎客", `苏酥（苏唐姐姐）上门，苏唐吃醋掉脸。`);
  }
}

// 情境上下文：当前客人+近况小纸条，喂给各 AI 调用
function ctxLine(s) {
  const g = currentGuest(s);
  const invited = s.invitedGuest ? GUESTS.find(x => x.id === s.invitedGuest) : null;
  const notes = (s.notes || []).slice(-5).map(n => `[${n.act}]${n.text}${n.ai ? `｜${n.ai}` : ""}`).join("；");
  const stars = (s.ryuweiRating || {}).tier ?? 0; // 余味送的银簪数：一支=一星米其林
  const gExtra = [g?.body ? `${g.body}。` : "", g?.lore ? `${g.lore}。` : "", g?.wu ? `武功：${g.wu}。` : "", g?.koupi ? `口癖：${g.koupi}。` : ""].filter(Boolean).join("");
  const invExtra = [invited?.body ? `${invited.body}。` : "", invited?.lore ? `${invited.lore}。` : "", invited?.wu ? `武功：${invited.wu}。` : "", invited?.koupi ? `口癖：${invited.koupi}。` : ""].filter(Boolean).join("");
  return [
    stars > 0 ? `（豆花庄挂着食评人余味送的${stars}支银簪，一支银簪等于一星，蜀地独一份。旧识熟客见了必夸这份荣耀，同行厨子忌惮三分，挑刺也先掂量「这家挂着星」——把这份分量自然带进言行，别喊口号。）` : "",
    `第${s.day}周（${weekLabel(s.day)}），已待客${s.served}位。`,
    g ? `当前客人：${g.name}（${g.ident}），点菜时说「${g.order}」。${gExtra ? `（${g.name}${gExtra}）` : ""}` : `当前无客人。`,
    g && g.sister ? `（苏酥是苏唐的亲姐姐，在座。苏唐正吃醋掉脸，语气带酸带嗔，一边防着姐姐勾引师兄、一边防着师兄献殷勤。）` : "",
    invited ? `（${invited.name}（${invited.ident}）受师兄邀请留坐，正与苏唐一处说话。苏唐见师兄待她热络，暗里吃味，嘴上还要大方。${invExtra ? `${invited.name}${invExtra}` : ""}）` : "",
    notes ? `近况小纸条：${notes}` : "",
  ].filter(Boolean).join("\n");
}

// ── 收功后：右栏邀请面板（好感>15 的女客留坐闲聊，苏唐+她 三人场）──
function showInvite() {
  const onInvite = (id) => {
    st.invitedGuest = id;
    saveGame(st);
    const gg = findKnownGuest(st, id);
    suLine(`【苏唐】……${gg?.name || "她"}？行吧，多个人多双筷子，你眼睛规矩点。`);
    renderInvite(st, { onInvite, onCancel });
  };
  const onCancel = () => {
    st.invitedGuest = null;
    saveGame(st);
    suLine("【苏唐】她走了也好，清净。");
    renderInvite(st, { onInvite, onCancel });
  };
  renderInvite(st, { onInvite, onCancel });
}

// ── 做菜 ───────────────────────────────────────────────────────────────
function doCook(prefill) {
  if (st.phase !== "guest") { sys("这会儿不开灶。"); return; }
  openCook(st, { onFire, prefill, onSuAll: () => doSuAll() });
}

// ── 苏唐全包：好感>40 灶台按钮。或苏唐掌勺（练她），或她指挥师兄（练你）──
async function doSuAll() {
  if ((st.suAff || 0) < 40) return sys("苏唐说，好感不够，不掌勺。");
  if (busy) return sys("正忙着呢。");
  busy = true;
  try {
  startTrace("苏唐全包");
  const cfg = loadCfg();
  const suRoute = Math.random() < 0.5; // true=苏唐做，false=苏唐指挥师兄做
  const dish = await genSuCook(cfg, { inv: st.inv, techs: st.techs, flavors: st.flavors, context: ctxLine(st) });
  if (!dish) { sys("苏唐今天没兴致，还是你自己来。"); endTrace("苏唐全包·未成"); return; }
  for (const m of dish.materials) { st.inv[m] = (st.inv[m] || 0) - 1; if (st.inv[m] <= 0) delete st.inv[m]; }
  const j = judgeStove(st, dish.materials, dish.technique, st.cookware[0], dish.flavor);
  st.dish = { name: dish.name, materials: dish.materials, technique: dish.technique, cookwareId: st.cookware[0], flavorId: dish.flavor, quality: j.quality, recipe: !!j.recipe, suCook: true };
  if (suRoute) {
    await narr("苏唐系上围裙，袖子一挽：「师兄坐着看就好。」");
    await narr(dish.prose);
    applySuExp(st, 3);
    const tT = TECHNIQUES[dish.technique]?.train;
    if (tT) { st.suSkills = st.suSkills || {}; st.suSkills[tT] = Math.min(100, (st.suSkills[tT] || 0) + 3); }
    st.dish.baseScore = computeBaseScore(st, { technique: dish.technique, cookware: j.cookware, synergy: 70 }, st.suSkills); // 苏唐手艺
    suSys(`【苏唐】掌勺练功：各手艺+3${tT ? ` · ${tT}·专练+3` : ""}`);
  } else {
    await narr("苏唐站在灶边，袖子扎紧，递来菜刀：「师兄，听我口令。」");
    await narr(dish.prose);
    const martial = await genMartial(cfg, { materials: dish.materials, technique: dish.technique, cookware: j.cookware, intended: "", recipe: j.recipe });
    const got = applyMartialExp(st, martial.external, martial.internal);
    const tT = TECHNIQUES[dish.technique]?.train;
    if (tT) { applyMartialExp(st, [tT], null); got.push(`${tT}·专练`); }
    st.dish.baseScore = computeBaseScore(st, { technique: dish.technique, cookware: j.cookware, synergy: martial.synergy, external: martial.external }); // 师兄武学
    suSys(`【苏唐指挥】练功：${got.join("、")} 各+3`);
  }
  gold(`「${dish.name}」出锅${suRoute ? "，苏唐手笔" : "，师兄执勺、苏唐口令"}。`);
  note("苏唐全包", `${suRoute ? "苏唐掌勺" : "苏唐指挥师兄"}做「${dish.name}」（${dish.technique}）。`);
  // 大菜入菜库（苏唐全包也一样：一次 1-2 个，上菜消耗）
  st.dishStore = st.dishStore || [];
  const made = 1 + (Math.random() < 0.5 ? 1 : 0);
  const dup = st.dishStore.find(x => x.name === dish.name);
  if (dup) dup.qty = (dup.qty || 1) + made;
  else st.dishStore.push({ name: dish.name, materials: dish.materials, technique: dish.technique, flavorId: dish.flavor, baseScore: st.dish.baseScore, menuDesc: st.dish.menuDesc, suCook: true, qty: made });
  if (st.dishStore.length > 8) st.dishStore.shift();
  sys(`「${dish.name}」入菜库（现有 ${st.dishStore.length} 道 · 合计 ${st.dishStore.reduce((a, d) => a + (d.qty || 1), 0)} 份）。`);
  // 小吃：苏唐看库存判断做新还是复做
  const sr = await genSnack(cfg, { request: "（苏唐自己看着办）", inv: st.inv, guest: currentGuest(st), suTier: suTierOf(st), martialTier: 1, words: cfg.snackWords || 200, context: ctxLine(st), stars: st.stars, snackStock: st.snacks, st });
  if (sr && sr.made) {
    for (const m of sr.used || []) { st.inv[m] = (st.inv[m] || 0) - 1; if (st.inv[m] <= 0) delete st.inv[m]; }
    st.snacks = st.snacks || {};
    st.snacks[sr.made] = (st.snacks[sr.made] || 0) + (sr.portions || 3);
    (st.todaySnacks = st.todaySnacks || []).push({ name: sr.made, quality: sr.quality, flavor: sr.flavor });
    st.snackRecipes = st.snackRecipes || [];
    const srec = st.snackRecipes.find(x => x.name === sr.made);
    if (srec) { srec.desc = sr.desc || srec.desc; srec.used = sr.used; srec.quality = sr.quality; }
    else st.snackRecipes.push({ name: sr.made, cat: sr.cat, tag: sr.cat, used: sr.used || [], quality: sr.quality, desc: sr.desc, flavor: sr.flavor });
    applySuExp(st);
    if (sr.narrative) await suLine(sr.narrative);
    suSys(`【苏唐】小吃备好「${sr.made}」${sr.portions || 3} 份 · 品质 ${sr.quality}`);
  }
  endTrace("苏唐全包");
  } finally { busy = false; }
  renderAll(st, handlers);
  saveGame(st);
}

function onFire(slots, techId, cwId, flavorId, intended) {
  if (busy) return { ok: false, warn: "说书人还在想词，稍等。" };
  const j = judgeStove(st, slots, techId, cwId, flavorId);
  if (!j.ok) return j;
  j.intended = intended || "";
  startTrace("出菜");
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
  try {
  setMood(7);
  renderAll(st, handlers);
  await narr("师兄开火。灶膛噼啪一声，火苗蹿高，苏唐往灶里添了把柴。");
  const lore = j.materials
    .map(m => ING_BY_NAME[m]?.lore || (st.starLore && st.starLore[m])) // 带星食材用探秘记下的描述
    .filter(Boolean)
    .map((l, i) => `${j.materials[i]}——${l}`);
  // 第一轮·武学裁决：练哪几门功 + 食材配合分
  const cfg = loadCfg();
  const martial = await genMartial(cfg, {
    materials: j.materials, technique: st.dish.technique,
    cookware: j.cookware, intended: j.intended, recipe: j.recipe,
  });
  const got = applyMartialExp(st, martial.external, martial.internal);
  const trainSkill = TECHNIQUES[st.dish.technique]?.train; // 专练技法：额外练指定外功
  if (trainSkill) { applyMartialExp(st, [trainSkill], null); got.push(`${trainSkill}·专练`); }
  // 练功可学：记录本次技法/味型用法，检查是否顿悟新技法/味型
  registerUse(st, st.dish.technique, j.flavorId);
  const prog = unlockProgress(st);
  const newly = applyUnlocks(st, prog);
  if (newly.length) sys(`顿悟：${newly.join("、")} 新学得会了。`);
  const baseScore = computeBaseScore(st, {
    technique: st.dish.technique, cookware: j.cookware,
    synergy: martial.synergy, external: martial.external,
  });
  st.dish.baseScore = baseScore;
  st.dish.martial = martial;
  renderAll(st, handlers);
  sys(`练功：${got.join("、")} 各+3 · 食材配合 ${martial.synergy} · 基础分 ${baseScore}`);
  stepTrace("武学裁决", "pass", `练${got.join("、")} · 配合${martial.synergy} · 基础分${baseScore}`);
  // 第二轮·出菜叙事（带上任务：做给谁、TA 爱什么味）
  const g = currentGuest(st);
  const glowCook = !!g.ryuwei; // 食评人余味的菜 · 评语整段流光炫彩
  const h = logStream("narr", glowCook ? { extraClass: "ryuwei-comment" } : {});
  const res = await genDish(cfg, {
    materials: j.materials,
    lore,
    technique: st.dish.technique,
    cookware: j.cookware,
    flavorId: j.flavorId,
    recipeName: j.recipe?.name || null,
    martial, baseScore,
    guest: g,
    st,
    starOf: (n) => (st.stars && st.stars[n]) || 0,
  }, c => h.append(c));
  let noteTxt = "";
  if (res.ai && h.text) {
    const ex = extractComment(h.text);
    noteTxt = ex.note || "";
    h.apply(ex.main, ex.comment ? `苏唐批：${ex.comment}` : "", faceOf(moodIndex(ex.mood)));
    setMood(moodIndex(ex.mood) ?? 0);
  } else {
    h.remove();
    if (glowCook) {
      if (res.prose) await narrGlow(res.prose);
      if (res.comment) await commentGlow(res.comment, faceOf(res.mood));
    } else {
      await narr(res.prose);
      if (res.comment) await commentLine(res.comment, faceOf(res.mood));
    }
    setMood(res.mood ?? 0);
  }
  st.dish.name = res.name || st.dish.name;
  st.dish.menuDesc = res.menu || menuDescOf({ materials: j.materials, technique: st.dish.technique, flavorId: j.flavorId }, st.dish.name);
  st.menu = st.menu || [];
  const mrec = st.menu.find(x => x.name === st.dish.name);
  if (mrec) { mrec.desc = st.dish.menuDesc; mrec.used = j.materials; }
  else st.menu.push({ name: st.dish.name, used: j.materials, desc: st.dish.menuDesc });
  gold(`「${st.dish.name}」出锅。`);
  note("出菜", noteTxt || `做「${st.dish.name}」给${g ? g.name : "自己"}，基础分${baseScore}。`);
  endTrace(`「${st.dish.name}」基础分${baseScore}`);
  // 入菜库：做完的菜存起来（大菜一次做 1-2 个，上菜时消耗），上菜时多选（最多 3 菜 + 1 酒）
  st.dishStore = st.dishStore || [];
  const made = 1 + (Math.random() < 0.5 ? 1 : 0); // 大菜一次做 1-2 个
  const dup = st.dishStore.find(x => x.name === st.dish.name);
  if (dup) dup.qty = (dup.qty || 1) + made;
  else st.dishStore.push({ name: st.dish.name, materials: st.dish.materials, technique: st.dish.technique, flavorId: st.dish.flavorId, baseScore, menuDesc: st.dish.menuDesc, suCook: !!st.dish.suCook, qty: made });
  if (st.dishStore.length > 8) st.dishStore.shift();
  sys(`「${st.dish.name}」入菜库（现有 ${st.dishStore.length} 道 · 合计 ${st.dishStore.reduce((a, d) => a + (d.qty || 1), 0)} 份）——上菜时消耗，吃完要再做。`);
  st.dish = null;
  if (res.ms != null) sys(`说书 ${fmtMs(res.ms)} · 正文 ${res.prose.length} 字`);
  if (!res.ai) sys("（说书人未接线，灶神模板白描。设置里填 AI 密钥可现写。）");
  } finally { busy = false; }
  renderAll(st, handlers);
  saveGame(st);
}

// ── 出餐评分：满意度 → 5 星制 ─────────────────────────────────────────
function starsOf(score) {
  const n = score >= 85 ? 5 : score >= 65 ? 4 : score >= 45 ? 3 : score >= 25 ? 2 : 1;
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ── 上菜 ───────────────────────────────────────────────────────────────
function waitBusy() {
  return new Promise(res => {
    const t = setInterval(() => { if (!busy) { clearInterval(t); res(); } }, 80);
  });
}

async function doServe(sel) {
  if (st.phase !== "guest") return;
  const g = currentGuest(st);
  if (!g) return;
  const gWish = (st.guestWishes || {})[g.id]; // 客人聊出来想吃啥（说了什么就是什么）
  const items = sel?.items || [];
  const dishItems = items.filter(x => x.kind === "dish").map(x => st.dishStore[x.idx]).filter(Boolean);
  const snackNames = items.filter(x => x.kind === "snack").map(x => x.name);
  const wineName = sel?.wine || null;
  const winfo = wineName ? ((st.wineRecipes || []).find(r => r.name === wineName) || SHOP_WINES.find(w => w.name === wineName) || { quality: 60 }) : null;
  // ── 先校验再扣料（杜绝吞菜）：余味开席 = 3 道菜（大菜/小吃随意凑）+ 1 道酒 ──
  if (g.ryuwei) {
    const nDish = dishItems.length + snackNames.length;
    if (nDish < 3) return sys(`余味开席要 3 道菜 + 1 道酒——还差 ${3 - nDish} 道菜${!wineName ? "、1 道酒" : ""}，凑齐再来（菜品没动）。`);
    if (!wineName) return sys("余味开席要 3 道菜 + 1 道酒——还差 1 道酒（菜品没动）。");
  }
  if (!dishItems.length && !snackNames.length) return sys("没选菜——先做菜入菜库，或让苏唐备小吃。");
  busy = true;
  try {
  startTrace("佐餐");
  // 扣库存（校验已过）：小吃/酒按份扣，大菜扣菜库份数（吃完出库）
  for (const n of snackNames) { st.snacks[n] -= 1; if (st.snacks[n] <= 0) delete st.snacks[n]; }
  if (wineName) { st.wines[wineName] -= 1; if (st.wines[wineName] <= 0) delete st.wines[wineName]; }
  for (const x of items.filter(i => i.kind === "dish")) {
    const rec = st.dishStore[x.idx];
    if (rec) rec.qty = (rec.qty || 1) - 1;
  }
  st.dishStore = (st.dishStore || []).filter(d => (d.qty || 1) > 0); // 吃完的菜出库
  // 各评分
  const dishScores = dishItems.map(d => scoreDish(d, g, gWish));
  const snackScores = snackNames.map(n => snackScoreOf((st.snackRecipes || []).find(x => x.name === n), g));
  const winePts = winfo ? wineScore({ quality: winfo.quality, flavor: winfo.flavor, strong: !!winfo.strong }, g) : null;
  const dish = dishItems[0]; // 主菜（叙事主体）
  const score = dishScores[0] ?? snackScores[0] ?? 0;
  // 总分：余味 = 3菜+1酒四样各 25%；其他客人 = 选定项均分
  let total;
  if (g.ryuwei) {
    total = Math.round([...dishScores, ...snackScores, winePts].reduce((a, b) => a + b, 0) / 4);
  } else {
    const all = [...dishScores, ...snackScores, ...(winePts != null ? [winePts] : [])];
    total = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  }
  const tier = tierOf(total);
  const mainBy = dish?.suCook ? "苏唐" : "你";
  const flavorMatch = !!dish && dish.flavorId === g.flavor;
  const favMatch = !!dish && !!g.fav && dish.materials.includes(g.fav);
  const wishBonus = gWish && dish ? wishMatchScore(gWish, dish) : 0;
  if (wishBonus > 0) sys(`${g.name}说过想吃「${gWish}」，这菜对味，心愿+${wishBonus}分。`);
  // dayLog / 隔离记忆（多菜汇总）
  (st.dayLog = st.dayLog || []).push({
    id: g.id, name: g.name, order: g.order, dishes: dishItems.map(d => d.name).join("、"), tier, flavorMatch, favMatch, score: total,
    mainBy, mainScore: total, snackScore: snackScores[0] ?? null, snackName: snackNames[0] || null,
  });
  st.guestMemories = st.guestMemories || {};
  const memList = st.guestMemories[g.id] = st.guestMemories[g.id] || [];
  memList.push({ day: st.day, mainBy, dish: dishItems.map(d => d.name).join("、"), mainScore: total, snackName: snackNames[0] || null, snackScore: snackScores[0] ?? null });
  if (memList.length > 5) memList.shift();
  st.aff = st.aff || {};
  const affNow = st.aff[g.id] || 0;
  const pay = payOf(g, total, affNow) + (snackNames.length ? 2 : 0);
  const mainDesc = dish?.menuDesc || "";
  const glowServe = !!g.ryuwei; // 食评人余味的菜 · 端菜与品尝全部流光炫彩
  const sv = (t) => (glowServe ? narrGlow(t) : narr(t));
  await sv(`师兄把${dishItems.map(d => `「${d.name}」`).join("、")}${snackNames.length ? `和${snackNames.map(n => `「${n}」`).join("、")}` : ""}端上桌，往 ${g.name} 面前一放。`);
  for (const d of dishItems) if (d.menuDesc) await sv(`【菜牌】${d.menuDesc}`); // 每道大菜一张菜牌，不合并
  for (const n of snackNames) { const rec = (st.snackRecipes || []).find(x => x.name === n); if (rec?.desc) await sv(`【菜牌】${rec.desc}`); } // 每道小吃也有菜牌（苏唐手作的用料与做法）
  if (wineName) await sv(`又斟上一杯「${wineName}」。`);
  const h = logStream("narr", glowServe ? { extraClass: "ryuwei-comment" } : {}); // 品尝场景进左栏
  const r = await genReaction(loadCfg(), {
    guest: g, dishName: dish?.name || snackNames[0] || "", score: total, tier, mainBy,
    dishNames: dishItems.map(d => d.name),
    dishDescs: dishItems.map(d => d.menuDesc || ""),
    dishScores,
    snackNames, snackScores,
    wineName, winePts,
    snackScore: snackScores[0] ?? null, snackName: snackNames[0] || null, snackDesc: "",
    aff: affNow, affName: affName(affNow),
    mainDesc, st,
  }, c => h.append(c));
  let reactNote = "";
  if (r.ai && h.text) {
    reactNote = extractComment(h.text).note || "";
    setMood(r.mood ?? [2, 0, 5, 6][tier]);
  } else {
    h.remove(); await sv(r.scene || "");
    if (!r.ai) sys("（说书人未接线或掉线，品尝场景模板白描。设置里填 AI 密钥可现写。）");
    setMood(r.mood ?? [2, 0, 5, 6][tier]);
  }
  // 好感结算：按总分档位
  const snackMatch2 = snackScores[0] != null && ((st.snackRecipes || []).find(x => x.name === snackNames[0])?.flavor === g.flavor);
  const d = affDeltaFor(tier, flavorMatch || snackMatch2, favMatch) + (snackNames.length ? 1 : 0);
  st.aff[g.id] = Math.max(0, Math.min(100, affNow + d));
  st.coins += pay;
  st.earned += pay;
  ledger("待客进账", pay);
  st.totalServed += 1;
  st.served += 1;
  st.pendingSet = null;
  gold(`${g.name} 放下 ${pay} 文铜钱。（满意度 ${total}）`);
  const dishList = dishItems.map((d2, i) => `「${d2.name}」${d2.suCook ? "(苏唐做)" : ""}${dishScores[i]}分`).join(" · ");
  sys(`【评分】${dishList || "（无大菜）"}${snackScores.length ? ` · 小吃 ${snackNames.map((n, i) => `「${n}」${snackScores[i]}分`).join("、")}` : ""}${winePts != null ? ` · 酒「${wineName}」${winePts}分` : ""} → 总分 ${total} ${starsOf(total)}`);
  // 余味评级：3菜+1酒四样各 25%，总分 75/85/95 定星（只升不降）
  if (g.ryuwei) {
    const newTier = ryuweiGain(st, total);
    if (newTier) {
      const nm = ryuweiTierName(st);
      await narrGlow(`「${g.name}」掸掸裙摆，从发间取下一支银簪，搁进师兄掌心：「${nm}——${newTier === 1 ? "做得很好，我的小鱼尾巴都要跳了。这支银簪，收好，算一星。" : newTier === 2 ? "全天下只有锦官城两家、拉萨一家、打箭炉一家，如今多了鱼定村这一家。两支银簪，两星。" : "三尾鱼？头一回在册子上落这三笔。三支银簪，三星——小鱼儿的尾巴都要跳断了。"}」`);
      renderAll(st, handlers);
    } else if (total >= 75) {
      const curTier = (st.ryuweiRating || {}).tier ?? 0;
      const next = RYUWEI_TIERS.find(t => t.tier === curTier + 1);
      const remain = next ? Math.max(0, next.need - total) : 0;
      await narrGlow(`「${g.name}」放下筷子，指尖在袖口那支银簪上轻轻一按：「这席够格——就是还差 ${remain} 分，够到下一支银簪。下次，小鱼尾巴该跳了。」`);
    } else {
      await narrGlow(`「${g.name}」筷子一放，微微摇头：「尾巴没压住，再练练，小鱼尾巴都耷拉下来啦。」`);
    }
    st.ryuweiVisits = (st.ryuweiVisits || 0) + 1;
  }
  // 踢馆同行：按档位阈值（req）判定——达标把他赶走，必爆 ★食材 + 大额钱，并推进梯度
  if (g.rival) {
    const stars = (st.ryuweiRating || {}).tier ?? 0; // 银簪数=星级：挂了星的馆子，同行先忌惮三分
    const req = g.req ?? 85;
    const [bmin, bmax] = g.bonus || [60, 120];
    if (score >= req) {
      const n = (g.levelIdx ?? 0) >= 3 ? 2 : 1; // 副厨/总厨爆双份
      const sps = [];
      const drop = await genDropIngredient(loadCfg(), { context: `${g.name}（${g.ident}）踢馆被压下，从身上取出的看家好料。` });
      sps.push(drop || fallbackSpecial()[0]);
      for (let i = 1; i < n; i++) sps.push(fallbackSpecial()[0]);
      st.stars = st.stars || {}; st.starLore = st.starLore || {};
      for (const sp of sps) {
        st.inv[sp.name] = (st.inv[sp.name] || 0) + 1;
        st.stars[sp.name] = sp.stars;
        if (sp.desc) st.starLore[sp.name] = sp.desc;
      }
      const bonus = bmin + Math.floor(Math.random() * (bmax - bmin));
      st.coins += bonus; st.earned += bonus;
      // 头一回压下这位（该线该档）：收为常客+好感+15+推进该线梯度；已收过的回头客只加钱加料，不重复推进
      const firstBeat = !(st.customGuests || []).some(x => x.id === g.id);
      if (firstBeat) {
        st.aff[g.id] = Math.min(100, (st.aff[g.id] || 0) + 15);
        st.customGuests = st.customGuests || [];
        st.customGuests.push(g);
        rivalStageNext(st, g.schoolIdx);
      }
      const done = st.rivalDone;
      await narr(`「${g.name}」放下筷子，半晌无言，先朝柜上那支银簪瞥了一眼，起身抱拳：「${stars > 0 ? "挂着星的馆子，名不虚传——" : ""}服了。」丢下 ${bonus} 文，${sps.length > 1 ? "又搁下两件好东西" : "又搁下一件好东西"}——${sps.map(sp => `「${sp.name}」${"★".repeat(sp.stars)}`).join("、")}。`);
      if (firstBeat) await narr(`${g.name}从此常来，${g.gender === "女" ? "眉眼带笑" : "不时踱来"}。`);
      if (done) await narr("八大菜系踢馆尽数压平。鱼定村小馆的名头，从此响彻四方。");
      note("踢馆", `${g.name} 踢馆被压下(${score}分)，爆出 ${sps.map(sp => sp.name).join("、")} + ${bonus}文${firstBeat ? "·好感+15收为常客" : "·回头客"}${done ? "·全通关" : ""}。`);
    } else {
      await narr(`「${g.name}」尝了一口，眉头皱起${stars > 0 ? "，连那支银簪都不放在眼里" : ""}，冷笑：「${stars > 0 ? "挂了星，就这？" : "就这？"}改日再来。」拂袖而去。`);
      note("踢馆", `${g.name} 踢馆得手，嘲讽而去（满意度${score}/${req}）。`);
    }
  }
  sys(`「好感」${g.name} ${d >= 0 ? "+" : ""}${d}（今 ${st.aff[g.id]} · ${affName(st.aff[g.id])}）`);
  note("出餐", reactNote || `给${g.name}上「${dish.name}」${setName ? `+「${setName}」` : ""}，满意度${score}，好感+${d}。`);
  endTrace(`给${g.name}·满意度${score}·好感+${d}`);
  if (r.ms != null) sys(`说书 ${fmtMs(r.ms)}`);
  } finally { busy = false; saveGame(st); }  // 结算完立即落盘（回响等尾部流程不阻塞存档）
  // 世界回响：客人吃菜 / 踢馆 / 余味大阵仗
  void fireEcho(g.ryuwei ? "余味大阵仗" : g.rival ? "踢馆" : "客人吃菜", g.ryuwei
    ? `余味开席：${dishItems.map(d => `「${d.name}」`).join("、")}${snackNames.length ? " + " + snackNames.join("、") : ""} + 「${wineName}」→ 总分 ${total}${(st.ryuweiRating?.tier ?? 0) > 0 ? `，已是${ryuweiTierName(st)}` : "，还差一支银簪"}。`
    : g.rival
    ? `${g.name}（${g.ident}）上门踢馆，尝了「${dish?.name || snackNames[0] || ""}」${score}分——${score >= (g.req ?? 85) ? "认了栽，丢下看家好料走了" : "摇头冷笑，撂了句改日再来"}。`
    : `${g.name}（${g.ident}）吃了${dishItems.map(d => `「${d.name}」`).join("、")}${snackNames.length ? `和${snackNames.map(n => `「${n}」`).join("、")}` : ""}${wineName ? `，配「${wineName}」` : ""}，总分 ${total}，好感${d >= 0 ? "+" : ""}${d}。`);
  if (st.served >= 3) {
    await narr("最后一位客人走了。灶上还温着汤，今日不自动打烊。");
    sys("三位送完。苏唐照例要总评一句；可逛「商店」/「探秘」，或点「下一日」翻篇。");
    showInvite();           // 收功：右栏弹邀请面板，可邀好感>15的女客留坐
    renderAll(st, handlers);
    saveGame(st);
    await doReview();   // 每日苏唐总结自动触发
    collectGifts();     // 后台预热：备好明日熟客送礼（不阻塞打烊）
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
  startTrace("收工");
  const r = await genReview(loadCfg(), { dayLog: st.dayLog || [], snacks: st.todaySnacks || [] });
  for (const line of r.text.split("\n")) if (line.trim()) await suLine(line.trim());
  for (const d of (st.dayLog || [])) {
    if (d.tier <= 1 && d.id) {
      st.aff = st.aff || {};
      st.aff[d.id] = Math.max(0, Math.min(100, (st.aff[d.id] || 0) + 1));
    }
  }
  if ((st.dayLog || []).some(d => d.tier <= 1)) sys("苏唐给今日顺眼的客人又添了分好感。");
  note("收工", `第${st.day}周送${(st.dayLog || []).length}客，苏唐总评已记。`);
  endTrace(`第${st.day}周收工`);
  st.dayLog = [];
  await doNightLedger(r.text || "");   // 黄历对账：记账 + 苏唐复盘 + 可回一句（彩蛋）
}

// ── 黄历对账：每日一页（收支/大事/苏唐复盘），玩家可回一句（suAff+1 彩蛋）──
function doNightLedger(reviewText) {
  const income = (st.ledger || []).filter(l => l.day === st.day && l.delta > 0).reduce((a, l) => a + l.delta, 0);
  const expense = (st.ledger || []).filter(l => l.day === st.day && l.delta < 0).reduce((a, l) => a - l.delta, 0);
  st.calendar = st.calendar || [];
  st.calendar.push({
    day: st.day, week: weekLabel(st.day),
    events: (st.notes || []).filter(n => n.day === st.day).slice(-5).map(n => n.text || n.ai || n.act).filter(Boolean),
    income, expense, mood: (st.mood != null ? ["专注", "开心", "悠闲", "兴奋", "心动", "得意", "不满", "吃惊"][st.mood] : "") || "",
    sutang: (reviewText || "").split("\n")[0].slice(0, 60),
  });
  if (st.calendar.length > 40) st.calendar.shift();
  saveGame(st);
  return new Promise((resolve) => {
    const modal = openModal(`
      <h2>黄 历 · 第 ${st.day} 周 · 对账</h2>
      <div class="loc-fresh">今日进 <b>${income}</b> 文 · 出 <b>${expense}</b> 文 · 苏唐心情：${st.mood != null ? ["专注", "开心", "悠闲", "兴奋", "心动", "得意", "不满", "吃惊"][st.mood] : "—"}</div>
      <div class="loc-fresh none">${esc((reviewText || "苏唐合上账本，今日无甚可说。").slice(0, 120))}</div>
      <div class="loc-chat">
        <input id="night-inp" placeholder="跟苏唐说一句（可留空）……" />
        <span class="ck-btn plain" data-say>说</span>
      </div>
      <span class="return" data-skip>跳过 · 翻篇</span>
    `, () => {});
    const q = (s) => modal.querySelector(s);
    const finish = () => { closeModal(); resolve(); };
    q("[data-say]").onclick = () => {
      const v = q("#night-inp").value.trim();
      if (v) {
        st.convos = st.convos || {};
        (st.convos.sutang = st.convos.sutang || []).push({ who: "me", text: v, day: st.day, ts: nowTs() });
        (st.convos.sutang).push({ who: "苏唐", text: "（苏唐抿嘴笑了笑）嗯，师兄今日辛苦了，账我记着呢。", day: st.day, ts: nowTs() });
        st.suAff = Math.min(100, (st.suAff || 0) + 1);
        suLine("苏唐抿嘴笑了笑：「嗯，师兄今日辛苦了，账我记着呢。」");
        sys("（苏唐心里熨帖，好感+1。）");
        saveGame(st);
      }
      finish();
    };
    q("#night-inp").addEventListener("keydown", (e) => { if (e.key === "Enter") q("[data-say]").click(); });
    q("[data-skip]").onclick = finish;
  });
}

// ── 副本·探秘（先点地图选据点，再去，武功+智慧+苏唐 寻稀有食材）────
// 点位常客列表：该据点的熟人 + 好感 + 各自隔离记忆（谁做了什么、多好吃）
function fmtGuestMemory(m) {
  if (!m) return "";
  return `第${m.day}周，${m.mainBy === "苏唐" ? "苏唐" : "师兄"}做了「${m.dish}」${m.mainScore}分` +
    (m.snackName ? `，苏唐小吃「${m.snackName}」${m.snackScore}分` : "") + "。";
}
function guestListOf(node) {
  const list = [];
  const push = (guest) => {
    const aff = st.aff[guest.id] || 0;
    const m = ((st.guestMemories || {})[guest.id] || [])[0]; // 最近一条记忆
    list.push({ name: guest.name, ident: guest.ident, aff, gender: guest.gender, ryuwei: !!guest.ryuwei, heyuxie: !!guest.heyuxie, wu: guest.wu, lore: guest.lore, koupi: guest.koupi, mem: m ? fmtGuestMemory(m) : "" });
  };
  const ryu = GUESTS.find(x => x.ryuwei);
  if (ryu) push(ryu); // 食评人余味 · 每个据点都愿搭手，置顶
  for (const id of (node.guests || [])) {
    const guest = GUESTS.find(x => x.id === id);
    if (!guest || guest.id === ryu?.id) continue;
    push(guest);
  }
  return list;
}
// 英雄救美/美救英雄同行目标：据点常客里的女子优先，没有就全局女性npc兜底——任何npc都行，好感0（陌生人）也能撞上
function pickRescueTarget(node) {
  const isFemale = (g) => g && (g.gender === "女" || FEMALE_GUEST_IDS.has(g.id));
  const local = (node.guests || []).map(id => GUESTS.find(g => g.id === id)).filter(isFemale);
  const pool = local.length ? local : [...GUESTS, ...(st.customGuests || [])].filter(isFemale);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
function openExpeditionMap() {
  if (!(st.phase === "closing" || st.served >= 3)) return sys("送完三位客人才好出门探秘。");
  if (busy) return sys("正忙着呢。");
  openMap(st, { onGo: (node) => {
    const guests = guestListOf(node);
    openExpeditionAsk(node, { guests, onGo: (intent) => { closeModal(); doExpedition(node, intent); } });
  } });
}

async function doExpedition(node, intent) {
  if (!(st.phase === "closing" || st.served >= 3)) return sys("送完三位客人才好出门探秘。");
  if (busy) return sys("正忙着呢。");
  busy = true;
  try {
  startTrace("探秘");
  const avgv = (o) => { const v = Object.values(o || {}); return v.reduce((a, b) => a + b, 0) / (v.length || 1); };
  const skillAvg = Math.round(avgv(st.skills));
  const suAvg = Math.round(avgv(st.suSkills));
  const catPool = EXP_SCEN_BY_CAT[node.category] || [];
  st.lastScenByNode = st.lastScenByNode || {};
  // 周历撞上该据点分类：强夺舍——情境直接换成节庆本身，跳过常规池与"不重复上次"轮换（同一节庆周该据点该一直是它）
  const cal = calendarContextFor(st.day, node.category);
  let scenario;
  if (cal.strong) {
    scenario = cal.scenario;
  } else {
    const pool = catPool.filter(s => s !== st.lastScenByNode[node.id]);   // 一据点一类十条，不重复该据点上次
    scenario = (pool.length ? pool : catPool)[Math.floor(Math.random() * (pool.length ? pool.length : catPool.length))];
  }
  st.lastScenByNode[node.id] = scenario;
  // 英雄救美/美救英雄：命中这5条情境之一，当场点一位同行女子（任何npc，好感0也算数）
  const rescueTarget = RESCUE_SCENARIOS.has(scenario) ? pickRescueTarget(node) : null;
  // 余味相关才炫彩：正文里出现余味（她出场/被提及）才流光，不因她是据点常客就整篇泛化
  const withRyu = (t) => (t || "").includes("余味");
  const expNarr = (t) => (withRyu(t) ? narrGlow(t) : narr(t));
  const expComment = (t, face) => (withRyu(t) ? commentGlow(t, face) : commentLine(t, face));
  sys(`【探秘·${node.name}】${scenario}——师兄与苏唐动身，武功${skillAvg}·苏唐手艺${suAvg}……${intent ? `（师兄交代：${intent}）` : ""}`);
  // ① 一次调用：主叙事(500字) + 关卡题干/选项(4-6个) + 收获 special；玩家钦定主线夺舍；勾连据点常客与隔离记忆；弱关联时至少带一句当下节气
  const r = await genExpedition(loadCfg(), {
    skillAvg, suAvg, scenario, context: ctxLine(st), category: node.category, nodeName: node.name, intent, guestList: guestListOf(node),
    calendarStrong: cal.strong ? cal.text : null, calendarMention: cal.strong ? null : cal.text,
    rescueTarget: rescueTarget ? { name: rescueTarget.name, ident: rescueTarget.ident, aff: st.aff[rescueTarget.id] || 0 } : null,
  });
  // 主叙事里现身的常客就地转正为同行：出题、结算都得有他/她，别出了主叙事就凭空消失；
  // 遇险→脱困的戏走全，救出/共患难都加好感、记小纸条（情境已指定救场对象的以情境为准）
  const activeRescue = rescueTarget || pickNarrativeRescue(st, node.guests, r.narrative);
  await expNarr(r.narrative);
  if (!r.ai) sys("（说书人未接线或掉线，探秘先走模板。设置里填 AI 密钥可现写。）");
  if (r.comment) await expComment(r.comment, faceOf(r.mood));
  setMood(r.mood ?? 0);
  let special = (r.special && r.special.length) ? r.special : fallbackSpecial();
  // ② 出题（第二次调用）：叙事之后单独出关卡题干+选项
  sys("（说书人正在推演此行的关口……）");
  const background = `${scenario}。${(r.narrative || "").slice(0, 220)}`;
  const ch = await genChallenge(loadCfg(), {
    scenario, category: node.category, intent,
    background,
    rescueTarget: activeRescue ? { name: activeRescue.name, gender: activeRescue.gender } : null,
  });
  stepTrace("出题", "pass", `${ch.options.length} 个选项（${ch.options.map(o => o.dim).join("/")}）`);
  await expNarr(`走到紧要处——${ch.prompt}`);
  const specialNames = special.map(s => `${s.name}${"★".repeat(s.stars)}`).join("、");
  const outcome = await new Promise((resolve) => {
    openChallengePanel(st, ch, {
      onPick: (dim) => resolve({ act: "pick", dim }),
      onSkip: () => resolve({ act: "skip" }),
    });
  });
  let check = null;
  if (outcome.act === "pick") {
    const opt = ch.options.find(o => o.dim === outcome.dim) || { text: outcome.dim, dim: outcome.dim };
    check = checkDim(st, outcome.dim);
    const rank = CHECK_DIMS.includes(outcome.dim) ? rankLabel((st.checks[outcome.dim] || {}).succ || 0, !!((st.checks[outcome.dim] || {}).achieve)) : "";
    stepTrace("鉴定", check.ok ? "pass" : "fail", `「${opt.text}」·${outcome.dim}·≈${check.p}%${rank ? "·" + rank : ""}${check.achieve ? "·★成就" : ""}`);
    // 结算走 AI：500 字收尾叙事，回扣背景；命中救场情境则按成败分英雄救美/美救英雄两个方向写
    const stt = await genSettlement(loadCfg(), {
      background, prompt: ch.prompt, choice: opt.text, dim: outcome.dim, ok: check.ok, special: specialNames,
      rescueName: activeRescue ? activeRescue.name : null,
      rescueShe: activeRescue ? activeRescue.gender === "女" : null,
    });
    if (stt.text) await expNarr(stt.text);
    else await sys(check.ok ? `【检定】「${opt.text}」这一手成了（≈${check.p}%）${CHECK_DIMS.includes(outcome.dim) ? `，愈发老练（${rank}）` : ""}。` : `【检定】「${opt.text}」这一手没成（≈${check.p}%），白折腾半日。`);
    if (check.ok) {
      special = special.map(s => ({ ...s, stars: Math.min(3, s.stars + 1) })); // 看得准，收获更佳
      note("探秘", `${node.name}·${scenario}·「${opt.text}」${outcome.dim}检定成了。`);
    } else {
      special = special.map(s => ({ ...s, stars: Math.min(1, s.stars) }));     // 失手：只落普通料，白拿带星说不过去
      note("探秘", `${node.name}·${scenario}·「${opt.text}」${outcome.dim}检定落空，收成潦草。`);
    }
    // 英雄救美（成）/美救英雄（不成）：不管哪个方向都是加分的相处，好感不倒扣，只是成了多涨一点
    if (activeRescue) {
      st.aff = st.aff || {};
      const gain = check.ok ? 4 : 2;
      const before = st.aff[activeRescue.id] || 0;
      st.aff[activeRescue.id] = Math.min(100, before + gain);
      const she = activeRescue.gender === "女";
      const arc = check.ok ? (she ? "英雄救美" : "仗义救场") : (she ? "美救英雄" : "共患难");
      sys(`${arc}——「好感」${activeRescue.name} +${gain}（今 ${st.aff[activeRescue.id]} · ${affName(st.aff[activeRescue.id])}）`);
      note(she ? "救美" : "救场", `${node.name}·${scenario}·${check.ok ? "救出" : "共患难"}${activeRescue.name}，好感+${gain}。`);
    }
  } else {
    stepTrace("鉴定", "skip", "收手不掺和");
    await sys("师兄收手，不掺和这档子事。");
  }
  if (check?.achieve) {
    const a = ACHIEVE_DEFS[outcome.dim];
    await sys(`★ 成就「${a.name}」达成！${a.desc}`);
  }
  // ③ 收获（检定的成败决定星级）
  await sys("【探秘】掀开包袱——");
  st.stars = st.stars || {};
  st.starLore = st.starLore || {};
  for (const s of special) {
    st.inv[s.name] = (st.inv[s.name] || 0) + 1;
    st.stars[s.name] = s.stars;
    if (s.desc) st.starLore[s.name] = s.desc;   // 记下简短描述，做菜时才不会变味
    await narr(`【收获】「${s.name}」${"★".repeat(s.stars)} —— ${s.desc}`);
  }
  note("探秘", `${node.name}(${scenario})寻得 ${special.map(s => s.name).join("、")}。`);
  endTrace(`探秘·${node.name}·${scenario}·得${special.map(s => s.name).join("、")}`);
  } catch (e) {
    // 诊断可见：不吞错也不兜底，把异常亮到主叙事，中断行为保持（好抓根因）
    console.error("探秘中断:", e);
    try { sys(`（探秘出错：${e?.message || e}——请把此行发我）`); } catch { /* 渲染失败也别二次抛 */ }
    throw e;
  } finally {
    busy = false;
    endTrace("（探秘中断）"); // 兜底：正常结束已是 no-op；异常中断则闭合 trace，不卡「进行中」
  }
  // 世界回响：探秘全过程
  void fireEcho("探秘", `${node.name}·${scenario}，师兄苏唐寻得 ${specialNames}。`);
  renderAll(st, handlers);
  saveGame(st);
}
function fallbackSpecial() {
  const pool = [
    { name: "云雾雪莲", stars: 3, desc: "云雾里采的雪莲，清冽回甘，顶级。" },
    { name: "龙纹鲤", stars: 2, desc: "鲤身带龙纹，肉细鲜甜。" },
    { name: "赤霞菌", stars: 2, desc: "赤色菌伞，异香，难得。" },
    { name: "金髓笋", stars: 3, desc: "笋心带金髓，脆甜，珍品。" },
    { name: "金沙石首鱼", stars: 3, desc: "腹中金沙，鱼油丰润，煎烤皆美。" },
    { name: "紫金牦髓", stars: 3, desc: "牛骨里一段紫髓，入口即化，大补。" },
    { name: "霜髓野梨", stars: 2, desc: "霜打过的野梨，脆甜带冰碴。" },
    { name: "百草熏腿", stars: 3, desc: "百草熏出的野猪腿，腊香入骨。" },
    { name: "千年醪糟", stars: 2, desc: "老坛酿了不知多少年的醪糟，酒香醇厚。" },
  ];
  const n = Math.random() < 0.4 ? 2 : 1;
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
  return out;
}

// ── 成就查看（熟能生巧 · 各维度熟练度与成就）──────────────────────────
function showAchievements() {
  const lines = CHECK_DIMS.map(d => {
    const c = (st.checks || {})[d] || {};
    const a = ACHIEVE_DEFS[d];
    const rank = rankLabel(c.succ || 0, !!c.achieve);
    const mark = c.achieve ? `★成就「${a.name}」·${rank}` : `${rank}（${c.succ || 0}/${ACHIEVE_N}次）`;
    return `【${d}】${mark} · 约 ${checkChance(st, d)}%`;
  });
  sys("—— 熟能生巧 · 成就 ——\n" + lines.join("\n"));
}

function doShop() {
  if (!(st.phase === "closing" || st.served >= 3)) { sys("送完三位客人才摆摊。"); return; }
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
      ledger("商店采买", -cost);
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
    onBuyAll: () => {
      const r = buyAllIngredients(st);
      if (!r.ok) { sys(r.warn); return { ok: false }; }
      if (r.count) { sys(`备菜全套：${r.bought.join("、")} 各 1 份，花 ${r.total} 文。`); }
      else sys("灶上家伙什都齐了，没什么要补的。");
      saveGame(st);
      renderAll(st, handlers);
      return r;
    },
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

// 小纸条：每轮动作/对话的小总结（学 qucuo 的 memory 口径，客观短句）
function note(act, text) {
  st.notes = st.notes || [];
  const d = new Date(); const p = (n) => String(n).padStart(2, "0");
  st.notes.push({ day: st.day, ts: `${p(d.getHours())}:${p(d.getMinutes())}`, act, text });
  if (st.notes.length > 200) st.notes.shift();
  captureRoundLog(); // 这一轮的左右栏新增内容存进 st.recentLog，供读档回显
}

// ── 地点互动流水线（说话改变量）：玩家话 → AI 叙事 + SIDE_NOTE → 系统结算 ──
// 聊天全程进 st.convos[npcId] 线程数据库；结算结果写好感/银钱/名声/心愿/广场/事件。
function npcDescOf(id) {
  const g = GUESTS.find(x => x.id === id) || JIANGHU_ROSTER.find(x => x.id === id);
  if (!g) return "";
  const aff = st.aff[id] || 0;
  const mem = ((st.guestMemories || {})[id] || [])[0];
  const extra = g.ryuwei
    ? "，食评人余味，口癖：自称「奴家」、称呼旁人「这位小哥」"
    : (g.wu || g.koupi || g.lore)
      ? `，${g.wu ? `武功${g.wu}` : ""}${g.koupi ? `，口癖「${g.koupi}」` : ""}${g.lore ? `；${g.lore}` : ""}`
      : "";
  const base = `${g.name}（${g.ident}，好感${aff}${extra}）`;
  return mem ? `${base}，记得「${fmtGuestMemory(mem)}」` : base;
}
// SIDE_NOTE 里 aff 的键是 NPC 名字（AI 不知道内部 id）——按名字映射成真实 id
function mapNoteAff(note) {
  if (!note || typeof note !== "object" || !note.aff) return note;
  const mapped = {};
  for (const [k, v] of Object.entries(note.aff)) {
    const g = GUESTS.find(x => x.name === k || x.name.includes(k) || k.includes(x.name))
      || JIANGHU_ROSTER.find(x => x.name === k || x.name.includes(k) || k.includes(x.name));
    mapped[g ? g.id : k] = v;
  }
  return { ...note, aff: mapped };
}
async function doLocChat(npcId, npcName, locName, fresh, text) {
  if (busy) return sys("说书人正忙着呢。");
  if (!text) return sys("说点什么——「广场 想问问今天的行情」。");
  busy = true;
  try {
  startTrace("地点互动");
  st.convos = st.convos || {};
  const thread = (st.convos[npcId] || []).slice(-4).map(c => `${c.who === "me" ? "你" : npcName}：${c.text}`).join("\n");
  (st.convos[npcId] = st.convos[npcId] || []).push({ who: "me", text, day: st.day, ts: nowTs() });
  const h = logStream("narr", {});
  const r = await genLocChat(loadCfg(), {
    npc: npcDescOf(npcId), loc: locName, fresh, thread, input: text,
  }, c => h.append(c));
  const main = r.main || "";
  const note = r.note ? settleSideNote(st, mapNoteAff(r.note), { coinRange: locName === "广场" ? [-10, 30] : [-20, 50] }) : null;
  // 反馈结算
  if (note) {
    const bits = [];
    for (const [id, v] of Object.entries(note.aff)) bits.push(`${(GUESTS.find(x => x.id === id)?.name || id)}${v > 0 ? "+" : ""}${v}`);
    if (bits.length) sys(`（好感：${bits.join("、")}）`);
    if (note.coins) sys(`（银钱${note.coins > 0 ? "+" : ""}${note.coins} 文）`);
    if (note.fame) sys(`（名声${note.fame > 0 ? "+" : ""}${note.fame}）`);
    if (note.wish) { st.guestWishes = st.guestWishes || {}; st.guestWishes[npcId] = note.wish; sys(`（${npcName}念叨想吃「${note.wish}」——记下了）`); }
    if (note.info) { st.square = st.square || []; st.square.push({ from: npcName, form: "传闻", text: note.info, day: st.day, ts: nowTs() }); sys(`（江湖消息：${note.info}——已上广场）`); }
    if (note.event) { st.eventQueue = st.eventQueue || []; st.eventQueue.push({ ...note.event, day: st.day }); sys(`（聊出大事：${note.event.title}——已入事件簿）`); }
    if (note.mood) setMood(moodIndex(note.mood) ?? st.mood ?? 0);
  }
  if (main) (st.convos[npcId] || []).push({ who: npcName, text: main, day: st.day, ts: nowTs() });
  if (!r.ai) sys("（说书人未接线或掉线——没搭上话。设置里填 AI 密钥。）");
  endTrace(`地点互动·${npcName}`);
  } finally { busy = false; renderAll(st, handlers); saveGame(st); }
}
function nowTs() {
  const d = new Date(); const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
// ── 周初 roll：各地点新鲜事（AI 批量出卡；每周一次；后台跑不拖翻篇）──
async function rollFreshEvents(st) {
  if ((st.freshWeek || 0) === st.day) return; // 本周已 roll 过
  st.freshWeek = st.day;
  st.locs = st.locs || {};
  const locs = WORLD_LOCATIONS;
  const cards = await genFreshEvents(loadCfg(), locs.map(l => ({ id: l.id, name: l.name, desc: l.desc })));
  locs.forEach((l, i) => {
    const c = cards[i];
    st.locs[l.id] = st.locs[l.id] || { id: l.id, fresh: null, seen: 0 };
    if (c && c.title) {
      st.locs[l.id].fresh = { week: st.day, title: String(c.title).slice(0, 16), desc: String(c.desc || "").slice(0, 60), npc: String(c.npc || "").slice(0, 12), kind: String(c.kind || "热闹").slice(0, 8), done: false };
      st.square = st.square || [];
      st.square.push({ from: "街巷", form: "传闻", text: `${l.name}：${c.title}`, day: st.day, ts: nowTs() }); // 新鲜事也上布告墙
    } else {
      st.locs[l.id].fresh = null;
    }
  });
  const n = locs.filter((l, i) => cards[i] && cards[i].title).length;
  sys(`（江湖酝酿：${n} 个地方本周有新事——地图上冒红点。）`);
  // 广场刷 NPC：随机 2-4 位角色出现在广场（有名有姓，能聊能交易）
  const cands = GUESTS.filter(g => !g.ryuwei || Math.random() < 0.25).sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
  const folks = await genSquareFolks(loadCfg(), cands.map(g => ({ id: g.id, name: g.name, ident: g.ident })));
  st.squareFolks = folks.map(f => ({ ...f, week: st.day }));
  if (folks.length) sys(`（广场来了 ${folks.length} 位熟人：${folks.map(f => f.name).join("、")}——去广场聊聊。）`);
  // 江湖客：每周翻篇原地随机换新（纯系统随机，不调 AI；相识的留在原地）
  const batch = jianghuRoll(st);
  if (batch.length) { const ns = jianghuNames(batch); sys(`（江湖客在野：${ns.slice(0, 6).join("、")}——地图各处可寻，交谈后便相识；刷新页面也会换新。）`); }
  saveGame(st);
}
// ── 江湖客批次（系统随机，无 AI）──
// 已相识的留在原地可继续聊；未相识的原地换新（地点不动），保证与当前批次不同。
// 触发：刷新页面（每次读档/开新档）与每周翻篇。
function jianghuRoll(st) {
  const jh = st.jianghu = st.jianghu || { week: 0, batch: [], known: {} };
  jh.week = st.day;
  const cur = new Map((jh.batch || []).map(b => [b.locId, b.id]));
  const inBatch = new Set(cur.values());
  const batch = [];
  for (const loc of WORLD_LOCATIONS) {
    const oldId = cur.get(loc.id);
    if (oldId && jh.known[oldId]) { batch.push({ id: oldId, locId: loc.id }); inBatch.add(oldId); continue; }
    const c = jianghuPickOne(st, inBatch);
    if (c) { batch.push({ id: c.id, locId: loc.id }); inBatch.add(c.id); }
  }
  jh.batch = batch;
  return batch;
}
// 抽一位：未相识优先，避开当前批次（保证刷新后必不一样）
function jianghuPickOne(st, excludeIds) {
  const jh = st.jianghu = st.jianghu || { week: 0, batch: [], known: {} };
  const unknown = JIANGHU_ROSTER.filter(c => !jh.known[c.id] && !excludeIds.has(c.id));
  const pool = unknown.length ? unknown : JIANGHU_ROSTER.filter(c => !excludeIds.has(c.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
// 江湖客播报：名字串
function jianghuNames(batch) {
  return batch.map(b => JIANGHU_ROSTER.find(c => c.id === b.id)?.name || b.id).filter(Boolean);
}
// ── 江湖大地图编排：进地图 → 进地点页 → 搭话（走流水线）/ 功能台 ──
function locOf(id) {
  st.locs = st.locs || {};
  st.locs[id] = st.locs[id] || { id, fresh: null, seen: 0 };
  return st.locs[id];
}
function enterLoc(loc) {
  openLocView(st, loc, {
    onChat: (text) => {
      const ls = locOf(loc.id);
      const fresh = (ls.fresh && ls.fresh.week === st.day) ? `${loc.name}·${ls.fresh.title}：${ls.fresh.desc}` : "";
      doLocChat(loc.id === "home" ? "sutang" : loc.id, loc.name === "豆花庄" ? "苏唐" : loc.name, loc.name, fresh, text);
    },
    onAction: locActs(loc),
    onBack: () => openWorld(),
    onJianghu: (char) => openJianghuChat(st, char, loc, {
      onSend: (text) => doJianghuChat(char, loc, text),
      onBack: () => enterLoc(loc),
    }),
  });
}
function openWorld() {
  openWorldMap(st, { onEnter: enterLoc, onExplore: () => openExpeditionMap() });
}
// ── 江湖客搭话：交谈即相识（进邀请面板·江湖分区），聊天走地点互动流水线 ──
// 相识只登记：TA 留在原地可继续聊，其余地点也不动；换新只发生在刷新页面/每周翻篇
function doJianghuChat(char, loc, text) {
  if (!text) return sys(`说点什么——「跟${char.name}打个招呼」。`);
  const jh = st.jianghu = st.jianghu || { week: 0, batch: [], known: {} };
  if (!jh.known[char.id]) {
    jh.known[char.id] = { aff: st.aff[char.id] || 0, day: st.day };
    sys(`（与${char.name}相识——TA 仍在此地可继续聊；「请客坐坐·江湖」里也多了一位，可邀 TA 留坐。）`);
    saveGame(st);
  }
  const ls = locOf(loc.id);
  const fresh = (ls.fresh && ls.fresh.week === st.day) ? `${loc.name}·${ls.fresh.title}` : "";
  doLocChat(char.id, char.name, loc.name, fresh, text);
}
function locActs(loc) {
  // 各地点功能台：阶段 3 逐个点亮，先占位
  const acts = [];
  if (loc.id === "home") acts.push({ id: "ledger", label: "账房册子", on: true }, { id: "calendar", label: "黄历", on: true }, { id: "cook", label: "灶台", on: true });
  if (loc.id === "square") acts.push({ id: "bulletin", label: "布告墙", on: true }, { id: "trade", label: "集市买卖", on: true }, { id: "dibao", label: "邸报", on: true });
  if (loc.id === "washe") acts.push({ id: "shuoshu", label: "说书", on: true }, { id: "xitai", label: "戏台", on: true }, { id: "weilu", label: "围炉喝酒", on: true });
  if (loc.id === "leitai") acts.push({ id: "tiao", label: "比武", on: true });
  if (loc.id === "hongbai") acts.push({ id: "yanxi", label: "接宴席", on: true });
  if (loc.id === "tusi") acts.push({ id: "chai", label: "接差事", on: true });
  return {
    acts,
    run: (actId, modal) => {
      if (actId === "cook") { closeModal(); return doCook(); }
      if (actId === "ledger") { closeModal(); return doLedger(); }
      if (actId === "calendar") { closeModal(); return doCalendar(); }
      if (actId === "bulletin") { closeModal(); return openSquareBoard(); }
      if (actId === "trade") { closeModal(); return openSquareMarket(); } // 广场：本周在场的 NPC，能聊能买卖
      if (actId === "dibao") { closeModal(); return doDibao(); }
      if (actId === "shuoshu" || actId === "xitai") { closeModal(); return openTheater(actId === "shuoshu" ? "说书" : "戏台"); }
      if (actId === "weilu") { closeModal(); return doWeilu(); }
      if (actId === "tiao") { closeModal(); return doLeitai(); }
      if (actId === "yanxi") { closeModal(); return doYanxi("红白堂"); }
      if (actId === "chai") { closeModal(); return doYanxi("土司府"); }
      sys(`${loc.name}·${(acts.find(a => a.id === actId) || {}).label}——此处将启，先跟${loc.name}的人搭搭话。`);
    },
  };
}
// ── 账房册子（通用表格浏览）：流水/菜谱/星料/酒库/待客 ──
function ledger(act, delta) {
  st.ledger = st.ledger || [];
  st.ledger.push({ day: st.day, ts: nowTs(), act, delta: Math.round(delta) });
  if (st.ledger.length > 200) st.ledger.shift();
}
function doLedger() {
  const books = [
    { t: "流水账", cols: ["周", "时间", "事项", "收支"],
      rows: (st.ledger || []).slice(-14).reverse().map(l => [l.day + "周", l.ts, l.act, `${l.delta > 0 ? "+" : ""}${l.delta}文`]) },
    { t: "菜谱册", cols: ["菜名", "用料"],
      rows: (st.menu || []).slice(-10).map(m => [`「${m.name}」`, m.used ? m.used.slice(0, 16) : ""]) },
    { t: "星料谱", cols: ["食材", "星级"],
      rows: Object.entries(st.stars || {}).map(([n, s]) => [n, "★".repeat(s)]) },
    { t: "酒库", cols: ["酒", "存量"],
      rows: Object.entries(st.wines || {}).map(([n, c]) => [n, "×" + c]) },
    { t: "待客簿", cols: ["周", "客人", "菜", "分"],
      rows: (st.dayLog || []).slice(-10).map(l => [l.day + "周", l.name, l.dish || "", l.score != null ? l.score + "分" : ""]) },
    { t: "杂物柜", cols: ["物件", "来历", "价"],
      rows: (st.junk || []).slice(-10).map(j => [j.name, j.desc || "", j.price ? j.price + "文" : ""]) },
  ];
  let idx = 0;
  const draw = () => {
    const b = books[idx];
    const empty = (b.rows && b.rows.length) ? "" : `<tr><td colspan="${(b.cols || []).length || 1}" class="empty">（空）</td></tr>`;
    openModal(`
      <h2>账 房 · ${b.t}</h2>
      <div class="ck-chips">
        ${books.map((x, i) => `<span class="ck-chip ${i === idx ? "on" : ""}" data-book="${i}">${x.t}</span>`).join("")}
      </div>
      ${b.cols ? `<table class="ledger-tbl"><thead><tr>${b.cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${(b.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(String(c ?? ""))}</td>`).join("")}</tr>`).join("")}${empty}</tbody></table>`
        : `<div class="ck-mats"><span class="ck-mat" style="white-space:pre-wrap;line-height:1.9">${b.d.split("\n").map(x => esc(x)).join("\n")}</span></div>`}
      <div class="ck-btns"><span class="ck-btn plain" data-prev>上一册</span><span class="ck-btn plain" data-next>下一册</span></div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    document.querySelectorAll("#modal-root [data-book]").forEach(el => el.onclick = () => { idx = +el.dataset.book; draw(); });
    document.querySelector("#modal-root [data-prev]").onclick = () => { idx = (idx + books.length - 1) % books.length; draw(); };
    document.querySelector("#modal-root [data-next]").onclick = () => { idx = (idx + 1) % books.length; draw(); };
    document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
  };
  draw();
}
// ── 黄历（当日页 + 历史翻页；夜间对账在翻篇时自动弹）──
function doCalendar() {
  const cal = calendarContextFor(st.day, null);
  let idx = (st.calendar || []).length - 1;
  const draw = () => {
    const pages = st.calendar || [];
    const p = pages[idx];
    openModal(`
      <h2>黄 历 · ${p ? `第 ${p.day} 周（${p.week}）` : `第 ${st.day} 周（${weekLabel(st.day)}）`}</h2>
      ${!p ? `<div class="loc-fresh">${cal.strong ? `【节庆】${cal.strong}` : ""}${cal.text ? `【时节】${cal.text}` : ""}</div>` : ""}
      ${p ? `
      <div class="loc-fresh">${p.sutang ? `苏唐记：${esc(p.sutang)}` : ""}</div>
      <div class="loc-fresh none">进 <b>${p.income || 0}</b> 文 · 出 <b>${p.expense || 0}</b> 文 · 苏唐心情：${p.mood || "—"}${p.events?.length ? `<br>当日：${p.events.map(e => esc(e)).join("；")}` : ""}</div>`
      : `<div class="loc-fresh none">今日的对账还没记——翻篇时会跟苏唐对一页。</div>`}
      <div class="ck-btns"><span class="ck-btn plain" data-prev>上一周</span><span class="ck-btn plain" data-next>下一周</span></div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    const q = (s) => document.querySelector(`#modal-root ${s}`);
    q("[data-prev]").onclick = () => { if (idx > 0) { idx -= 1; draw(); } };
    q("[data-next]").onclick = () => { if (idx < pages.length - 1) { idx += 1; draw(); } };
    q("[data-back]").onclick = () => closeModal();
  };
  draw();
}
// ── 广场 · 本周在场的 NPC：列表 → 点人 → 对话（流水线）+ 买卖 ──
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function openSquareMarket() {
  const folks = (st.squareFolks || []).filter(f => f.week === st.day);
  openModal(`
    <h2>广 场 · 今日在场</h2>
    <div class="loc-desc">本周广场上遇见的熟人——点人搭话，或看看她带没带货。</div>
    <div class="folk-list">
      ${folks.map(f => `<div class="folk-row" data-folk="${f.npcId}">
        <b>${f.name}</b><i>${f.ident}</i>
        <p>${esc(f.line)}</p>
        <span class="folk-tags">${f.sell.length ? `带货：${f.sell.map(s => s.name).join("、")}` : "空着手逛"}${f.want ? ` · 想买「${f.want.name}」` : ""}</span>
      </div>`).join("") || `<div class="loc-fresh none">广场空着——下周翻篇才有人来。</div>`}
    </div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelectorAll("#modal-root [data-folk]").forEach(el => el.onclick = () => {
    const folk = folks.find(f => f.npcId === el.dataset.folk);
    if (folk) openFolkTrade(folk);
  });
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}
function openFolkTrade(folk) {
  const w = folk.want;
  openModal(`
    <h2>${esc(folk.name)} · ${esc(folk.ident)}</h2>
    <div class="loc-fresh">${esc(folk.line)}</div>
    ${folk.sell.length ? `<div class="ck-label">她带着的货</div>
      <div class="ck-mats">${folk.sell.map((s, i) => `<span class="ck-mat zero" data-buy="${i}">${esc(s.name)}${s.star ? ` ★${s.star}` : ""}<i style="opacity:.7;display:block">${esc(s.desc)} · ${s.price}文</i></span>`).join("")}</div>` : ""}
    ${w ? `<div class="ck-label">她想买</div>
      <div class="ck-mats"><span class="ck-mat zero" data-sell>「${esc(w.name)}」——出 ${w.offer} 文</span></div>` : ""}
    <div class="ck-label">搭话（说话会改变这方世界）</div>
    <div class="loc-chat">
      <input id="folk-inp" placeholder="跟${esc(folk.name)}说点什么……" />
      <span class="ck-btn plain" data-send>说</span>
    </div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  const q = (s) => document.querySelector(`#modal-root ${s}`);
  document.querySelectorAll("#modal-root [data-buy]").forEach(el => el.onclick = () => buyFolkGood(folk, +el.dataset.buy));
  document.querySelector("#modal-root [data-sell]")?.addEventListener?.("click", () => sellFolkWant(folk));
  q("[data-send]").onclick = () => {
    const v = q("#folk-inp").value.trim();
    if (!v) return;
    q("#folk-inp").value = "";
    const ls = locOf("square");
    const fresh = (ls.fresh && ls.fresh.week === st.day) ? `广场·${ls.fresh.title}` : "";
    doLocChat(folk.npcId, folk.name, "广场", fresh, v);
  };
  q("#folk-inp").addEventListener("keydown", (e) => { if (e.key === "Enter") q("[data-send]").click(); });
  q("[data-back]").onclick = () => openSquareMarket();
}
function buyFolkGood(folk, i) {
  const s = folk.sell[i];
  if (!s) return;
  if (st.coins < s.price) return sys("文钱不够。");
  st.coins -= s.price;
  ledger(`广场·买「${s.name}」`, -s.price);
  if (s.star > 0) { st.inv[s.name] = (st.inv[s.name] || 0) + 1; st.stars = st.stars || {}; st.stars[s.name] = Math.max(st.stars[s.name] || 0, s.star); sys(`买下「${s.name}」（★${s.star} 带星食材）花 ${s.price} 文——可入菜可入酒。`); }
  else { st.junk = st.junk || []; st.junk.push({ name: s.name, desc: s.desc || "", price: s.price, day: st.day }); sys(`买下「${s.name}」（${s.desc || "杂货"}）花 ${s.price} 文——收进杂物柜。`); }
  saveGame(st); renderAll(st, handlers);
}
function sellFolkWant(folk) {
  const w = folk.want;
  if (!w) return;
  if ((st.inv[w.name] || 0) > 0) { st.inv[w.name] -= 1; if (st.inv[w.name] <= 0) delete st.inv[w.name]; }
  else if ((st.snacks[w.name] || 0) > 0) { st.snacks[w.name] -= 1; if (st.snacks[w.name] <= 0) delete st.snacks[w.name]; }
  else if ((st.wines[w.name] || 0) > 0) { st.wines[w.name] -= 1; if (st.wines[w.name] <= 0) delete st.wines[w.name]; }
  else {
    const di = (st.dishStore || []).findIndex(d => d.name === w.name);
    if (di >= 0) { st.dishStore[di].qty = (st.dishStore[di].qty || 1) - 1; st.dishStore = st.dishStore.filter(d => (d.qty || 1) > 0); }
    else return sys(`拿不出「${w.name}」——做/备/酿出来才能卖。`);
  }
  st.coins += w.offer;
  ledger(`广场·卖「${w.name}」`, w.offer);
  const g = GUESTS.find(x => x.id === folk.npcId);
  if (g) { st.aff = st.aff || {}; st.aff[g.id] = Math.min(100, (st.aff[g.id] || 0) + 2); sys(`把「${w.name}」卖给${folk.name}，得 ${w.offer} 文（她记了你的好，好感+2）。`); }
  else sys(`把「${w.name}」卖给${folk.name}，得 ${w.offer} 文。`);
  folk.want = null;
  saveGame(st); renderAll(st, handlers);
}

// ── 擂台：两轮比武抉择（复用探秘出题/检定/结算链），选项全是武功招式 ──
async function doLeitai() {
  if (busy) return sys("正忙着呢。");
  const ls = locOf("leitai");
  const fresh = (ls.fresh && ls.fresh.week === st.day) ? ls.fresh : null;
  const foe = fresh?.npc || "关中刀客";
  const pot = (fresh?.kind === "比武" ? 60 : 50) + Math.floor(Math.random() * 40);
  busy = true;
  try {
  startTrace("擂台比武");
  const background = `${fresh ? fresh.title + "：" + fresh.desc : "擂台空着，师兄登台叫阵。"}对手是${foe}，彩头 ${pot} 文。`;
  let wins = 0;
  for (let round = 1; round <= 2; round++) {
    const d = await genDuel(loadCfg(), { foe, round, stance: round === 2 ? (wins ? "上一轮你占了上风" : "上一轮你吃了亏，这轮得扳回来") : "", background });
    const choice = await new Promise((resolve) => {
      openChallengePanel(st, d, { onPick: (dim) => resolve(dim), onSkip: () => resolve(null) });
    });
    if (!choice) { sys("（怯场下台——擂台下哄笑一阵。）"); endTrace("擂台·怯场"); return; }
    const opt = d.options.find(o => o.dim === choice) || { text: choice, dim: choice };
    const chk = checkDim(st, choice);
    wins += chk.ok ? 1 : 0;
    if (chk.ok) applyMartialExp(st, [choice], null, 3); // 比武得手：这门功夫 +3（新维度照练）
    const stt = await genSettlement(loadCfg(), { background, prompt: d.prompt, choice: opt.text, dim: choice, ok: chk.ok, special: `擂台彩头 ${pot} 文`, rescueName: null });
    if (stt.text) await narr(stt.text);
    else await narr(`${foe}${chk.ok ? "被师兄这一手逼退两步" : "反手一记，师兄险险架住"}（${choice}·≈${chk.p}%${chk.ok ? "成" : "败"}）。`);
  }
  // 两轮结算：2胜大胜 / 1胜平手 / 0胜落败
  let total, fameD, text;
  if (wins === 2) { total = pot; fameD = 3; text = `${foe}彻底服气，抱拳下台——彩头 ${pot} 文双手奉上，街坊喝彩震天。`; }
  else if (wins === 1) { total = Math.floor(pot / 2); fameD = 1; text = `${foe}与师兄打了个平手，各自收了半份彩头（${total} 文），约定改日再战。`; }
  else { total = -20; fameD = -1; text = `${foe}连胜两场，师兄赔了 20 文彩头，灰溜溜下台。`; }
  st.coins = Math.max(0, (st.coins || 0) + total);
  st.fame = Math.max(0, (st.fame || 0) + fameD);
  ledger(`擂台·vs ${foe}`, total);
  await narr(text);
  sys(`（擂台 ${wins}/2 胜 → ${total > 0 ? "+" : ""}${total} 文 · 名声${fameD > 0 ? "+" : ""}${fameD}）`);
  if (fresh && fresh.week === st.day) fresh.done = true;
  endTrace(`擂台·${foe}·${wins}胜`);
  } finally { busy = false; renderAll(st, handlers); saveGame(st); }
}
// ── 红白堂/土司府：宴席差事——配 3 菜 1 酒 → 评分 → 银钱/名声/人情 ──
function doYanxi(locName) {
  const ls = locOf(locName === "红白堂" ? "hongbai" : "tusi");
  const fresh = (ls.fresh && ls.fresh.week === st.day) ? ls.fresh : null;
  const host = fresh?.npc || (locName === "红白堂" ? "王员外" : "土司爷");
  const note = fresh ? `${esc(fresh.title)}——${esc(fresh.desc)}` : (locName === "红白堂" ? "红白堂接了户人家的宴席活计。" : "土司府要办席，府里管事的来请厨。");
  const pay = 40 + Math.floor(Math.random() * 40);
  openModal(`
    <h2>${locName} · ${esc(host)}的活计</h2>
    <div class="loc-fresh">${esc(note)}</div>
    <div class="loc-desc">报三样菜 + 一味酒（菜库/小吃/酒库里的），凑得齐就开席，按菜色给工钱和人情。</div>
    <div class="loc-chat">
      <input id="yx-inp" placeholder="如：金鼎龙珠煨酸排、清溪蜜酿绿豆羹、霜鲤雷鸣，玉泉青稞酒" />
      <span class="ck-btn plain" data-go>接下</span>
    </div>
    <div class="loc-desc">工钱 ${pay} 文起，做得好有赏。</div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  const q = (s) => document.querySelector(`#modal-root ${s}`);
  q("[data-go]").onclick = () => {
    const v = q("#yx-inp").value.trim();
    if (!v) return;
    const parts = v.split(/[、，,]/).map(s => s.replace(/[「」"']/g, "").trim()).filter(Boolean);
    if (parts.length < 2) return sys("报清楚：至少两样（菜或小吃）+ 酒。");
    closeModal();
    doYanxiSettle(locName, host, parts, pay, fresh);
  };
  q("#yx-inp").addEventListener("keydown", (e) => { if (e.key === "Enter") q("[data-go]").click(); });
  q("[data-back]").onclick = () => closeModal();
}
function doYanxiSettle(locName, host, parts, pay, fresh) {
  if (busy) return;
  busy = true;
  try {
  startTrace("宴席差事");
  // 校验 + 扣
  let dishes = 0, snacks = 0, wine = null;
  const miss = [];
  for (const n of parts) {
    const di = (st.dishStore || []).findIndex(d => d.name === n);
    if (di >= 0) { st.dishStore[di].qty = (st.dishStore[di].qty || 1) - 1; dishes += 1; continue; }
    if ((st.snacks[n] || 0) > 0) { st.snacks[n] -= 1; if (st.snacks[n] <= 0) delete st.snacks[n]; snacks += 1; continue; }
    if ((st.wines[n] || 0) > 0) { st.wines[n] -= 1; if (st.wines[n] <= 0) delete st.wines[n]; wine = n; continue; }
    miss.push(n);
  }
  st.dishStore = (st.dishStore || []).filter(d => (d.qty || 1) > 0);
  if (miss.length) {
    for (const n of miss) { /* 已扣的退不回（简化） */ }
    sys(`缺货：${miss.join("、")}——这单没接成（有的已经下锅了，算了）。`);
    endTrace("宴席差事·缺料");
    return;
  }
  const got = dishes + snacks + (wine ? 1 : 0);
  const need3 = dishes + snacks >= 2 && wine; // 至少两菜一酒
  if (!need3) { sys("这单要两样菜以上 + 一味酒——配齐再来。"); endTrace("宴席差事·没配齐"); return; }
  // 评分：随机契合（简化：70-95 按酒菜种类数）
  const score = 70 + Math.floor(Math.random() * 26);
  const bonus = score >= 85 ? 30 : score >= 75 ? 15 : 0;
  const total = pay + bonus;
  st.coins += total;
  st.fame = (st.fame || 0) + (bonus ? 2 : 1);
  ledger(`${locName}·宴席`, total);
  narr(`${host}家的宴席开席，${parts.join("、")}摆上桌——席面${score >= 85 ? "宾客交口称赞" : score >= 75 ? "吃得尽兴" : "中规中矩"}，东家奉上 ${total} 文工钱${bonus ? "（含赏钱）" : ""}。`);
  sys(`（${locName}差事成了：${score} 分 · +${total} 文 · 名声+${bonus ? 2 : 1}）`);
  if (fresh && fresh.week === st.day) fresh.done = true;
  note(locName, `${host}的宴席（${parts.join("、")}）${score}分，得${total}文。`);
  endTrace(`宴席差事·${score}分`);
  } finally { busy = false; renderAll(st, handlers); saveGame(st); }
}

// ── 瓦舍 · 说书/戏台：演出 + 打赏（赏钱→名声+流水，可点单）──
function openTheater(kind) {
  let topic = "";
  const draw = () => {
    openModal(`
      <h2>瓦 舍 · ${kind}</h2>
      <div class="loc-chat">
        <input id="th-inp" placeholder="点一段？留空先生自己挑……" />
        <span class="ck-btn plain" data-go>开演</span>
      </div>
      <div class="th-stage" id="th-stage">${kind === "说书" ? "醒木一响，先生正要开腔。" : "锣鼓一响，戏班子正要登台。"}</div>
      <div class="ck-btns">
        <span class="ck-btn plain" data-tip10>赏 10 文</span>
        <span class="ck-btn plain" data-tip50>赏 50 文</span>
        <span class="ck-btn plain" data-tip100>赏 100 文</span>
      </div>
      <div class="loc-desc">打赏越多名声越响；听高兴了再赏。</div>
      <span class="return" data-back>Return · 返回</span>
    `, () => {});
    const q = (s) => document.querySelector(`#modal-root ${s}`);
    const stage = q("#th-stage");
    q("[data-go]").onclick = async () => {
      topic = q("#th-inp").value.trim();
      q("#th-inp").value = "";
      stage.innerHTML = "（开场了……）";
      if (busy) return;
      busy = true;
      try {
        const r = await genTheater(loadCfg(), { kind, topic, world: worldState() });
        stage.innerHTML = esc(r.prose).replace(/\n/g, "<br>");
        if (!r.ai) sys("（说书人未接线——先生用了老段子。）");
        st.theater = st.theater || [];
        st.theater.push({ kind, title: topic || (kind === "说书" ? "老段子" : "拿手戏"), text: r.prose, day: st.day });
        saveGame(st);
      } finally { busy = false; }
    };
    const tip = (v) => {
      if (st.coins < v) return sys("文钱不够。");
      st.coins -= v; ledger(`瓦舍打赏`, -v);
      st.fame = (st.fame || 0) + (v >= 100 ? 3 : v >= 50 ? 2 : 1);
      sys(`打赏 ${v} 文——先生${kind === "说书" ? "拱手" : "谢了场"}，名声+${v >= 100 ? 3 : v >= 50 ? 2 : 1}。`);
      saveGame(st);
    };
    q("[data-tip10]").onclick = () => tip(10);
    q("[data-tip50]").onclick = () => tip(50);
    q("[data-tip100]").onclick = () => tip(100);
    q("[data-back]").onclick = () => closeModal();
  };
  draw();
}
// ── 瓦舍 · 围炉夜话：群聊（多人互相接话，玩家插话），酒后吐真言（情报/好感）──
async function doWeilu() {
  if (busy) return sys("说书人正忙着呢。");
  const folks = (st.squareFolks || []).filter(f => f.week === st.day).slice(0, 2);
  const jhHere = (st.jianghu?.batch || []).filter(b => b.locId === "washe")
    .map(b => JIANGHU_ROSTER.find(c => c.id === b.id)).filter(Boolean).slice(0, 1);
  const npcs = [
    ...folks.map(f => ({ npcId: f.npcId, name: f.name, ident: f.ident })),
    ...jhHere.map(c => ({ npcId: c.id, name: c.name, ident: c.ident })),
  ];
  if (!npcs.length) return sys("篝火还冷着——这周瓦舍没有江湖客，下周翻篇再来围炉。");
  busy = true;
  try {
  startTrace("围炉夜话");
  st.weilu = st.weilu || { day: 0, lines: [] };
  if (st.weilu.day !== st.day) st.weilu = { day: st.day, lines: [] };
  let roundNo = 0;
  let panel = null;
  const round = async (text) => {
    roundNo++;
    const thread = st.weilu.lines.slice(-6).join("\n");
    const r = await genWeiluChat(loadCfg(), npcs.map(n => ({ name: n.name, ident: n.ident })), thread, text);
    const out = (r.text || fallbackWeiluRound(npcs, text)).trim();
    for (const line of out.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      panel.append(t);
      st.weilu.lines.push(t);
    }
    const tm = out.match(/【真言】\s*([^\n]+)/);
    if (tm) {
      const info = tm[1].trim().slice(0, 50);
      st.square = st.square || [];
      st.square.push({ from: "酒后真言", form: "传闻", text: info, day: st.day, ts: nowTs() });
      sys(`（酒后真言：「${info}」——已上布告墙。）`);
    }
    if (roundNo === 1) {
      for (const n of npcs) { st.aff = st.aff || {}; if (n.npcId) st.aff[n.npcId] = Math.min(100, (st.aff[n.npcId] || 0) + 1); }
      sys(`（围炉众人喝得尽兴，好感各+1——可随时插话，聊到尽兴再散场。）`);
    }
    saveGame(st);
  };
  panel = openWeiluChat(st, npcs.map(n => ({ name: n.name, ident: n.ident })), {
    onSend: round,
    onExit: () => { saveGame(st); },
  });
  round("");
  endTrace("围炉夜话");
  } catch (e) { console.error("围炉出错:", e); } finally { busy = false; renderAll(st, handlers); }
}
// 没接 AI 时的围炉兜底：模板互聊
function fallbackWeiluRound(npcs, text) {
  const a = npcs[0], b = npcs[1];
  const lines = ["篝火噼啪，酒碗在手里转了一圈。"];
  if (a) lines.push(`${a.name}：「好酒！这坛子够劲。」`);
  if (b) lines.push(`${b.name}：「${a ? a.name : "你"}这话说得在理——干！」`);
  if (text) lines.push(`${a ? a.name : npcs[0].name}：「${text.slice(0, 12)}……这话有意思，再说说。」`);
  return lines.join("\n");
}
function doDibao() {
  const items = [];
  for (const n of (st.notes || [])) if (n.day === st.day && (n.text || n.ai)) items.push(`${n.act || "大事"}：${n.text || n.ai}`);
  for (const s of (st.square || [])) if (s.day === st.day) items.push(`${s.from}：${s.text}`);
  const fameGain = (st.dibaoRead || 0) === st.day ? 0 : 1;
  if (fameGain) { st.dibaoRead = st.day; st.fame = (st.fame || 0) + 1; }
  openModal(`
    <h2>邸 报 · 第 ${st.day} 周</h2>
    <div class="loc-fresh" style="white-space:pre-wrap;line-height:1.9">${items.length ? items.slice(0, 8).map(x => `· ${esc(x)}`).join("\n") : "本周风平浪静，市面无甚大事。"}</div>
    <div class="loc-desc">读报知天下${fameGain ? "——街坊见你关心世事，名声+1。" : ""}</div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
  if (fameGain) saveGame(st);
}
function openSquareBoard() {
  const items = (st.square || []).slice(-12).reverse();
  openModal(`
    <h2>布 告 墙 · 广场</h2>
    <div class="ck-mats" style="flex-direction:column;align-items:stretch">
      ${items.length ? items.map(x => `<span class="ck-mat" style="white-space:normal;line-height:1.8">${esc(x.from)}：${esc(x.text)}<i style="display:block;opacity:.6">第${x.day}周 ${x.ts}</i></span>`).join("") : `<span class="ck-mat zero">布告墙还空着——跟广场的人聊聊天，消息会传上来。</span>`}
    </div>
    <span class="return" data-back>Return · 返回</span>
  `, () => {});
  document.querySelector("#modal-root [data-back]").onclick = () => closeModal();
}

// ── 世界回响：每完成一件事单独跑一个（200字叙事 + 一行AI小纸条）──
// 200 字存 st.echoes 播放池（不注入 prompt）；AI 纸条行挂到该轮系统小纸条之后（st.notes 条目 ai 字段）。
// 播放：新回响夺舍（立即上），之后每 15s 随机换池子一条，播 3 条自然收尾。
let echoTimer = null;
let echoChain = 0;      // 回响链代：新回响夺舍时 +1，作废旧链（防多条链打架）
let lastEchoAt = 0; // 最近一次回响触发时间：没动静超 5 分钟，后台自动补一条日常回响（说书人自己跑）
function worldState() {
  const tier = (st.ryuweiRating || {}).tier ?? 0;
  return `西蜀豆花庄第${st.day}周${tier > 0 ? `，挂着余味送的${tier}支银簪（${ryuweiTierName(st)}）` : "，还没拿到银簪"}。苏唐好感${st.suAff ?? 0}。`;
}
async function fireEcho(event, result) {
  lastEchoAt = Date.now();
  sys(`（说书人正在写市井回响：${event}……）`); // 主叙事可见：正在生成
  const r = await genEcho(loadCfg(), { event, result, world: worldState() });
  if (!r.prose) return;
  st.echoes = st.echoes || [];
  const noteLine = r.note || (result || "").slice(0, 30); // AI 没出纸条行时兜底
  st.echoes.push({ form: r.form, prose: r.prose, note: noteLine, day: st.day });
  if (st.echoes.length > 30) st.echoes.shift();
  st.square = st.square || [];
  st.square.push({ from: `${r.form}·街巷`, form: r.form, text: noteLine, day: st.day, ts: nowTs() }); // 回响同步上布告墙
  if (st.square.length > 60) st.square.shift();
  // AI 一行小纸条：匹配到系统小纸条之后（该轮最近一条 note 的 ai 字段，各自一行、作为一条）
  if (noteLine) {
    st.notes = st.notes || [];
    const last = st.notes[st.notes.length - 1];
    const d = new Date(); const p = (n) => String(n).padStart(2, "0");
    const ts = `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (last && last.day === st.day && !last.ai) last.ai = noteLine;
    else st.notes.push({ day: st.day, ts, act: `回响·${r.form}`, text: "", ai: noteLine });
  }
  sys(`（回响已生成：${r.form}「${noteLine}」——底部滚动播放。）`); // 主叙事可见：已生成
  saveGame(st); // 回响随存档落盘：读档后滚动池继承，不丢
  playEcho(r);                               // 夺舍播放：新回响立即上
}
function playEcho(echo) {
  stopEcho();
  const gen = ++echoChain;
  const pool = st.echoes || [];
  let idx = Math.max(0, pool.findIndex(e => e === echo));
  const next = () => {
    if (gen !== echoChain) return;             // 已被新回响夺舍，旧链作废
    const p = st.echoes || [];
    if (!p.length) return;
    idx = (idx + 1) % p.length;                // 顺序循环：播完从头再来
    const e = p[idx];
    let done = false;
    const guard = setTimeout(() => {           // 双保险：动画卡住（隐藏/异常）也强制换，绝不卡
      if (!done) { done = true; next(); }
    }, 33000);
    showEcho(e, () => { if (!done) { done = true; clearTimeout(guard); next(); } });
  };
  showEcho(echo, next);                        // 首条滚完接链
}
function stopEcho() {
  if (echoTimer) { clearInterval(echoTimer); echoTimer = null; }
}

// ── 酿造：苏唐下坛（4格自由选料 → 判定 → 入在酿清单 → AI 叙事；内功催酿）──
async function doBrew({ base, qu, extras, distill }) {
  const need = [base, qu, ...(extras || [])];
  const miss = need.filter(n => (st.inv[n] || 0) <= 0);
  if (miss.length) return sys(`缺料：${miss.join("、")}——酿不了。`);
  if (distill && !(st.inv["蒸馏器"] || 0)) return sys("上甑蒸馏要甑锅——先弄台蒸馏器（打箭炉铁匠铺的货）。");
  if ((st.brewing || []).length >= 3) return sys("坛子都用完了——等酿好的出坛再说。");
  if (busy) return sys("说书人正忙着呢。");
  busy = true;
  try {
  for (const n of need) { st.inv[n] -= 1; if (st.inv[n] <= 0) delete st.inv[n]; }
  const rec = matchBrew(base, qu, extras || [], !!distill);
  const weeks = brewWeeks(rec, st);
  const b = {
    recipeId: rec.id, name: rec.name, base: rec.base, qu: rec.qu, extra: rec.extra || [],
    flavor: rec.flavor, strong: !!rec.strong, kind: rec.kind, needsStill: !!rec.needsStill,
    startedDay: st.day, dueDay: st.day + weeks,
  };
  st.brewing = st.brewing || [];
  st.brewing.push(b);
  closeModal();
  startTrace("酿造");
  const r = await genBrew(loadCfg(), b);
  await suLine(r.prose);
  if (!r.ai) sys("（说书人未接线或掉线，酿酒先用模板。）");
  const when = weeks === 0 ? "立等可取" : `第 ${b.dueDay} 周可取`;
  suSys(`【酿造】「${b.name}」下坛 · ${when} · 内功 ${st.skills["内功"] || 0}`);
  note("酿造", `苏唐酿「${b.name}」（${rec.kind}），${when}。`);
  endTrace(`酿造「${b.name}」`);
  } finally { busy = false; }
  renderAll(st, handlers);
  saveGame(st);
}

// ── 余味开席：四样（大菜/汤/小吃/酒水）各 25%，总分定星 ────────
// ── 买基酒（应急：商店现成的品质固定，自己酿的更高）────────────
// ── 米酒配甜：扣 1 杯米酒 + 甜料 → 苏唐做甜点小吃（酒入馔）────
function doWineDessert(name) {
  const d = WINE_DESSERTS.find(x => x.name === name);
  if (!d) return;
  const riceWines = Object.keys(st.wines || {}).filter(n => (st.wines[n] || 0) > 0
    && ((st.wineRecipes || []).find(r => r.name === n)?.kind === "米酒" || SHOP_WINES.some(w => w.name === n)));
  if (!riceWines.length) return sys("没有米酒——先酿坛米酒（或商店买锦官米酒）。");
  if ((st.inv[d.sweet] || 0) <= 0) return sys(`缺「${d.sweet}」。`);
  if (busy) return sys("说书人正忙着呢。");
  const wineName = riceWines[0];
  st.wines[wineName] -= 1;
  if (st.wines[wineName] <= 0) delete st.wines[wineName];
  st.inv[d.sweet] -= 1;
  if (st.inv[d.sweet] <= 0) delete st.inv[d.sweet];
  st.snacks = st.snacks || {};
  st.snacks[d.name] = (st.snacks[d.name] || 0) + 3;
  const wq = (st.wineRecipes || []).find(r => r.name === wineName)?.quality ?? 60;
  const q = Math.min(100, Math.round(55 + wq / 4));
  st.snackRecipes = st.snackRecipes || [];
  const rec = st.snackRecipes.find(x => x.name === d.name);
  if (rec) rec.quality = Math.max(rec.quality, q);
  else st.snackRecipes.push({ name: d.name, cat: d.cat, tag: d.cat, used: [wineName, d.sweet], quality: q, desc: d.desc, flavor: "tian" });
  suLine(`「${d.name}」成了——${wineName}配${d.sweet}，${d.desc}`);
  sys(`【甜点】${d.name} 3 份（用 ${wineName} · 品质 ${q}）`);
  note("甜点", `苏唐用${wineName}做了「${d.name}」3份，品质${q}。`);
  renderAll(st, handlers);
  saveGame(st);
}

// ── 白酒/黄酒入药：酒泡药材 → 药酒（品质=酒×0.6+药材星×12）────
function doMedicate(wineName, herbName) {
  const herb = MEDICINE_HERBS.find(h => h.name === herbName);
  if (!herb) return;
  if ((st.wines[wineName] || 0) <= 0) return sys(`没有「${wineName}」。`);
  if ((st.inv[herbName] || 0) <= 0) return sys(`缺药材「${herbName}」。`);
  const wq = (st.wineRecipes || []).find(r => r.name === wineName)?.quality
    || SHOP_WINES.find(w => w.name === wineName)?.quality || 60;
  const hStar = (st.stars || {})[herbName] || 0;
  st.wines[wineName] -= 1;
  if (st.wines[wineName] <= 0) delete st.wines[wineName];
  st.inv[herbName] -= 1;
  if (st.inv[herbName] <= 0) delete st.inv[herbName];
  const med = `${herbName}药酒`;
  const q = Math.min(100, Math.round(wq * 0.6 + hStar * 12));
  st.wines = st.wines || {};
  st.wines[med] = (st.wines[med] || 0) + 1;
  st.wineRecipes = st.wineRecipes || [];
  const rec = st.wineRecipes.find(r => r.name === med);
  if (rec) rec.quality = Math.max(rec.quality, q);
  else st.wineRecipes.push({ name: med, base: wineName, qu: "", extra: [herbName], flavor: herb.flavor, quality: q, kind: "药酒" });
  suLine(`「${med}」入坛——${wineName}泡${herbName}，酒色转沉，药气入酒。`);
  sys(`【药酒】${med} 1 瓶（品质 ${q}）——药铺收，懂行的客人也认。`);
  note("药酒", `${wineName}泡${herbName}成「${med}」，品质${q}。`);
  renderAll(st, handlers);
  saveGame(st);
}

function doBuyWine(name) {
  const w = SHOP_WINES.find(x => x.name === name);
  if (!w) return;
  if (st.coins < w.price) return sys(`钱不够——${w.name}要 ${w.price} 文。`);
  st.coins -= w.price;
  st.wines = st.wines || {};
  st.wines[w.name] = (st.wines[w.name] || 0) + 1;
  sys(`买了「${w.name}」（品质 ${w.quality}）——自己酿的会更好。`);
  renderAll(st, handlers);
  saveGame(st);
}

async function doSnackRequest(txt) {
  if (busySnack) return sys("苏唐正忙着备小吃呢。");
  busySnack = true;
  try {
  closeModal();
  startTrace("备小吃");
  suSys(`【行动·备小吃】师兄说：${txt || "随便"}`);
  const cfg = loadCfg();
  const mv = Math.round(Object.values(st.skills).reduce((a, b) => a + b, 0) / 7);
  const r = await genSnack(cfg, { request: txt, inv: st.inv, guest: currentGuest(st), suTier: suTierOf(st), martialTier: tierOfScore(mv), words: cfg.snackWords || 300, context: ctxLine(st), stars: st.stars, st });
  for (const m of r.used) {
    st.inv[m] = (st.inv[m] || 0) - 1;
    if (st.inv[m] <= 0) delete st.inv[m];
  }
  st.snacks = st.snacks || {};
  st.snacks[r.made] = (st.snacks[r.made] || 0) + r.portions;
  (st.todaySnacks = st.todaySnacks || []).push({ name: r.made, quality: r.quality, flavor: r.flavor });
  st.snackRecipes = st.snackRecipes || [];
  const srec = st.snackRecipes.find(x => x.name === r.made);
  if (srec) { srec.desc = r.desc || srec.desc; srec.used = r.used; srec.quality = r.quality; srec.flavor = r.flavor || srec.flavor; }
  else st.snackRecipes.push({ name: r.made, cat: r.cat, tag: r.cat, used: r.used, quality: r.quality, desc: r.desc, flavor: r.flavor });
  const got = applySuExp(st);
  st.suAff = (st.suAff || 0) + 1;
  setMood(moodIndex(r.mood) ?? 7);
  if (r.narrative) await suLine(r.narrative);   // 苏唐做小吃的~300字小剧情（右栏）
  suSys(`【回复·备小吃】备下「${r.made}」${r.portions} 份 · 用 ${r.used.join("、") || "手头现成的"} · 品质 ${r.quality}`);
  suSys(`【苏唐】练功：${got.join("、")} 各+3 · 好感+1（今 ${st.suAff}）`);
  note("备小吃", r.note || `苏唐备「${r.made}」${r.portions}份，品质${r.quality}，味型${r.flavor || "无"}。`);
  endTrace(`苏唐备「${r.made}」${r.portions}份·品质${r.quality}`);
  } finally { busySnack = false; }
  renderAll(st, handlers);
  saveGame(st);
}

async function doRemake(name) {
  const rec = (st.snackRecipes || []).find(x => x.name === name);
  if (!rec) return;
  for (const m of rec.used) if ((st.inv[m] || 0) <= 0) return sys(`缺「${m}」，苏唐巧妇难为无米之炊。`);
  if (busySnack) return sys("苏唐正忙着备小吃呢。");
  busySnack = true;
  try {
  closeModal();
  startTrace("复做");
  suSys(`【行动·复做】师兄点名：${name}`);
  suLine(`苏唐照旧方复做「${name}」，手法熟得很。`);
  for (const m of rec.used) { st.inv[m] -= 1; if (st.inv[m] <= 0) delete st.inv[m]; }
  st.snacks = st.snacks || {};
  st.snacks[name] = (st.snacks[name] || 0) + 3;
  (st.todaySnacks = st.todaySnacks || []).push({ name, quality: rec.quality, flavor: rec.flavor });
  const got = applySuExp(st);
  st.suAff = (st.suAff || 0) + 1;
  if (rec.proc) await suLine(rec.proc);
  suSys(`【回复·复做】「${name}」3 份 · 品质 ${rec.quality}`);
  suSys(`【苏唐】练功：${got.join("、")} 各+3 · 好感+1（今 ${st.suAff}）`);
  note("复做", `苏唐复做「${name}」3份，品质${rec.quality}。`);
  endTrace(`苏唐复做「${name}」3份`);
  } finally { busySnack = false; }
  renderAll(st, handlers);
  saveGame(st);
}

// ── 邀客·点将明日（B，替掉原来的"苏唐"私聊入口——闲聊本来就能聊，这里管的是明日客位）──
// 最多点 GUESTS_PER_DAY 位，点谁都行，含踢馆八线的当前挑战者；再点一次取消。
function doPickGuest() {
  openInviteGuest(st, {
    onToggle: (id) => {
      st.nextGuestPicks = st.nextGuestPicks || [];
      const i = st.nextGuestPicks.indexOf(id);
      if (i >= 0) st.nextGuestPicks.splice(i, 1);
      else if (st.nextGuestPicks.length < GUESTS_PER_DAY) st.nextGuestPicks.push(id);
      saveGame(st);
    },
    onDone: () => {
      const picks = st.nextGuestPicks || [];
      if (!picks.length) return;
      const names = picks.map(id => findKnownGuest(st, id)?.name || id).join("、");
      sys(`已点将：${names}，明日必到。`);
    },
  });
}

// ── 佐餐（替代上菜+配set）──────────────────────────────────────────
function doZuocan() {
  if (st.phase !== "guest") return sys("现在没有客人。");
  const gSet = currentGuest(st);
  if (!gSet) return sys("现在没有客人。");
  // 多选上菜：菜库 + 小吃 + 酒（合计 ≤3 菜 + 1 酒；余味须凑齐 3 菜 + 1 酒）
  openServe(st, gSet, { onServe: (sel) => doServe(sel) });
}

// ── 踢馆梯度：第15周后，每周第二客位 50% 概率来八线里随机一位「当前该来」的同行 ──
// 玩家已经钦点了第2位客位（explicitPickCount≥2）时不抢——邀客点将优先。
function applyRival(st) {
  if (st.day < 15) return;
  if (st.rivalDone) return;                 // 八条线全挑完，不再来
  if ((st.explicitPickCount || 0) >= 2) return;
  if (Math.random() >= 0.5) return;
  const active = RIVAL_SCHOOLS.map((_, i) => i).filter(i => rivalGuestForSchool(st, i));
  if (!active.length) return;
  const schoolIdx = active[Math.floor(Math.random() * active.length)];
  const guest = rivalGuestForSchool(st, schoolIdx);
  st.guests = st.guests || [];
  st.guests[1] = guest.id;
}
// ── 熟客送礼：好感>20 的客人，新的一天几率送★食材（每天最多 3 人）──
// ── 熟客送礼：收功打烊时后台预热生成，第二天翻篇直接展示 ─────────────
// 好感>20 的客人每人 40% 几率送礼，每天最多 3 人；礼物落盘，剧情存 pendingGifts。
async function collectGifts() {
  const cands = Object.entries(st.aff || {})
    .filter(([, v]) => v > 20)
    .map(([id]) => findKnownGuest(st, id))
    .filter(Boolean);
  if (!cands.length) return;
  const givers = cands.filter(() => Math.random() < 0.4).slice(0, 3); // 40% 几率，最多 3 人
  if (!givers.length) return;
  const gifts = [];
  for (const g of givers) {
    const sp = (await genDropIngredient(loadCfg(), { context: `${g.name}（${g.ident}）挂念小馆，托人送来的一样高级食材。` })) || fallbackSpecial()[0];
    st.inv[sp.name] = (st.inv[sp.name] || 0) + 1;
    st.stars = st.stars || {}; st.starLore = st.starLore || {};
    st.stars[sp.name] = sp.stars;
    if (sp.desc) st.starLore[sp.name] = sp.desc;
    gifts.push({ name: g.name, ident: g.ident, ryuwei: !!g.ryuwei, gift: sp });
  }
  const r = await genGifts(loadCfg(), { givers: gifts });
  st.pendingGifts = { givers: gifts, text: r.text || "" };
  note("送礼", `熟客送礼(后台已备)：${gifts.map(g => `${g.name}→${g.gift.name}`).join("、")}。`);
  saveGame(st);
}
// 第二天翻篇时展示：先剧情，再单独带★总结收到哪些
async function showPendingGifts() {
  const pg = st.pendingGifts;
  if (!pg || !pg.givers || !pg.givers.length) { st.pendingGifts = null; return; }
  st.pendingGifts = null;
  if (pg.text) await narr(pg.text);
  const row = (g) => `　· 「${g.gift.name}」${"★".repeat(g.gift.stars)}（${g.gift.desc}）——${g.name}托人送来`;
  const plain = pg.givers.filter(g => !g.ryuwei).map(row);
  const glow = pg.givers.filter(g => g.ryuwei).map(row); // 食评人余味的礼单 · 顶级流光炫彩
  if (plain.length) await narr(["【收到】", ...plain].join("\n\n"));
  else if (glow.length) await narr("【收到】");
  for (const line of glow) await narrGlow(line);
}

async function doNext() {
  if (!(st.phase === "closing" || st.served >= 3)) { sys("还有客人没送完呢。"); return; }
  // 之前没有重入锁：手快连点两下「下一日」，第二次调用会把第一次还没等到点击的送礼弹层顶掉，
  // 顶掉的那个 Promise 永远等不到 res()，第一次调用卡在 await 上再也不往下走——补上跟别处一致的 busy 锁。
  if (busy) return sys("正忙着呢，别连点。");
  busy = true;
  try {
  await doReview();            // 收工总评在翻篇时做
  nextDay(st);
  // 酿造结算：到期的坛子出酒（苏唐的活计，跨周长期机制）
  const brews = settleBrewing(st);
  for (const b of brews) {
    const gain = 9 + Math.floor(b.quality / 10);
    await suLine(`酒坛子开了——「${b.name}」${b.extraWeeks ? `（比预定多陈了 ${b.extraWeeks} 周）` : ""}出酒 5 杯，品质 ${b.quality}。`);
    if (st.suSkills["酿酒"] <= 100) sys(`苏唐酿酒手艺见长：酿酒技能 +${gain}（今 ${st.suSkills["酿酒"]}）。`);
    note("出酒", `「${b.name}」出坛${b.extraWeeks ? `（多陈${b.extraWeeks}周）` : ""}，品质${b.quality}，5杯。`);
  }
  if (brews.length) void fireEcho("酿酒出坛", `${brews.map(b => `「${b.name}」品质${b.quality}`).join("、")} 出坛，苏唐的手艺又精了一分。`);
  void rollFreshEvents(st);    // 江湖酝酿：每周初各地点新鲜事（后台 roll，地图冒红点）
  applyRival(st);              // 第二客可能换成踢馆同行
  dismissInvite();             // 新一天开门：收掉昨天晚上的邀请面板
  setMood(0);
  renderAll(st, handlers, { hideGuest: true }); // 客人已经定好，但还没「门帘一掀」，左栏先别露底
  saveGame(st);
  await narr(`第 ${st.day} 周，${weekLabel(st.day)}，卯时。雾从溪面起来，小馆开门。`);
  // 晨间送礼：收功后台备好的熟客送礼，仪式感领取后再展示（剧情+★清单）
  const hasGifts = !!(st.pendingGifts && st.pendingGifts.givers && st.pendingGifts.givers.length);
  if (hasGifts) await waitGiftClaim();
  await showPendingGifts();
  if (Math.random() < 0.3) await maybeNewGuest(); // 三成机会，溪边又来了新面孔
  await guestArrives();
  saveGame(st); // 门帘一掀之后这段（含 recentLog 这一轮）再落一次盘，不等玩家下一步动作才存
  } finally { busy = false; }
}

// ── 招新客：AI 生成一位新顾客入册（日后可能被抽到）──────────────────
async function maybeNewGuest(silent) {
  if (busy) return false;
  const g = await genNewGuest(loadCfg());
  if (!g) { if (!silent) sys("门口晃了晃，没见生人（说书人未接线或失手）。"); return false; }
  st.customGuests = st.customGuests || [];
  st.customGuests.push(g);
  saveGame(st);
  if (!silent) await narr(`苏唐从溪边打水回来，念叨：「村里多了个生面孔，${g.name}，${g.ident}，说改天来坐坐。」`);
  return true;
}
function doNewGuest() {
  if (busy) return sys("正忙着呢。");
  sys("【招客】苏唐往门口张望——");
  maybeNewGuest();
}

// ── 终端输入 ───────────────────────────────────────────────────────────
async function onCommand(text) {
  const t = text.trim();
  if (!t) return;
  markPrompt(); // 新一轮开始：左右滚动条打分段点
  playerLine(t);
  const cmd = t.toLowerCase();
  if (["帮助", "help", "?"].includes(cmd)) return openHelp();
  if (cmd.startsWith("广场 ")) { const rest = t.slice(3).trim(); if (!rest) return sys("广场说点什么——「广场 今天有什么新鲜事？」"); return doLocChat("square", "广场上的人", "广场", (st.square || []).slice(-2).map(x => x.text).join("；") || "今日广场尚算平静", rest); }
  if (cmd.startsWith("聊")) {
    const rest = t.slice(1).trim();
    const m = rest.match(/^([^\s，,。]+)[，,\s]*(.*)$/s);
    if (m) {
      const who = m[1], say = (m[2] || "").trim();
      const g = GUESTS.find(x => x.name === who || x.name.includes(who) || who.includes(x.name));
      if (!g) return sys(`没这号人——常客：${GUESTS.filter(x => (st.aff[x.id] || 0) > 0).map(x => x.name).slice(0, 6).join("、") || "（还没熟人）"}`);
      if (!say) return sys(`跟${g.name}说什么——「聊${g.name} 想问问余味的事」`);
      return doLocChat(g.id, g.name, "豆花庄", "", say);
    }
  }
  if (["灶台", "做菜", "开灶"].includes(cmd)) return doCook();
  if (["上菜", "端菜", "佐餐"].includes(cmd)) return doZuocan();
  if (["小吃", "零食"].includes(cmd)) return doSnackPanel();
  if (["酿造", "酿酒", "brew", "酒"].includes(cmd)) return openBrew(st, { onBrew: doBrew, onBuy: doBuyWine, onDessert: doWineDessert, onMedicate: doMedicate });
  if (["商店", "买", "逛街"].includes(cmd)) return doShop();
  if (["探秘", "副本", "exp"].includes(cmd)) return openExpeditionMap();
  if (["江湖", "地图", "world"].includes(cmd)) return openWorld();
  if (["新客", "招客", "newguest"].includes(cmd)) return doNewGuest();
  if (["成就", "徽章", "ach"].includes(cmd)) return showAchievements();
  if (["■", "黑方块", "nsfw", "模式"].includes(cmd)) return handlers.nsfw();
  if (["下一日", "下一天", "等待", "睡觉", "明儿"].includes(cmd)) return doNext();
  if (["背包", "包袱"].includes(cmd)) return openBag(st);
  if (["设置"].includes(cmd)) return openSettings();
  if (["流程", "日志", "trace"].includes(cmd)) return openTrace();
  if (["纸条", "notes"].includes(cmd)) return openNotes(st);
  if (["邀客", "点将", "请客"].includes(cmd)) return doPickGuest();
  if (["存档"].includes(cmd)) return exportSave();
  if (["导入", "读档", "载入"].includes(cmd)) return importSave();

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
  startTrace("闲聊");
  const h = logStream("narr");
  const r = await genChat(loadCfg(), t, c => h.append(c), chatContext(st));
  // 客人心愿：AI 在对话里判断客人说出想吃什么 → 原话入小纸条 + 存档，做菜匹配加分（说了什么就是什么）
  const wish = (r.ai && h.text) ? extractComment(h.text).wish : (r.wish || "");
  if (wish) {
    const gWish = currentGuest(st);
    st.guestWishes = st.guestWishes || {};
    if (gWish) st.guestWishes[gWish.id] = wish;
    note("问客", `${gWish ? gWish.name : "客人"}说：「${wish}」`);
    sys(`记住了：${gWish ? gWish.name : "客人"}想吃「${wish}」——做菜对上了加分。`);
  }
  // 闲聊历史入档（苏唐接话有据：后几轮能提前面说过的事）
  const replyText = (r.prose || "").replace(/\n/g, " ").trim();
  if (replyText) {
    st.chatLog = st.chatLog || [];
    st.chatLog.push({ u: t, a: replyText.slice(0, 40) });
    if (st.chatLog.length > 8) st.chatLog.shift();
  }
  note("闲聊", `师兄说「${t.slice(0, 18)}」，说书人接了一段。`);
  endTrace("闲聊一段");
  if (r.ai && h.text) {
    const { main, comment, mood } = extractComment(h.text);
    h.apply(main, comment ? `苏唐批：${comment}` : "", faceOf(moodIndex(mood)));
    setMood(moodIndex(mood) ?? 0);
  } else {
    h.remove(); await narr(r.prose);
    if (!r.ai) sys("（说书人未接线或掉线，闲聊先用模板接话。设置里填 AI 密钥可现写。）");
    if (r.comment) await commentLine(r.comment, faceOf(r.mood));
    setMood(r.mood ?? 0);
  }
  // ■模式·闲聊区：AI 标了暧昧表情才按情节换 NSFW 表情，否则保持正常心情表情
  const faceIdx = POSE_INDEX[extractFace(r.ai && h.text ? h.text : r.prose)];
  if (getNsfw() && Number.isInteger(faceIdx)) rollNsfwFace(faceIdx);
  if (r.ms != null) sys(`说书 ${fmtMs(r.ms)} · ${r.prose.length} 字`);
  // 闲聊加好感：按 AI 给的质量值（0-3），苏唐和受邀女客一起加
  const affGain = r.aff ?? 0;
  st.suAff = Math.min(100, (st.suAff || 0) + affGain);
  let invGain = "";
  if (st.invitedGuest) {
    st.aff = st.aff || {};
    st.aff[st.invitedGuest] = Math.min(100, (st.aff[st.invitedGuest] || 0) + affGain);
    const inv = findKnownGuest(st, st.invitedGuest);
    if (inv) invGain = ` · ${inv.name}好感+${affGain}`;
  }
  suSys(`【苏唐】好感+${affGain}（今 ${st.suAff}）${invGain}`);
  // 做爱做到位：受邀女客可能爆食材（AI 按她生成，避免固定池重复）
  if (st.invitedGuest && r.intimacy === "到位" && Math.random() < 0.5) {
    const inv = findKnownGuest(st, st.invitedGuest);
    const sp = (await genDropIngredient(loadCfg(), { context: `${inv?.name || "她"}（${inv?.ident || "受邀女客"}）餍足满意，从包袱里拿出的好东西。` })) || fallbackSpecial()[0];
    st.inv[sp.name] = (st.inv[sp.name] || 0) + 1;
    st.stars = st.stars || {}; st.starLore = st.starLore || {};
    st.stars[sp.name] = sp.stars;
    if (sp.desc) st.starLore[sp.name] = sp.desc;
    await narr(`${inv?.name || "她"}餍足地靠在榻上，随手从包袱里摸出一样东西塞给你——「${sp.name}」${"★".repeat(sp.stars)}。`);
  }
  saveGame(st);
  busy = false;
}

// ── 存档下载 / 导入（参考 ji-haitang：自动存档 + 手动下载 + 导入）────
function exportSave() {
  saveGame(st); // 先落本地，再下载一份
  const data = JSON.stringify(st, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `西蜀豆花庄-第${st.day}周-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  sys(`存档已下载：${a.download}（本地也已自动存）。`);
}
function importSave() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data || typeof data.day !== "number" || !data.inv || !data.skills || !data.suSkills)
          throw new Error("不是有效的豆花庄存档");
        if (Array.isArray(data.dishStore)) data.dishStore = data.dishStore.filter(d => (d.qty ?? 1) > 0); // 导入同样清洗没货的菜
        st = data;
        saveGame(st);
        renderAll(st, handlers);
        restoreRecentLog();  // 导入存档同样把最近5轮左右栏内容铺回来
        setMood(0);
        sys(`已导入第 ${st.day} 周的存档（${st.coins} 文）。`);
      } catch (e) { sys(`导入失败：${e.message}`); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

// ── 绑定 ───────────────────────────────────────────────────────────────
function bind() {
  const spiral = document.querySelector("#spiral");
  if (spiral) spiral.onclick = () => openCg();   // 左上角圆圈 → 全屏 CG
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
    if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl/Cmd/Alt 组合（复制/切窗等）不触发游戏键
    if (e.repeat) return;                            // 长按自动重复不触发
    if ($("#modal-root").classList.contains("open")) return;
    if (!st) return;
    const k = e.key.toLowerCase();
    const map = { c: "cook", u: "snack", w: "brew", x: "serve", y: "world", t: "shop", m: "exp", n: "next", j: "invite", i: "bag", f: "settings", l: "trace", p: "notes", q: "save", h: "help" };
    if (map[k]) handlers[map[k]]();
  });
  $("#btn-new").onclick = () => startNew();
  $("#btn-cont").onclick = () => continueGame();
  if (hasSave()) $("#btn-cont").style.display = "";
  // 回响滚动条：× 暂时收起（新回响来了再上）；设置里可彻底开关
  const ebar = $("#echo-bar");
  if (ebar) {
    const x = ebar.querySelector(".echo-bar-x");
    if (x) x.onclick = () => { ebar.classList.add("hidden-bar"); $("#term")?.classList.remove("eb-space"); };
    if (!echoBarOn()) ebar.classList.add("hidden-bar");
  }
  renderRate();
  setInterval(renderRate, 1000); // 限流灯每秒刷新（12s 计时）
  // 说书人后台跑：超过 5 分钟没事件回响，自动补一条日常回响（每分钟检查一次），滚动播放不冷场
  setInterval(() => {
    if (busy || !st) return;
    if (Date.now() - lastEchoAt < 300000) return;
    void fireEcho("豆花庄日常", `豆花庄第${st.day}周，灶火未歇，街坊都在念叨店里的新菜。`);
  }, 60000);
  initMobileDrawers(() => renderAll(st, handlers));
}

function $(sel) { return document.querySelector(sel); }

bind();
