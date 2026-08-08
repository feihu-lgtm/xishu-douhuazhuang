import test from "node:test";
import assert from "node:assert/strict";
import {
  newState, guestsOfDay, matchRecipe, judgeStove, scoreDish, tierOf, payOf,
  shopStock, buyItem, nextDay, currentGuest, GUESTS_PER_DAY,
  applyMartialExp, computeBaseScore, refreshShop, shopIngOf, applySuExp,
  checkChance, rollCheck, rankLabel, checkDim, skillValueOf, ACHIEVE_DEFS, ACHIEVE_N, ATTR_DIMS, CHECK_DIMS,
  registerUse, unlockProgress, applyUnlocks, buyAllIngredients, rivalStageNext, rivalLineDone, rivalGuestForSchool, inviteCandidates, findKnownGuest, snackScoreOf, ryuweiGain, ryuweiTierName, pickNarrativeRescue,
} from "../src/state.js";
import {
  RECIPES, GUESTS, FLAVOR_BY_ID, ING_BY_NAME, INGREDIENTS, TECHNIQUES, FLAVORS, rivalGuestAt, FEMALE_GUEST_IDS,
  WEEK_CALENDAR, EXPEDITION_MAP, weekCalOf, weekLabel, currentJieqiName, calendarContextFor,
  EXP_SCEN_BY_CAT, RESCUE_SCENARIOS,
} from "../src/data.js";
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

test("专练技法：片/串/颠 分别专练 剑法/枪法/投掷", () => {
  const train = Object.fromEntries(Object.values(TECHNIQUES).filter(x => x.train).map(x => [x.id, x.train]));
  assert.equal(train["片"], "剑法");
  assert.equal(train["串"], "枪法");
  assert.equal(train["颠"], "投掷");
});

test("余味鱼尾评级：大阵仗四样总分直接定星（75/85/95 → 1/2/3星），只升不降", () => {
  const st = newState();
  assert.equal(ryuweiTierName(st), "无名小馆");
  assert.equal(ryuweiGain(st, 50), 0, "低分不定星");
  assert.equal(ryuweiGain(st, 80), 1, "≥75 一星");
  assert.equal(ryuweiTierName(st), "一尾鱼·翘楚");
  assert.equal(ryuweiGain(st, 70), 0, "掉分不降星");
  assert.equal(st.ryuweiRating.tier, 1, "星只升不降");
  assert.equal(ryuweiGain(st, 90), 2, "≥85 两星");
  assert.equal(ryuweiGain(st, 96), 3, "≥95 三星");
  assert.equal(ryuweiTierName(st), "三尾鱼·传说");
});

test("小吃独立评分：品质为底，味型对上+10", () => {
  const g = { flavor: "mala" };
  assert.equal(snackScoreOf({ quality: 70, flavor: "mala" }, g), 80, "味型对上+10");
  assert.equal(snackScoreOf({ quality: 50, flavor: "tian" }, g), 50, "味型不对不加");
  assert.equal(snackScoreOf(null, g), 60, "无记录默认60");
});

test("女厨体貌：所有女厨 body 都含「美若天仙」，男厨不配", () => {
  for (let si = 0; si < 8; si++) for (let li = 0; li < 5; li++) {
    const r = rivalGuestAt(si, li);
    if (r.gender === "女") assert.ok(r.body && r.body.includes("美若天仙"), `${r.name} 的体貌须含美若天仙`);
    if (r.gender === "男") assert.equal(r.body, undefined, "男厨不配体貌描述");
  }
});

test("踢馆进度：八线各自独立，挑过一级只推该线，不影响其他线", () => {
  const st = newState();
  assert.equal(st.rivalStages.length, 8, "开局八条线各自档位0");
  rivalStageNext(st, 0);
  assert.equal(st.rivalStages[0], 1, "0号线喽啰→少主");
  assert.equal(st.rivalStages[1], 0, "1号线没动过，仍是喽啰");
  rivalStageNext(st, 3);
  assert.equal(st.rivalStages[3], 1, "3号线也能独立推进，互不干扰");
  assert.equal(st.rivalStages[0], 1, "0号线不受3号线影响");
});

test("踢馆·单线全通：总厨挑过该线标记完成，不影响其余线", () => {
  const st = newState();
  st.rivalStages[2] = 4; // 2号线卡在总厨
  rivalStageNext(st, 2);
  assert.equal(rivalLineDone(st, 2), true, "2号线总厨挑过即全通");
  assert.equal(rivalLineDone(st, 3), false, "3号线未动，不受影响");
  assert.equal(rivalGuestForSchool(st, 2), null, "已全通的线拿不到挑战者");
  assert.ok(rivalGuestForSchool(st, 3), "未全通的线正常给挑战者");
  assert.equal(st.rivalDone, false, "只有一条线全通，八线还没全通");
});

test("踢馆·八线全通才 rivalDone", () => {
  const st = newState();
  for (let i = 0; i < 8; i++) { st.rivalStages[i] = 4; rivalStageNext(st, i); }
  assert.equal(st.rivalDone, true, "八条线全部挑到总厨，才算全通");
});

test("女性客人标记：FEMALE_GUEST_IDS 都是有效 guest id，且含苏酥", () => {
  const ids = new Set(GUESTS.map(g => g.id));
  assert.ok(FEMALE_GUEST_IDS.size >= 8, "至少 8 位女客可被邀请");
  for (const id of FEMALE_GUEST_IDS) assert.ok(ids.has(id), `女客 ${id} 必须存在于 GUESTS`);
  assert.ok(FEMALE_GUEST_IDS.has("susu"), "苏酥可被邀请");
  for (const id of ["lanjie", "luosha", "liruoyou"]) assert.ok(FEMALE_GUEST_IDS.has(id), `${id} 可被邀请`);
});

test("邀请候选：所有认识的女性好感>15（含女厨/动态女客），好感不足排除", () => {
  const st = newState();
  st.aff["caidan"] = 30;
  const nv = rivalGuestAt(2, 4); // 云锦·女厨
  st.customGuests.push(nv);
  st.aff[nv.id] = 18;
  const low = rivalGuestAt(3, 1); // 烟雨·女厨
  st.customGuests.push(low);
  st.aff[low.id] = 10;
  const cands = inviteCandidates(st);
  assert.ok(cands.some(g => g.id === "caidan"), "预设女客可邀");
  assert.ok(cands.some(g => g.id === nv.id), "女厨可邀");
  assert.ok(!cands.some(g => g.id === low.id), "好感不足不出现");
  assert.equal(findKnownGuest(st, nv.id).name, nv.name, "女厨也能被找到");
});

test("newState：带星食材描述落盘字段 starLore 就位", () => {
  const st = newState();
  assert.deepEqual(st.starLore, {}, "新档 starLore 为空对象，探秘收获时写入");
  assert.equal(st.pendingGifts, null, "收功后台备好的明日送礼初始为空");
  assert.deepEqual(st.guestMemories, {}, "per-guest 隔离记忆初始为空");
});

test("周历：52周整，strong分类都是 EXPEDITION_MAP 里真实存在的据点分类", () => {
  assert.equal(WEEK_CALENDAR.length, 52);
  const validCats = new Set(EXPEDITION_MAP.map(n => n.category));
  for (const [i, e] of WEEK_CALENDAR.entries()) {
    assert.ok(e.month >= 1 && e.month <= 12, `week${i + 1} month 越界`);
    assert.ok(["初", "上", "下", "末"].includes(e.part), `week${i + 1} part 非法`);
    for (const f of (e.festivals || [])) {
      assert.ok(f.name && f.custom, `week${i + 1} 节庆缺名字/习俗`);
      for (const c of (f.strong || [])) assert.ok(validCats.has(c), `week${i + 1}「${f.name}」的 strong「${c}」不是有效据点分类`);
    }
  }
});

test("weekCalOf：超过52周回绕（第53周=第1周内容）", () => {
  assert.deepEqual(weekCalOf(53), weekCalOf(1));
  assert.deepEqual(weekCalOf(1), weekCalOf(105)); // 跨两年
});

test("currentJieqiName：当周无节气时回溯最近一次生效的", () => {
  assert.equal(currentJieqiName(1), "小寒"); // 当周就是
  assert.equal(currentJieqiName(9), "雨水"); // week9 无节气，回溯到week8的雨水
  assert.equal(currentJieqiName(4), "大寒"); // week4 无节气，回溯到week3
});

test("weekLabel：X月+初上下末", () => {
  assert.equal(weekLabel(7), "正月上"); // 春节所在周
  assert.equal(weekLabel(1), "腊月初"); // 小寒，跨年月份
});

test("calendarContextFor：撞上据点分类=强夺舍，没撞上=弱提示当下节气", () => {
  const strong = calendarContextFor(7, "节庆"); // 春节周·庙会集场
  assert.equal(strong.strong, true);
  assert.ok(strong.scenario.includes("春节"));
  assert.ok(strong.text.includes("正月初一"));

  const weak = calendarContextFor(7, "探洞地宫"); // 同一周，但雪线古洞跟春节不沾边
  assert.equal(weak.strong, false);
  assert.equal(weak.scenario, null);
  assert.ok(weak.text === null || typeof weak.text === "string"); // 该周本身就是节气/节庆周，允许有回溯文本

  const noneAtAll = calendarContextFor(11, "探洞地宫"); // week11 无节气无节庆，纯回溯
  assert.equal(noneAtAll.strong, false);
  assert.ok(noneAtAll.text.includes("节气"));
});

test("英雄救美/美救英雄：RESCUE_SCENARIOS 五条都真实存在于情境池，没有手误打错字", () => {
  const all = Object.values(EXP_SCEN_BY_CAT).flat();
  assert.equal(RESCUE_SCENARIOS.size, 5);
  for (const s of RESCUE_SCENARIOS) assert.ok(all.includes(s), `「${s}」不在 EXP_SCEN_BY_CAT 任何一类里`);
});

test("英雄救美/美救英雄：不管撞上哪个据点，女性npc兜底池都不会是空的", () => {
  const isFemale = (g) => g && (g.gender === "女" || FEMALE_GUEST_IDS.has(g.id));
  const globalPool = GUESTS.filter(isFemale);
  assert.ok(globalPool.length > 0, "全局女性兜底池不能为空，否则没有本地女客的据点会抽不到目标");
  for (const node of EXPEDITION_MAP) {
    const local = (node.guests || []).map(id => GUESTS.find(g => g.id === id)).filter(isFemale);
    assert.ok(local.length > 0 || globalPool.length > 0, `${node.name} 本地无女客时，全局兜底也该有得选`);
  }
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

test("pickNarrativeRescue：主叙事出场的女子常客转正为同行（本次塌陷逃生实况）", () => {
  const st = newState();
  const text = "夏至已至，师兄与苏唐入地宫寻奇珍，却见平日里孤傲毒舌的食评人余味竟独自倚在石壁旁，面若桃花。";
  const hit = pickNarrativeRescue(st, ["ryuwei", "huyanxue", "qingxu"], text);
  assert.equal(hit.id, "ryuwei");
});

test("pickNarrativeRescue：男客现身也转正（清虚道长）", () => {
  const st = newState();
  const hit = pickNarrativeRescue(st, ["qingxu"], "师兄与苏唐在溪边采得野果，路上碰见清虚道长讨了碗水。");
  assert.equal(hit.id, "qingxu");
});

test("pickNarrativeRescue：没点名的常客就空手（苏唐/师兄不算，云游苦行客不转正）", () => {
  const st = newState();
  assert.equal(pickNarrativeRescue(st, [], "苏唐眼尖，一眼认出那丛蕨菜嫩得正好。"), null);
  assert.equal(pickNarrativeRescue(st, [], null), null);
  const passer = pickNarrativeRescue(st, [], "村口蜷着个乞丐，破碗里落着几枚铜钱。");
  assert.equal(passer, null);
});

test("pickNarrativeRescue：出场多的优先；平手时同据点熟人优先", () => {
  const st = newState();
  const text = "梅朵策马而来，远远喊了声师兄。梅朵翻身下马，笑着递过一壶马奶酒。" + "食评人余味也在，只点了点头。";
  assert.equal(pickNarrativeRescue(st, ["ryuwei"], text).id, "meiduo");
  const tie = "兰姐在茶棚里招手，罗刹也在旁边擦着筷子。";
  assert.equal(pickNarrativeRescue(st, ["luosha"], tie).id, "luosha");
  assert.equal(pickNarrativeRescue(st, ["lanjie"], tie).id, "lanjie");
});
