// ── Prompt 编排（学 ji-haitang：分块、标号、不冗余；数据与拼接分离）──────
// 每个调用 = 一个 system（身份+文风+格式）+ 一个 user（【标号】分块的事实与约束）。
import { FLAVOR_BY_ID, FLAVORS, TECHNIQUES, starLabel, weekLabel } from "./data.js?v=v4";
import { currentGuest } from "./state.js?v=v4";

// 标号块：空内容则整块省略，避免冗余空段
export const sec = (t, b) => (b ? `【${t}】\n${b}\n` : "");

// 苏酥是苏唐的亲姐姐：她是客人时，把人物关系写进 prompt，苏唐吃醋、苏酥撩拨
export const sisterSec = (g) => g?.sister
  ? sec("人物关系", "苏酥是苏唐的亲姐姐。苏唐在旁看得紧，既防姐姐勾引师兄、又防师兄献殷勤；苏酥偏偏故意撩拨，看妹妹吃醋。")
  : "";

// 踢馆同行：要求苛刻、存心挑刺，必须堂堂正正服众
export const rivalSec = (g) => g?.rival
  ? sec("踢馆", "此人是上门踢馆的同行，要求苛刻、存心挑刺。这道菜必须堂堂正正服众：他满意就认输走人，不满意就嘲讽摘招牌。")
  : "";

// 体貌描述：女厨等美若天仙的角色，涉及她们的叙事都要带出这份体貌
export const bodySec = (g) => (g?.body ? sec("体貌", `${g.name}${g.body}。描述或着墨时带出这份样貌。`) : "");

// 店誉：余味送的银簪（一支=一星米其林）。有星后全蜀地都知道豆花庄，NPC 态度要变：旧友熟人夸、同行忌惮
// 余味的口癖（猫钦定）：时刻自称「奴家」，称呼旁人一律「这位小哥」（不叫师兄/姑娘/前辈）
export const RYUWEI_VOICE = "她说话时刻自称「奴家」，称呼旁人一律「这位小哥」（无论对方是谁都不例外，不叫师兄/姑娘/前辈）；只有心理活动可写第三人称「她」。";

export const starSec = (st) => {
  const n = (st?.ryuweiRating || {}).tier ?? 0;
  if (n <= 0) return "";
  return sec("店誉", `豆花庄得了食评人余味送的 ${n} 支银簪（一支银簪等于一星，蜀地独一份，比县志里锦官城那几家名馆还金贵）。余味是峨眉破戒的女侠——任性少女、年纪轻轻的一流高手、口味刁钻，叫她「前辈」她会急眼；${RYUWEI_VOICE}。这份名声必须落进这场的言行里：旧识、熟客见面就夸，夸得真诚具体；同行（尤其上门挑刺的厨子）先忌惮三分，挑刺也先掂量「这家挂着星」。别直白喊口号，把分量写在台词与态度里。`);
};

// 食评人余味 · 专属点评规则：银簪评级是她的招牌，评价落到火候，带出评级惦记
export const ryuweiSec = (g, st) => {
  if (!g?.ryuwei) return "";
  const n = (st?.ryuweiRating || {}).tier ?? 0;
  const pts = (st?.ryuweiRating || {}).pts ?? 0;
  const need = [75, 85, 95][n];
  const remain = need ? Math.max(0, need - pts) : 0;
  return sec("食评人余味", `余味是峨眉破戒的女侠食评人——任性少女、口味刁钻、年纪轻轻的一流高手，别叫前辈。${RYUWEI_VOICE}她的银簪评级是招牌：大阵仗四样（大菜/汤/小吃/酒水）各 25%，总分 ${remain > 0 ? `还差 ${remain} 分到下一星（她上回给到 ${pts} 分）` : "已到最高星"}。她的评价要实打实落到火候与滋味上，会带出银簪、评级的惦记。`);
};

// ── 闲聊上下文（学 qucuo/jihaitang：分块、标号、不冗余；数据与拼接分离）──
// 苏唐接话要有据：场景/关系/今日来客/近况/最近对话/店誉全拼进 user 块，
// 她提人提事不凭空——来过的客人、做过的菜、师兄的银簪名声都是谈资。
export function chatContext(st) {
  const stars = (st?.ryuweiRating || {}).tier ?? 0;
  const g = currentGuest(st);
  const dayLogTxt = (st?.dayLog || []).slice(-3).map(d => `给${d.name}上了「${d.dish}」${d.score}分`).join("；");
  const snacks = (st?.todaySnacks || []).slice(-2).map(s => `备了「${s.name}」`).join("、");
  const notes = (st?.notes || []).slice(-4).map(n => `${n.act}·${n.text}${n.ai ? `｜${n.ai}` : ""}`).join("；");
  const chatLog = (st?.chatLog || []).slice(-4).map(c => `师兄说「${c.u.slice(0, 20)}」→ 苏唐回「${c.a.slice(0, 24)}」`).join("\n");
  const cur = st?.dish ? `手上正做着「${st.dish.name}」` : "灶上还空着";
  return [
    sec("场景", `第${st?.day}周（${weekLabel(st?.day)}）· 已待客${st?.served ?? 0}位。${cur}。${dayLogTxt ? `今日来客：${dayLogTxt}。` : ""}${snacks ? `苏唐今日${snacks}。` : ""}`),
    sec("客人", g ? `${g.name}（${g.ident}）坐在灶边等菜，点菜时说「${g.order}」。师兄可以跟他搭话，聊他想吃什么。` : "店里没有客人。"),
    sec("苏唐与师兄", `苏唐对师兄好感 ${st?.suAff ?? 0}。${stars > 0 ? `店里挂着余味送的${stars}支银簪（一支=一星），苏唐为这份名头得意，熟人面前会显摆两句，也怕砸了招牌。` : "还没拿到银簪，苏唐盼着余味再来——余味是峨眉破戒的任性女侠，年纪轻轻的一流高手，口味刁钻，苏唐跟她斗嘴斗得开心，也从她嘴里听见天下名馆的见闻。别叫她前辈。${RYUWEI_VOICE}"}`),
    sec("近况", notes || "平淡一日，灶上安稳。"),
    chatLog ? sec("最近对话", chatLog) : "",
  ].filter(Boolean).join("\n");
}

// ── 身份 + 文风（所有说书人调用共用的 system 基座）────────────────────
export const STYLE = [
  "你是《西蜀豆花庄》这本日记的笔。日记由师兄（小厨，玩家）与师妹苏唐合写。",
  "苏唐：汉人师妹，一身红衣汉服，灶边递料、擦碗、添柴，偶尔在日记里补一句她的笔迹。",
  "旁白一律第三人称，称玩家为「师兄」：写「师兄如何如何」，不要写「你」。",
  "正文要分成 3-6 个自然段，段与段之间空一行，左对齐，像日记一样一页页写。",
  "三种笔法都要用上，且会被不同颜色显示：旁白直接写；人物说出口的话用「」包裹；人物心里的活动用 *...* 包裹。",
  "旁白假装客观：多写所见所闻的动作与物件，情绪交给对话和动作去带，不写空泛的心理分析。",
  "文风：白描、有烟火气，像两个人轮流动笔的日记。段落以完整长段为主，不要单句成段。",
  "行为优先：不直接写情绪，让角色做一件只有在这种情绪下才会做的具体的事；对话后面不挂语气、眼神、声调描写（对话裸奔），情绪让读者从台词和动作里自己体会。",
  "禁用词与句式：不写「一丝」「几不可察」「不易察觉」「不容置疑」；不用「不是……而是……」句式。",
  "写完正文，末尾必须附一句师妹苏唐的评价，前缀「苏唐批：」——或夸或吐槽，要鲜活，带点她自己的小动作。",
  "最后再单独输出一行「心情：」，用一个词表达苏唐此刻的心情，只能从八个词里选：开心、悠闲、兴奋、心动、得意、不满、吃惊、专注。心情要和批语相配。",
].join("\n");

// ── 武学档位 → 描写细致度（1-5 档，重点+示例，一起发）────────────────
export const TIERS = [
  { t: 1, focus: "只写动作与结果，不写过程，句子短。", ex: "师兄把料下锅，炒熟，端上桌。" },
  { t: 2, focus: "加一两个动作细节（刀/火/手）。", ex: "师兄手腕一抖，锅里菜翻了个身。" },
  { t: 3, focus: "写刀工+火候+身法的连贯动作，带声音与热气。", ex: "菜刀笃笃两声食材已匀；火苗被压得温顺，咕嘟冒泡。" },
  { t: 4, focus: "内力/轻功/刀法融入每一步，多感官（声色香味触），招式有名。", ex: "手掌悬锅，内力沉沉压下；脚尖一点身形拔高取油罐，正是梯云纵；刀化残影剁碎海椒。" },
  { t: 5, focus: "举重若轻、道法自然，动作如艺术，环境与气息呼应，收放自如。", ex: "刀快得只剩红影，火随刀旺；沸汤冲碗一瞬烫熟，灶房潮气与香气一同蒸腾。" },
];
export function tierOfScore(s) { return Math.max(1, Math.min(5, Math.ceil((s || 0) / 20) || 1)); }
export function tierGuide(tier, who = "武学") {
  return `${who}档位与描写细致度（档位越高越细致，本次按第${tier}档写）：\n` +
    TIERS.map(x => `${x.t}档·${x.focus} 例:${x.ex}${x.t === tier ? "  ←当前" : ""}`).join("\n");
}

// ── 出菜（第二轮叙事）user 块 ───────────────────────────────────────
export function dishUser(ctx) {
  return (
    sec("场景", "西蜀豆花庄，师兄开火做菜。") +
    sec("料", ctx.materials.map(m => { const s = (ctx.starOf || starOf)(m); return `${m}${s ? "★".repeat(s) : ""}`; }).join("、")) +
    sec("星级", "带★的是探秘得来的顶级食材，极为珍贵，正文里要写出它的难得与好。") +
    sec("料性", ctx.lore.map(l => `· ${l}`).join("\n")) +
    sec("技法", `${ctx.technique}（${TECHNIQUES[ctx.technique].desc}）`) +
    sec("炊具", `${ctx.cookware.name}（${ctx.cookware.desc}）`) +
    sec("味型", ctx.flavorId ? `${FLAVOR_BY_ID[ctx.flavorId].name}——${FLAVOR_BY_ID[ctx.flavorId].label}` : "家常，未刻意调味") +
    sec("任务", ctx.guest ? `这道菜做给 ${ctx.guest.name}。TA 点菜时说「${ctx.guest.order}」。你只知道 TA 说出口的这些，不知道 TA 没说出口的喜好，不要写得像早就知道 TA 爱吃什么。` : "") +
    sisterSec(ctx.guest) +
    rivalSec(ctx.guest) +
    bodySec(ctx.guest) +
    starSec(ctx.st) +
    ryuweiSec(ctx.guest, ctx.st) +
    sec("约束", `只能使用这些料：${ctx.materials.join("、")}，不得凭空添加任何其他食材。`) +
    sec("配方", ctx.recipeName ? `这搭配正中配方「${ctx.recipeName}」，菜名必须用它。` : "这搭配没有固定配方，请你即兴起一个贴切的菜名。") +
    sec("武学", ctx.martial ? `这一勺练到 ${ctx.martial.external.join("、") || "基本功"}${ctx.martial.internal ? "，并运了内功" : ""}；食材配合 ${ctx.martial.synergy} 分；成菜基础分 ${ctx.baseScore}。正文里把这套身手自然带出来。` : "") +
    sec("档位", tierGuide(tierOfScore(ctx.baseScore))) +
    sec("篇幅", `正文总字数约 ${ctx.words || 360} 字（允许±${ctx.tol ?? 15}%浮动），不要明显少写，也不要为凑数硬拖长。`) +
    sec("输出格式", `第一行「菜名：「xxx」」；换行写正文（3-6 段，穿插「」对话与 *心理*，写师兄掌勺、火候、成菜色香味）；再一行「菜单：」约100字（品名+用料+风味，供记入菜单）；再一行「苏唐批：」；再一行「纸条：」≤50字客观小结（谁做了什么、结果如何，供存档回看）；最后一行「心情：」一个词（八个里选）。`)
  );
}

// ── 苏唐备小吃 user 块 ──────────────────────────────────────────────
export function snackUser(ctx) {
  return (
    sec("上下文", ctx.context || "") +
    sec("师兄吩咐", ctx.request || "（没说什么，随你发挥）") +
    sec("现有食材", ctx.invStr || "（没有）") +
    sec("星级", "带★的是顶级食材，极为珍贵；若用上，要写出它的难得。") +
    sec("做给谁", ctx.guest ? `这小吃是做给当前客人 ${ctx.guest.name}（${ctx.guest.ident}）吃的，不是给师兄。TA 说「${ctx.guest.order}」。你要照着客人的口味来做。` : "") +
    sisterSec(ctx.guest) +
    rivalSec(ctx.guest) +
    bodySec(ctx.guest) +
    starSec(ctx.st) +
    sec("现有食材", ctx.invStr) +
    sec("苏唐自决", "你是苏唐，自己决定做什么小吃、用什么料（最多4样）、做几份、品质如何、是什么味型，师兄管不着。你是店家，对顾客要客气热情、招呼周到；对师兄则调情撒娇、逗他嗔他带甜，绝不责备。") +
    sec("已有小吃库存", ctx.snackStock || "（还没有备好的小吃）") +
    sec("做新还是复做", "看库存：库里还够、又合客人口味的，就复做已有的别浪费料；不够或想要更好的，才做新的。") +
    sec("可选味型", `选一个作为这小吃的味型：${FLAVORS.map(f => f.name).join("/")}。`) +
    sec("档位", tierGuide(ctx.suTier || 1, "苏唐手艺")) +
    sec("武功", tierGuide(ctx.martialTier || 1, "师兄武功")) +
    sec("输出格式", `先写约 ${ctx.words || 300} 字的苏唐做小吃小剧情：必须分 3-5 个自然段，段与段之间空一行；对话必须用「」包裹（不要用“”），心理必须用 *...* 包裹；写她如何备料、制作、招呼客人；对客人客气，对师兄调情撒娇。写完另起一行输出 JSON：{"made":"成品名","cat":"汤/饭/点心/串/小吃","flavor":"味型名(从可选味型里选)","used":[用掉的食材名,最多4样,须来自现有且够数],"portions":1-6,"quality":0-100,"desc":"约100字描述(品名+用料+风味,供记入菜单)","note":"苏唐的≤30字小结(供小纸条存档)","say":"苏唐说的话","mood":"八个心情词之一"}`)
  );
}

// ── 客人品尝 user 块 ────────────────────────────────────────────────
export function reactionUser(ctx) {
  return (
    sec("客人", `${ctx.guest.name}（${ctx.guest.ident}），点菜时说：「${ctx.guest.order}」`) +
    sisterSec(ctx.guest) +
    rivalSec(ctx.guest) +
    bodySec(ctx.guest) +
    starSec(ctx.st) +
    ryuweiSec(ctx.guest, ctx.st) +
    sec("主菜", `「${ctx.dishName}」（${ctx.mainBy || "师兄"}做的）：${ctx.mainDesc || "（无描述）"}。这道主菜评分 ${ctx.score} 分。`) +
    sec("佐餐", ctx.snackName ? `小吃「${ctx.snackName}」（苏唐做的）：${ctx.snackDesc || "苏唐手作。"}。这道小吃评分 ${ctx.snackScore ?? "—"} 分。` : "（这顿没有佐餐小吃）") +
    sec("裁决", `${ctx.tierDesc}（${ctx.score}分）。客人对师兄的好感为 ${ctx.aff ?? 0}（${ctx.affName || "面生"}）。`) +
    sec("写法", `写 2-4 段出餐品尝场景：主菜是${ctx.mainBy || "师兄"}做的、小吃是苏唐做的，客人两道都尝、分别评价——主菜怎么、小吃怎么，要有客人说出口的「」对话，动作带人设，按裁决档位不越档夸、不越档骂。`) +
    sec("吃美", ctx.tier === 0 ? "客人吃美了——真心实意夸师兄手艺，夸得具体；好感越高夸得越亲。" : "") +
    sec("输出格式", `写完场景后，另起一行「纸条：」≤50字客观小结（给谁上了什么、客人反应、满意度）；最后一行单独输出「心情：」一个词（苏唐在一旁旁观的心情，八个里选）。`)
  );
}
