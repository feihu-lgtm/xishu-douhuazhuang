// 鱼定村小馆 · 状态与裁决（纯函数，不碰 DOM）
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE_BY_ID, DEFAULT_COOKWARE_ID, FLAVOR_BY_ID,
  RECIPES, GUESTS, INGREDIENTS, ING_BY_NAME, QUAL_BONUS, START_INV, START_COINS, SHOP_BASICS,
} from "./data.js";

export const GUESTS_PER_DAY = 3;
const SAVE_KEY = "xiaochu-save-v1";

// ── 种子随机（同一天客人固定）──────────────────────────────────────────
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function guestsOfDay(day) {
  const rnd = mulberry32(day * 7919 + 13);
  const pool = [...GUESTS];
  const picked = [];
  for (let i = 0; i < GUESTS_PER_DAY; i++) {
    const idx = Math.floor(rnd() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function newState() {
  return {
    day: 1,
    coins: START_COINS,
    inv: { ...START_INV },
    cookware: [DEFAULT_COOKWARE_ID],
    techs: TECHNIQUE_IDS.filter(t => TECHNIQUES[t].unlock === 0), // 煎炒炸炖开局
    flavors: FLAVORS_START(),
    served: 0,
    phase: "guest",          // guest | closing | night
    guests: guestsOfDay(1).map(g => g.id),
    dish: null,              // 手中菜 {name, materials, technique, cookware, flavor, recipe, quality}
    totalServed: 0,
    earned: 0,
    aff: {},                 // 好感度 {guestId: 0-100}
    skills: { 刀法: 10, 剑法: 10, 拳掌: 10, 枪法: 10, 投掷: 10, 轻功: 10, 内功: 10 },
    suSkills: { 刀法: 20, 剑法: 10, 拳掌: 15, 枪法: 10, 投掷: 15, 轻功: 15, 内功: 15 }, // 苏唐的
    suAff: 0,                // 苏唐好感（对话/备菜就加）
    snacks: {},              // 备好的小吃 {name: 份数}
    snackRecipes: [],        // 苏唐菜单 [{name,cat,tag,used,quality,desc}]
    menu: [],                // 师兄菜单 [{name,used,desc}]
    notes: [],               // 小纸条：每轮动作/对话的小总结 [{day,ts,act,text}]
    todaySnacks: [],         // 今日苏唐做的小吃 [{name,quality,flavor}]
    pendingSet: null,        // 上菜时配的 set
    shopSeed: 1,
    shopIng: null,           // 刷新后的在架食材
    buyQty: {},              // 每样固定买几份（锁定，免手动调）
    dayLog: [],              // 今日逐客记录（收工总评用）
    reviewedDay: 0,          // 已总评的天
  };
  st.shopIng = rollShopIng(st.shopSeed);
  return st;
}

// 商店在架食材：常备 + 种子滚出的流动货
export function rollShopIng(seed) {
  const rnd = mulberry32(seed);
  const extras = INGREDIENTS.map(i => i.name).filter(n => !SHOP_BASICS.includes(n));
  for (let i = extras.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [extras[i], extras[j]] = [extras[j], extras[i]];
  }
  return [...SHOP_BASICS, ...extras.slice(0, 16)];
}
export function refreshShop(st) {
  st.shopSeed = (Math.random() * 1e9) | 0;
  st.shopIng = rollShopIng(st.shopSeed);
}
export function shopIngOf(st) {
  return st.shopIng || INGREDIENTS.map(i => i.name);
}

// 苏唐练功（小吃经验给她）
export function applySuExp(st, gain = 3) {
  st.suSkills = st.suSkills || {};
  const pick = ["刀法", "拳掌", "投掷", "轻功", "内功"];
  const got = [];
  for (const x of pick) { st.suSkills[x] = Math.min(100, (st.suSkills[x] || 0) + gain); got.push(x); }
  return got;
}

// 好感档位名
export function affName(v) {
  if (v >= 70) return "知心";
  if (v >= 45) return "投缘";
  if (v >= 20) return "熟络";
  return "面生";
}
// 满意度→好感增量，口味匹配再加成（满意度-好感-口味勾连）
// 好感只增不扣：满意多加，不满意不扣（ coxy 游戏，不惩罚）
export function affDeltaFor(tier, flavorMatch, favMatch) {
  let d = [3, 2, 1, 0][tier] ?? 0;
  if (flavorMatch) d += 1;
  if (favMatch) d += 1;
  return d;
}
function FLAVORS_START() {
  return ["xianxiang", "qingdan"];
}

// ── 配方命中：料槽组合（不分先后）× 技法 ───────────────────────────────
function normKey(names) {
  return [...new Set((names || []).filter(Boolean))].sort().join("|");
}
export function matchRecipe(materialNames, techniqueId) {
  const key = normKey(materialNames);
  if (!key) return null;
  return RECIPES.find(r => r.technique === techniqueId && normKey(r.materials) === key) || null;
}

// ── 灶台裁决 ───────────────────────────────────────────────────────────
// 返回 { ok, warn?, recipe, freestyle, flavorId, quality }
export function judgeStove(st, slots, techId, cookwareId, flavorId) {
  const filled = slots.filter(Boolean);
  if (!filled.length) return { ok: false, warn: "灶膛烧得正旺，可锅里空空如也——先放点料。" };
  if (!st.techs.includes(techId)) return { ok: false, warn: "这门技法还没学过。" };
  const cw = COOKWARE_BY_ID[cookwareId] || COOKWARE_BY_ID[DEFAULT_COOKWARE_ID];
  if (TECHNIQUES[techId].needsSteamer && !cw.canSteam)
    return { ok: false, warn: "「蒸」需要能蒸的炊具（蒸笼/石灶釜/青铜鼎）。换一件家什。" };
  let fid = null;
  if (flavorId && st.flavors.includes(flavorId)) {
    const fl = FLAVOR_BY_ID[flavorId];
    if (fl.requires.every(r => filled.includes(r))) fid = flavorId;
  }
  const recipe = matchRecipe(filled, techId);
  const freestyle = !recipe;
  const quality = (QUAL_BONUS[cw.quality] || 0) + (recipe ? 10 : 0);
  return { ok: true, recipe, freestyle, flavorId: fid, quality, materials: filled, cookware: cw };
}

// ── 客人满意度裁决（AI 只写文字，数值系统说了算）──────────────────────
// 客人看「基础分 + 自己口味」
export function scoreDish(dish, guest) {
  let s = dish.baseScore ?? 40;
  if (dish.flavorId === guest.flavor) s += 10;
  if (dish.technique === guest.tech) s += 4;
  if (guest.fav && dish.materials.includes(guest.fav)) s += 6;
  return Math.max(0, Math.min(100, s));
}

// ── 武学七艺 · 做菜即练功 ─────────────────────────────────────────────
export const SKILLS = ["刀法", "剑法", "拳掌", "枪法", "投掷", "轻功", "内功"];
export const EXT_SKILLS = ["刀法", "剑法", "拳掌", "枪法", "投掷", "轻功"];
const TECH_BASE = { 炖: 40, 炒: 55, 烤: 55, 腌: 50, 蒸: 70 };

export function applyMartialExp(st, external, internal, gain = 3) {
  st.skills = st.skills || {};
  const got = [];
  for (const x of (external || [])) {
    if (EXT_SKILLS.includes(x)) { st.skills[x] = Math.min(100, (st.skills[x] || 0) + gain); got.push(x); }
  }
  if (internal) { st.skills["内功"] = Math.min(100, (st.skills["内功"] || 0) + gain); got.push("内功"); }
  return got;
}

// 基础分 = 外功(练到的几门均值)30% + 内功20% + 技法难度20% + 食材配合20% + 炊具10%
export function computeBaseScore(st, d) {
  const sk = st.skills || {};
  const chosen = (d.external || []).filter(x => EXT_SKILLS.includes(x));
  const pool = chosen.length ? chosen : EXT_SKILLS;
  const extAvg = pool.reduce((a, x) => a + (sk[x] || 0), 0) / pool.length;
  const internal = sk["内功"] || 0;
  const techBase = TECH_BASE[d.technique] ?? 40;
  const synergy = d.synergy ?? 60;
  const cookScore = ((QUAL_BONUS[d.cookware?.quality] ?? 0) / 15) * 100;
  const s = 0.30 * extAvg + 0.20 * internal + 0.20 * techBase + 0.20 * synergy + 0.10 * cookScore;
  return Math.max(0, Math.min(100, Math.round(s)));
}
export function tierOf(score) {
  if (score >= 85) return 0;
  if (score >= 65) return 1;
  if (score >= 45) return 2;
  return 3;
}
export function payOf(guest, score, aff = 0) {
  const base = Math.round(guest.spend * (0.4 + (score / 100) * 1.2));
  return Math.max(1, base + Math.floor(aff / 10)); // 好感越高，赏钱越厚
}

// ── 商店 ───────────────────────────────────────────────────────────────
export function shopStock(st) {
  return {
    cookware: Object.values(COOKWARE_BY_ID).filter(c => !c.default)
      .map(c => ({ cat: "cookware", id: c.id, name: c.name, price: c.price, desc: c.desc,
        owned: st.cookware.includes(c.id), quality: c.quality })),
    tech: Object.values(TECHNIQUES).filter(t => t.unlock > 0)
      .map(t => ({ cat: "tech", id: t.id, name: t.id, price: t.unlock, desc: t.desc,
        owned: st.techs.includes(t.id) })),
    flavor: Object.values(FLAVOR_BY_ID).filter(f => f.unlock > 0)
      .map(f => ({ cat: "flavor", id: f.id, name: f.name, price: f.unlock, desc: f.desc,
        owned: st.flavors.includes(f.id), extra: "核心调料：" + f.requires.join("、") })),
    ingredient: Object.values(ING_BY_NAME)
      .filter(i => shopIngOf(st).includes(i.name))
      .map(i => ({ cat: "ingredient", id: i.name, name: i.name, price: i.price, desc: i.lore,
        owned: false, extra: i.kind })),
  };
}

export function buyItem(st, cat, id) {
  const stock = shopStock(st)[cat] || [];
  const item = stock.find(x => x.id === id);
  if (!item || item.owned) return { ok: false, warn: "没这东西。" };
  if (st.coins < item.price) return { ok: false, warn: "文钱不够。" };
  st.coins -= item.price;
  if (cat === "cookware") st.cookware.push(id);
  else if (cat === "tech") st.techs.push(id);
  else if (cat === "flavor") st.flavors.push(id);
  else if (cat === "ingredient") st.inv[id] = (st.inv[id] || 0) + 1;
  return { ok: true, item };
}

// ── 日循环 ─────────────────────────────────────────────────────────────
export function currentGuest(st) {
  if (st.phase !== "guest") return null;
  const id = st.guests[st.served];
  return GUESTS.find(g => g.id === id) || null;
}
export function nextDay(st) {
  st.day += 1;
  st.served = 0;
  st.phase = "guest";
  st.guests = guestsOfDay(st.day).map(g => g.id);
  st.dish = null;
  st.todaySnacks = [];
  return st;
}

// ── 存档（浏览器 localStorage；node 环境静默跳过）─────────────────────
export function saveGame(st) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); return true; }
  catch { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    if (!st || typeof st.day !== "number" || !st.inv) return null;
    return st;
  } catch { return null; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
