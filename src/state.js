// 鱼定村小馆 · 状态与裁决（纯函数，不碰 DOM）
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE_BY_ID, DEFAULT_COOKWARE_ID, FLAVOR_BY_ID,
  RECIPES, GUESTS, INGREDIENTS, ING_BY_NAME, QUAL_BONUS, START_INV, START_COINS, SHOP_BASICS,
  RIVAL_LEVELS, RIVAL_SCHOOLS, FEMALE_GUEST_IDS, rivalGuestAt,
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

export function guestsOfDay(day, customGuests) {
  const rnd = mulberry32(day * 7919 + 13);
  const pool = [...GUESTS.filter(g => !g.rival), ...(customGuests || [])]; // 踢馆同行不进普通抽取池
  const picked = [];
  for (let i = 0; i < GUESTS_PER_DAY; i++) {
    if (i === 0 && !picked.some(g => g.id === "susu") && rnd() < 0.35) {
      const su = pool.find(g => g.id === "susu");
      if (su) { picked.push(su); pool.splice(pool.indexOf(su), 1); continue; }
    }
    if (!pool.length) break;
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
    chatLog: [],             // 闲聊历史：最近几轮 [{u: 师兄说, a: 苏唐回应}],供苏唐接话有据
    todaySnacks: [],         // 今日苏唐做的小吃 [{name,quality,flavor}]
    pendingSet: null,        // 上菜时配的 set
    shopSeed: 1,
    shopIng: rollShopIng(1), // 刷新后的在架食材（种子对应 shopSeed: 1）
    buyQty: {},              // 每样固定买几份（锁定，免手动调）
    dayLog: [],              // 今日逐客记录（收工总评用）
    reviewedDay: 0,          // 已总评的天
    checks: {                // 骰子检定·熟练度（见识/口才/赌博，成功越多越熟）
      见识: { succ: 0, achieve: false },
      口才: { succ: 0, achieve: false },
      赌博: { succ: 0, achieve: false },
    },
    techUses: {},            // 技法练功次数 {技法: n}（用前置技法N次解锁进阶）
    flavorUses: {},          // 味型练功次数 {味型id: n}
    customGuests: [],        // AI 生成的新顾客池 [{...GUESTS 同构, custom:true}]
    starLore: {},            // 探秘带星食材的简短描述 {name: desc}（做菜/小吃时当 lore 注入，别让 AI 自己脑补成别的）
    rivalStages: RIVAL_SCHOOLS.map(() => 0), // 踢馆进度：八条线各自的档位(0-4)，互不干扰
    rivalDone: false,        // 八大菜系·八线总厨全挑完
    invitedGuest: null,      // 收功后受邀留坐闲聊的女客 id（苏唐 + 女客 三人场）
    pendingGifts: null,      // 收功时后台备好的明日熟客送礼 {givers:[{name,gift}], text}
    guestMemories: {},       // 隔离记忆：{guestId:[{day,mainBy,dish,mainScore,snackName,snackScore}]} 每个客人只记得自己经历的事
    ryuweiRating: { pts: 0, tier: 0 }, // 食评人余味的鱼尾评级锚点：0无尾 1一尾鱼翘楚 2两尾鱼(绝世) 3三尾鱼(传说)
    nextGuestPicks: [],      // 邀客点将：玩家钦点明日必到的客人 id 列表(最多 GUESTS_PER_DAY 个)，nextDay 消费后清空
    explicitPickCount: 0,    // 今日客位里有几个是玩家钦点的（供 applyRival 判断该不该抢第2个客位）
  };
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
// skills 可传：默认师兄 st.skills；苏唐掌勺时传 st.suSkills
export function computeBaseScore(st, d, skills) {
  const sk = skills || st.skills || {};
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

// 苏唐小吃独立评分：品质为底 + 味型对客人口味 +10（小吃都是苏唐做的）
export function snackScoreOf(snack, guest) {
  let s = snack?.quality ?? 60;
  if (snack?.flavor && snack.flavor === guest?.flavor) s += 10;
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
  return findKnownGuest(st, st.guests[st.served]);
}

// ── 踢馆·八条线各自独立进度（互不干扰，可分别挑战）──────────────────
// id 形如 rival_${schoolIdx}_${levelIdx}，自描述、不用另存指针，随时能反推回具体挑战者。
export function rivalLineDone(st, schoolIdx) {
  return ((st.rivalStages || [])[schoolIdx] ?? 0) >= RIVAL_LEVELS.length;
}
// 某条线当前该来的挑战者；该线已全通则返回 null
export function rivalGuestForSchool(st, schoolIdx) {
  if (rivalLineDone(st, schoolIdx)) return null;
  const level = (st.rivalStages || [])[schoolIdx] || 0;
  return rivalGuestAt(schoolIdx, level);
}
// 挑过一级，该线（仅该线）往前推一档；满档（超过总厨）即该线全通；八线全通则 rivalDone
export function rivalStageNext(st, schoolIdx) {
  st.rivalStages = st.rivalStages || RIVAL_SCHOOLS.map(() => 0);
  if (st.rivalStages[schoolIdx] < RIVAL_LEVELS.length) st.rivalStages[schoolIdx] += 1;
  if (RIVAL_SCHOOLS.every((_, i) => rivalLineDone(st, i))) st.rivalDone = true;
  return st.rivalStages[schoolIdx];
}

// ── 认人：预设/AI动态客人，或踢馆 id 反推挑战者（不需要认识，随时能邀）──
export function findKnownGuest(st, id) {
  if (id && /^rival_\d+_\d+$/.test(id)) {
    const [, s, l] = id.match(/^rival_(\d+)_(\d+)$/);
    return rivalGuestAt(parseInt(s, 10), parseInt(l, 10));
  }
  return GUESTS.find(g => g.id === id) || (st.customGuests || []).find(g => g.id === id) || null;
}
// ── 邀请候选：所有认识的女性（预设女客 + 女厨/女新客等动态客人），好感>15 ──
export function inviteCandidates(st) {
  const known = [...GUESTS, ...(st.customGuests || [])];
  return known.filter(g => (FEMALE_GUEST_IDS.has(g.id) || g.gender === "女") && (st.aff[g.id] || 0) > 15);
}
// 邀客·点将明日：玩家钦点（最多 GUESTS_PER_DAY 位），不管认不认得、平日在哪、是不是踢馆同行，
// 明天准来，各占一个客位；其余客位照常随机。
export function nextDay(st) {
  st.day += 1;
  st.served = 0;
  st.phase = "guest";
  let guests = guestsOfDay(st.day, st.customGuests);
  const picks = (st.nextGuestPicks || []).slice(0, GUESTS_PER_DAY);
  st.nextGuestPicks = [];
  st.explicitPickCount = 0;
  if (picks.length) {
    const pickedGuests = picks.map(id => findKnownGuest(st, id)).filter(Boolean);
    const pickedIds = new Set(pickedGuests.map(g => g.id));
    guests = [...pickedGuests, ...guests.filter(g => !pickedIds.has(g.id))].slice(0, GUESTS_PER_DAY);
    st.explicitPickCount = pickedGuests.length;
  }
  st.guests = guests.map(g => g.id);
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

// ── 骰子检定 · 熟能生巧（见识/口才/赌博）──────────────────────────────
// 成功率 = 基础30% + 成功次数×5%（封顶90%）；达成成就再永久 +50%（硬顶95%）。
// 学 Roadwarden：鱼抓得多→「老手」，赌赢得多→「掌握规则」——成功即熟练。
export const CHECK_DIMS = ["见识", "口才", "赌博"];
// 属性维度：按 st.skills 数值判定（不计数、不走成就）
export const ATTR_DIMS = ["轻功", "投掷", "武艺", "内功", "胆识"];
export const ACHIEVE_DEFS = {
  见识: { name: "识货", desc: "看得多了，瞒不过你的眼。此后见识检定成功率永久 +50%。" },
  口才: { name: "巧舌", desc: "话说得多了，愈发灵光。此后口才检定成功率永久 +50%。" },
  赌博: { name: "坐庄", desc: "赢多了，手气自然旺。此后赌博检定成功率永久 +50%。" },
};
export const CHECK_BASE = 30, CHECK_PER = 5, CHECK_CAP = 90, ACHIEVE_N = 4, ACHIEVE_BONUS = 50, CHECK_HARD_CAP = 95;

export function checkChance(st, dim) {
  const c = (st.checks || {})[dim] || {};
  let p = CHECK_BASE + (c.succ || 0) * CHECK_PER;
  if (p > CHECK_CAP) p = CHECK_CAP;
  if (c.achieve) p += ACHIEVE_BONUS;
  return Math.min(CHECK_HARD_CAP, p);
}

// 掷骰：返回 { ok, p, achieve }，achieve=true 表示本次刚达成成就
export function rollCheck(st, dim) {
  st.checks = st.checks || {};
  st.checks[dim] = st.checks[dim] || { succ: 0, achieve: false };
  const c = st.checks[dim];
  const p = checkChance(st, dim);
  const ok = Math.random() * 100 < p;
  let achieve = false;
  if (ok) {
    c.succ += 1;
    if (!c.achieve && c.succ >= ACHIEVE_N) { c.achieve = true; achieve = true; }
  }
  return { ok, p, achieve };
}

// 熟练等级语言（学 Roadwarden 的「老手/掌握规则」）：成就=化境
export function rankLabel(succ, achieve) {
  if (achieve) return "化境";
  if (succ >= 8) return "宗师";
  if (succ >= 4) return "老手";
  if (succ >= 2) return "渐熟";
  if (succ >= 1) return "入门";
  return "生手";
}

// ── 食评人余味 · 鱼尾评级 ────────────────────────────────────────────
// 一尾鱼=翘楚；两尾鱼=绝世（全天下只有锦官城两家/拉萨一家/打箭炉一家）；三尾鱼=传说（从没听说过）
// 每晋升一档，余味送出一支银簪；档位即所持银簪数，一支银簪=一星米其林（星级店誉影响 NPC 言行）
export const RYUWEI_TIERS = [
  { tier: 0, name: "无名小馆", need: 0 },
  { tier: 1, name: "一尾鱼·翘楚", need: 150 },
  { tier: 2, name: "两尾鱼·绝世", need: 400 },
  { tier: 3, name: "三尾鱼·传说", need: 1200 },
];
export function ryuweiTierName(st) {
  const t = (st.ryuweiRating || {}).tier ?? 0;
  return (RYUWEI_TIERS[t] || RYUWEI_TIERS[0]).name;
}
// 余味吃完按评分给评级点；够档则晋升一档，返回新档
export function ryuweiGain(st, score) {
  st.ryuweiRating = st.ryuweiRating || { pts: 0, tier: 0 };
  if (score >= 60) st.ryuweiRating.pts += Math.round((score - 50) / 5); // 60→2 … 100→10
  const cur = st.ryuweiRating.tier;
  const next = RYUWEI_TIERS.findLast(t => st.ryuweiRating.pts >= t.need)?.tier ?? cur;
  st.ryuweiRating.tier = Math.max(cur, next);
  return st.ryuweiRating.tier > cur ? st.ryuweiRating.tier : 0; // 晋升返回新档，否则 0
}

// ── 通用维度检定：骰子维度走熟练度（计数/成就），属性维度走 skills ───
// 武艺取刀/剑/拳/枪最高者；胆识取七艺均值兜底；其余直接查 st.skills
export function skillValueOf(st, dim) {
  const sk = st.skills || {};
  if (dim === "武艺") return Math.max(sk["刀法"] || 0, sk["剑法"] || 0, sk["拳掌"] || 0, sk["枪法"] || 0);
  if (dim === "胆识") { const v = Object.values(sk); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 30; }
  return sk[dim] || 30;
}
export function checkDim(st, dim) {
  if (CHECK_DIMS.includes(dim)) return rollCheck(st, dim); // 骰子：成功计数，4次成就要+50%
  const p = Math.min(95, Math.max(5, skillValueOf(st, dim)));
  const ok = Math.random() * 100 < p;
  return { ok, p, achieve: false };
}

// ── 技法/味型 · 练功可学（用前置技法/味型 N 次解锁进阶）──────────────
export function registerUse(st, techId, flavorId) {
  st.techUses = st.techUses || {};
  st.flavorUses = st.flavorUses || {};
  if (techId) st.techUses[techId] = (st.techUses[techId] || 0) + 1;
  if (flavorId) st.flavorUses[flavorId] = (st.flavorUses[flavorId] || 0) + 1;
}
// 返回已达门槛、尚未学会的技法/味型
export function unlockProgress(st) {
  const tu = st.techUses || {}, fu = st.flavorUses || {};
  const tech = Object.values(TECHNIQUES)
    .filter(t => t.from && !(st.techs || []).includes(t.id))
    .filter(t => (tu[t.from] || 0) >= t.need)
    .map(t => ({ id: t.id, from: t.from, used: tu[t.from] || 0, need: t.need }));
  const flavor = Object.values(FLAVOR_BY_ID)
    .filter(f => f.from && !(st.flavors || []).includes(f.id))
    .filter(f => (fu[f.from] || 0) >= f.need)
    .map(f => ({ id: f.id, from: f.from, used: fu[f.from] || 0, need: f.need }));
  return { tech, flavor };
}
export function applyUnlocks(st, prog) {
  const got = [];
  for (const t of (prog.tech || [])) if (!st.techs.includes(t.id)) { st.techs.push(t.id); got.push(t.id); }
  for (const f of (prog.flavor || [])) if (!st.flavors.includes(f.id)) { st.flavors.push(f.id); got.push(f.id); }
  return got;
}

// ── 商店 · 一键备菜：在架食材每样都来 1 份（不管有没有）──────────────
export function buyAllIngredients(st) {
  const want = shopIngOf(st)
    .map(n => ({ name: n, price: ING_BY_NAME[n]?.price || 0 }));
  if (!want.length) return { ok: true, total: 0, count: 0, bought: [] };
  const total = want.reduce((a, b) => a + b.price, 0);
  if (st.coins < total) return { ok: false, warn: `备一套需 ${total} 文，还差 ${total - st.coins} 文。` };
  st.coins -= total;
  for (const x of want) st.inv[x.name] = (st.inv[x.name] || 0) + 1;
  return { ok: true, total, count: want.length, bought: want.map(x => x.name) };
}
