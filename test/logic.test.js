import test from "node:test";
import assert from "node:assert/strict";
import {
  newState, guestsOfDay, matchRecipe, judgeStove, scoreDish, tierOf, payOf,
  shopStock, buyItem, nextDay, currentGuest, GUESTS_PER_DAY,
  applyMartialExp, computeBaseScore, refreshShop, shopIngOf, applySuExp,
  checkChance, rollCheck, rankLabel, checkDim, skillValueOf, ACHIEVE_DEFS, ACHIEVE_N, ATTR_DIMS, CHECK_DIMS,
  registerUse, unlockProgress, applyUnlocks, buyAllIngredients, rivalStageNext,
} from "../src/state.js";
import { RECIPES, GUESTS, FLAVOR_BY_ID, ING_BY_NAME, INGREDIENTS, TECHNIQUES, FLAVORS, rivalGuestAt, FEMALE_GUEST_IDS } from "../src/data.js";
import {
  normalizeEndpoint, parseJSONRescue, fallbackDishName,
  parseDishText, parseSayText, baseForModels, extractComment, fallbackDish,
  moodIndex, splitSayMood, parseMartial, extractFace, POSE_INDEX,
} from "../src/ai.js";

test("guestsOfDay：3 位不重复，同一天确定", () => {
  const a = guestsOfDay(3), b = guestsOfDay(3);
  assert.equal(a.length, GUESTS_PER_DAY);
  assert.deepEqual(a.map(g => g.id), b.map(g => g.id));
  assert.equal(new Set(a.map(g => g.id)).size, 3);
  for (const g of a) assert.ok(GUESTS.some(x => x.id === g.id));
});

test("matchRecipe：冷锅鱼命中 / 技法错不中", () => {
  const mats = ["青衣江团鱼", "熊山花椒", "雅江菜籽油"];
  assert.equal(matchRecipe(mats, "炒").name, "冷锅鱼");
  assert.equal(matchRecipe(mats, "炖"), null);
  assert.equal(matchRecipe([...mats].reverse(), "炒").name, "冷锅鱼");
  assert.equal(matchRecipe([], "炖"), null);
});

test("judgeStove：空槽/蒸无笼/妙手/味型核心调料", () => {
  const st = newState();
  assert.equal(judgeStove(st, [null, null, null, null], "炖", "jiutieguo", null).ok, false);
  assert.equal(judgeStove(st, ["雪山雪鸡肉"], "蒸", "jiutieguo", null).ok, false);
  const free = judgeStove(st, ["玉泉寨土豆"], "炖", "jiutieguo", null);
  assert.equal(free.ok, true);
  assert.equal(free.freestyle, true);

  st.inv["熊山花椒"] = 1;
  const noUnlock = judgeStove(st, ["熊山花椒", "牦牛腱子肉"], "炖", "jiutieguo", "mala");
  assert.equal(noUnlock.ok, true);
  assert.equal(noUnlock.flavorId, null, "未学味型不算");

  st.flavors.push("mala");
  st.techs.push("炒");
  const un = judgeStove(st, ["熊山花椒", "牦牛腱子肉"], "炒", "jiutieguo", "mala");
  assert.equal(un.flavorId, "mala");
});

test("scoreDish：全对封顶 100，pay 至少 1", () => {
  const st = newState();
  st.flavors.push("mala"); st.techs.push("炒");
  const j = judgeStove(st, ["青衣江团鱼", "熊山花椒", "雅江菜籽油"], "炒", "jiutieguo", "mala");
  const dish = { materials: j.materials, technique: "炒", flavorId: j.flavorId, baseScore: 80 };
  const g = GUESTS.find(x => x.id === "qingyilou");
  const score = scoreDish(dish, g);
  assert.equal(score, 100); // 80 + 味型10 + 技法4 + 兴趣6
  assert.ok(payOf(g, score) >= 1);
  assert.equal(tierOf(100), 0);
  assert.equal(tierOf(44), 3);
});

test("武学：练功加经验、基础分组合", () => {
  const st = newState();
  const got = applyMartialExp(st, ["刀法", "拳掌"], true, 3);
  assert.deepEqual(got, ["刀法", "拳掌", "内功"]);
  assert.equal(st.skills["刀法"], 13);
  assert.equal(st.skills["内功"], 13);
  const b = computeBaseScore(st, { technique: "炒", cookware: { quality: "白" }, synergy: 80, external: ["刀法", "拳掌"] });
  assert.ok(b >= 0 && b <= 100);
  // 外功13*0.3 + 内功13*0.2 + 炒55*0.2 + 配合80*0.2 + 炊具0 = 3.9+2.6+11+16 = 33.5 → 34
  assert.equal(b, 34);
});

test("parseMartial：过滤非法外功、夹取 synergy", () => {
  const o = parseMartial('{"external":["刀法","野球拳","轻功"],"internal":true,"synergy":150}');
  assert.deepEqual(o.external, ["刀法", "轻功"]);
  assert.equal(o.internal, true);
  assert.equal(o.synergy, 100);
  assert.equal(parseMartial('{"external":[],"internal":false}'), null);
});

test("商店：买不起/买技/买食材/炊具不重复", () => {
  const st = newState();
  st.coins = 5;
  assert.equal(buyItem(st, "cookware", "chaoguo").ok, false);
  st.coins = 20;
  assert.equal(buyItem(st, "tech", "烤").ok, true);
  assert.ok(st.techs.includes("烤"));
  assert.equal(buyItem(st, "tech", "烤").ok, false, "不能重复买");
  assert.ok(!st.techs.includes("卤"), "卤是后期学，未买不该有");
  const before = st.inv["贡措海盐"] || 0;
  assert.equal(buyItem(st, "ingredient", "贡措海盐").ok, true);
  assert.equal(st.inv["贡措海盐"], before + 1);
  assert.ok(shopStock(st).cookware.find(c => c.id === "jiutieguo") === undefined, "默认锅不上架");
});

test("商店刷新：常备总在架", () => {
  const st = newState();
  assert.ok(shopIngOf(st).includes("贡措海盐"));
  refreshShop(st);
  assert.ok(shopIngOf(st).includes("贡措海盐"), "刷新后常备仍在架");
  assert.ok(shopIngOf(st).length >= 8);
});

test("苏唐练功：小吃经验给她", () => {
  const st = newState();
  const got = applySuExp(st, 3);
  assert.ok(got.includes("内功"));
  assert.equal(st.suSkills["内功"], 18);
});

test("日循环：三客后收功，nextDay 复位", () => {
  const st = newState();
  st.served = 3;
  st.phase = "closing";
  nextDay(st);
  assert.equal(st.day, 2);
  assert.equal(st.served, 0);
  assert.equal(st.phase, "guest");
  assert.ok(currentGuest(st));
});

test("配方用料都在食材表里", () => {
  for (const r of RECIPES) for (const m of r.materials) {
    assert.ok(ING_BY_NAME[m], `${r.name} 的用料 ${m} 不在食材表`);
  }
  for (const f of Object.values(FLAVOR_BY_ID)) for (const req of f.requires) {
    assert.ok(ING_BY_NAME[req], `味型 ${f.name} 的核心调料 ${req} 不在食材表`);
  }
  for (const g of GUESTS) {
    assert.ok(FLAVOR_BY_ID[g.flavor], `客人 ${g.name} 的味型未定义`);
    assert.ok(ING_BY_NAME[g.fav], `客人 ${g.name} 的兴趣食材不在食材表`);
  }
});

test("normalizeEndpoint / parseJSONRescue", () => {
  assert.equal(normalizeEndpoint("https://api.deepseek.com"),
    "https://api.deepseek.com/v1/chat/completions");
  assert.equal(normalizeEndpoint("https://x.com/v1"), "https://x.com/v1/chat/completions");
  assert.equal(normalizeEndpoint("https://x.com/v1/chat/completions"), "https://x.com/v1/chat/completions");
  assert.equal(normalizeEndpoint(""), "https://api.openai.com/v1/chat/completions");

  const a = parseJSONRescue('```json\n{"name":"冷锅鱼","prose":"香。"}\n```');
  assert.equal(a.name, "冷锅鱼");
  const b = parseJSONRescue('废话前缀 {"name":"x","prose":"y"} 尾巴');
  assert.equal(b.prose, "y");
  const c = parseJSONRescue('{"name":"截断","prose":"没写完');
  assert.equal(c.name, "截断");
});

test("parseDishText：流式纯文本格式 / JSON 兜底 / 空文本", () => {
  const ctx = { materials: ["牦牛腱子肉"], technique: "炖" };
  const a = parseDishText("菜名：「牦牛骨汤」\n骨髓熬化了，汤白得像奶。", ctx);
  assert.equal(a.name, "牦牛骨汤");
  assert.ok(a.prose.startsWith("骨髓"));
  const b = parseDishText('菜名：即兴\n正文：香。', ctx);
  assert.equal(b.name, "即兴");
  assert.equal(b.prose, "香。");
  const c = parseDishText('{"name":"x","prose":"y"}', ctx);
  assert.equal(c.prose, "y");
  assert.equal(parseDishText("", ctx), null);
  assert.equal(parseDishText("菜名：只有名字没有正文", ctx), null);
});

test("extractComment / 苏唐批 + 心情进解析", () => {
  const a = extractComment("正文一二三。\n苏唐批：咸了半口。\n心情：不满");
  assert.equal(a.main, "正文一二三。");
  assert.equal(a.comment, "咸了半口。");
  assert.equal(a.mood, "不满");
  assert.equal(extractComment("没有批语").comment, "");
  assert.equal(extractComment("没有批语").mood, "");

  const d = parseDishText("菜名：「牦牛骨汤」\n汤白得像奶。\n苏唐批：今日算过关。\n心情：开心", {});
  assert.equal(d.name, "牦牛骨汤");
  assert.equal(d.prose, "汤白得像奶。");
  assert.equal(d.comment, "今日算过关。");
  assert.equal(d.mood, 0);

  const f = fallbackDish({ materials: ["玉泉寨土豆"], technique: "炖", cookware: { name: "溪边旧铁锅", desc: "" } });
  assert.ok(f.comment, "降级模板也要有苏唐批");
  assert.ok(Number.isInteger(f.mood) && f.mood >= 0 && f.mood < 8);
});

test("moodIndex / splitSayMood", () => {
  assert.equal(moodIndex("开心"), 0);
  assert.equal(moodIndex("专注"), 7);
  assert.equal(moodIndex("高兴"), 0, "近义词兜底");
  assert.equal(moodIndex(""), null);
  const r = splitSayMood("「好手艺！」\n心情：兴奋");
  assert.equal(r.say, "好手艺！");
  assert.equal(r.mood, "兴奋");
});

test("parseSayText：去前缀引号 / JSON 兜底", () => {
  assert.equal(parseSayText("「好手艺！」"), "好手艺！");
  assert.equal(parseSayText("客人：好手艺！\n多余行"), "好手艺！");
  assert.equal(parseSayText('{"say":"嗯"}'), "嗯");
  assert.equal(parseSayText("  "), null);
});

test("baseForModels：砍尾巴 / 裸域名补 v1", () => {
  assert.equal(baseForModels("https://api.deepseek.com/v1/chat/completions"),
    "https://api.deepseek.com/v1");
  assert.equal(baseForModels("https://api.deepseek.com"), "https://api.deepseek.com/v1");
  assert.equal(baseForModels("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.equal(baseForModels(""), "https://api.openai.com/v1");
});

test("fallbackDishName：配方名优先 / 自由组合拼名", () => {
  assert.equal(fallbackDishName({ recipeName: "冷锅鱼", materials: [], technique: "炒" }), "冷锅鱼");
  const n = fallbackDishName({ materials: ["牦牛腱子肉", "贡措海盐"], technique: "炖", flavorId: "xianxiang" });
  assert.ok(n.includes("炖") && n.includes("牦牛腱子肉"));
});

test("checkChance：熟能生巧曲线（基础30，成功+5，封顶90，成就+50）", () => {
  const st = newState();
  assert.equal(checkChance(st, "见识"), 30);
  st.checks["见识"].succ = 5;
  assert.equal(checkChance(st, "见识"), 55);
  st.checks["见识"].succ = 50;
  assert.equal(checkChance(st, "见识"), 90, "无成就封顶90");
  st.checks["见识"].achieve = true;
  assert.equal(checkChance(st, "见识"), 95, "成就+50后硬顶95");
  st.checks["赌博"].achieve = true;
  st.checks["赌博"].succ = 0;
  assert.equal(checkChance(st, "赌博"), 80, "成就+50叠加基础30");
});

test("rollCheck：成功累计，4次得成就并标记", () => {
  const st = newState();
  const seedRand = () => { let s = 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
  const rnd = seedRand();
  const orig = Math.random;
  Math.random = rnd; // 固定序列
  try {
    let got = null;
    for (let i = 0; i < 30 && !got?.achieve; i++) got = rollCheck(st, "口才");
    assert.ok(got.achieve, "30次内应达成成就（成功4次）");
    assert.equal(st.checks["口才"].achieve, true);
    assert.ok(checkChance(st, "口才") >= 80, "成就后成功率大幅提升");
  } finally { Math.random = orig; }
});

test("rankLabel：生手→入门→渐熟→老手→宗师→化境", () => {
  assert.equal(rankLabel(0, false), "生手");
  assert.equal(rankLabel(1, false), "入门");
  assert.equal(rankLabel(2, false), "渐熟");
  assert.equal(rankLabel(4, false), "老手");
  assert.equal(rankLabel(8, false), "宗师");
  assert.equal(rankLabel(0, true), "化境");
  assert.ok(ACHIEVE_DEFS.见识.name && ACHIEVE_DEFS.口才.name && ACHIEVE_DEFS.赌博.name);
  assert.equal(ACHIEVE_N, 4);
});

test("skillValueOf：武艺取刀剑拳枪最高 / 胆识取均值 / 直查 skills", () => {
  const st = newState();
  st.skills = { 刀法: 10, 剑法: 40, 拳掌: 20, 枪法: 30, 轻功: 55, 投掷: 60, 内功: 70 };
  assert.equal(skillValueOf(st, "武艺"), 40, "取最高");
  assert.equal(skillValueOf(st, "轻功"), 55);
  assert.equal(skillValueOf(st, "内功"), 70);
  assert.equal(skillValueOf(st, "胆识"), Math.round((10 + 40 + 20 + 30 + 55 + 60 + 70) / 7), "均值");
  assert.equal(skillValueOf(st, "不存在的维度"), 30, "缺省30");
});

test("checkDim：骰子维度计数走成就 / 属性维度走 skills 不计数", () => {
  const st = newState();
  st.skills = { 刀法: 10, 剑法: 10, 拳掌: 10, 枪法: 10, 轻功: 10, 投掷: 10, 内功: 10 };
  const r1 = checkDim(st, "轻功");
  assert.equal(typeof r1.ok, "boolean");
  assert.ok(ATTR_DIMS.includes("轻功") && !CHECK_DIMS.includes("轻功"));
  assert.equal(st.checks["轻功"], undefined, "属性维度不计数");
  const r2 = checkDim(st, "见识");
  assert.ok(CHECK_DIMS.includes("见识"));
  assert.equal(st.checks["见识"].succ, r2.ok ? 1 : 0, "骰子维度成功才计数");
});

test("技法/味型练功解锁：炒3次顿悟炝，红油需麻辣3次", () => {
  const st = newState();
  for (let i = 0; i < 3; i++) registerUse(st, "炒", "xianxiang");
  const p = unlockProgress(st);
  assert.ok(p.tech.some(t => t.id === "炝"), "炒3次应解锁炝");
  assert.ok(!p.flavor.some(f => f.id === "hongyou"), "红油需麻辣3次，还没用到麻辣");
  const got = applyUnlocks(st, p);
  assert.ok(st.techs.includes("炝"));
  for (let i = 0; i < 3; i++) registerUse(st, "炖", "mala");
  const p2 = unlockProgress(st);
  assert.ok(p2.flavor.some(f => f.id === "hongyou"));
  assert.ok(p2.tech.some(t => t.id === "煨"));
});

test("新技法/味型数据自洽：from/need 存在，requires 调料都在食材表", () => {
  const ingNames = new Set(INGREDIENTS.map(i => i.name));
  for (const t of Object.values(TECHNIQUES)) {
    if (t.from) assert.ok(TECHNIQUES[t.from], `技法 ${t.id} 的前置 ${t.from} 必须存在`);
    assert.ok(typeof t.needsSteamer === "boolean");
  }
  for (const f of FLAVORS) {
    if (f.from) assert.ok(FLAVOR_BY_ID[f.from], `味型 ${f.id} 的前置 ${f.from} 必须存在`);
    for (const req of f.requires) assert.ok(ingNames.has(req), `味型 ${f.name} 核心调料 ${req} 必须在食材表`);
  }
});

test("一键备菜：钱够全买，不够提示差额", () => {
  const st = newState();
  st.coins = 1000;
  const r = buyAllIngredients(st);
  assert.equal(r.ok, true);
  assert.ok(r.count > 0 && r.total > 0);
  const st2 = newState();
  st2.coins = 0;
  const r2 = buyAllIngredients(st2);
  assert.equal(r2.ok, false);
  assert.ok(r2.warn.includes("差"));
});

test("guestsOfDay：苏酥首客加权（长样本在合理区间）", () => {
  let su = 0, N = 3000;
  for (let d = 1; d <= N; d++) if (guestsOfDay(d)[0]?.id === "susu") su++;
  const pct = su / N;
  assert.ok(pct > 0.28 && pct < 0.42, `苏酥首客率应在 ~35% 附近，实测 ${(pct * 100).toFixed(1)}%`);
});

test("踢馆梯度：八大菜系×5档动态生成，req 递增，数据自洽", () => {
  for (let d = 1; d <= 500; d++)
    for (const g of guestsOfDay(d)) assert.ok(!g.rival, "普通抽取不能抽到踢馆同行");
  const schoolIdx = [0, 7], levelIdx = [0, 4];
  for (const si of schoolIdx) for (const li of levelIdx) {
    const r = rivalGuestAt(si, li);
    assert.ok(r.req >= 65 && r.req <= 95, "阈值在梯度区间");
    assert.ok(FLAVOR_BY_ID[r.flavor], `味型 ${r.flavor} 必须存在`);
    assert.ok(TECHNIQUES[r.tech], `技法 ${r.tech} 必须存在`);
  }
  assert.ok(rivalGuestAt(0, 0).req < rivalGuestAt(0, 4).req, "总厨比喽啰难");
});

test("踢馆女厨：40位黑白格20女20男，女厨各有美名", () => {
  let f = 0, m = 0;
  for (let si = 0; si < 8; si++) for (let li = 0; li < 5; li++) {
    const r = rivalGuestAt(si, li);
    r.gender === "女" ? f++ : m++;
    if (r.gender === "女") assert.ok(!r.name.includes("·"), `女厨应有像样名字，实测 ${r.name}`);
  }
  assert.equal(f, 20, "正好 20 位女厨");
  assert.equal(m, 20, "正好 20 位男厨");
  assert.ok(rivalGuestAt(2, 4).name, "粤菜总厨应是女厨美名");
});

test("女厨体貌：所有女厨 body 都含「美若天仙」，男厨不配", () => {
  for (let si = 0; si < 8; si++) for (let li = 0; li < 5; li++) {
    const r = rivalGuestAt(si, li);
    if (r.gender === "女") assert.ok(r.body && r.body.includes("美若天仙"), `${r.name} 的体貌须含美若天仙`);
    if (r.gender === "男") assert.equal(r.body, undefined, "男厨不配体貌描述");
  }
});

test("踢馆进度：挑过一级推一档，满档换菜系，全通 rivalDone", () => {
  const st = newState();
  const stg = st.rivalStage;
  rivalStageNext(st);
  assert.equal(st.rivalStage.level, 1, "喽啰→少主");
  st.rivalStage = { school: 0, level: 4 };
  rivalStageNext(st);
  assert.equal(st.rivalStage.school, 1, "总厨挑过→换菜系");
  assert.equal(st.rivalStage.level, 0);
  st.rivalStage = { school: 7, level: 4 };
  rivalStageNext(st);
  assert.equal(st.rivalDone, true, "八大菜系全通");
});

test("女性客人标记：FEMALE_GUEST_IDS 都是有效 guest id，且含苏酥", () => {
  const ids = new Set(GUESTS.map(g => g.id));
  assert.ok(FEMALE_GUEST_IDS.size >= 8, "至少 8 位女客可被邀请");
  for (const id of FEMALE_GUEST_IDS) assert.ok(ids.has(id), `女客 ${id} 必须存在于 GUESTS`);
  assert.ok(FEMALE_GUEST_IDS.has("susu"), "苏酥可被邀请");
});

test("newState：带星食材描述落盘字段 starLore 就位", () => {
  const st = newState();
  assert.deepEqual(st.starLore, {}, "新档 starLore 为空对象，探秘收获时写入");
});

test("NSFW表情按情节匹配：extractFace/POSE_INDEX", () => {
  assert.equal(POSE_INDEX["脸红出汗"], 0);
  assert.equal(POSE_INDEX["娇羞比耶"], 7);
  assert.equal(extractFace("正文……\n表情：微微翻白眼"), "微微翻白眼");
  assert.equal(extractFace("正文……\n表情：平常"), "平常");
  assert.equal(extractFace("正文……"), "");
  assert.equal(Number.isInteger(POSE_INDEX[extractFace("表情：平常")]), false, "「平常」不触发 NSFW 表情");
  assert.equal(Number.isInteger(POSE_INDEX[extractFace("表情：wink")]), true, "「wink」触发");
});
