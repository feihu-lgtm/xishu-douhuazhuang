// 鱼定村小馆 · 设定数据（移植自 qucuo 烹饪系统 + 川菜味型图鉴 + NPC 口味表）
// 纯数据，不碰 DOM / 存档。

export const QUAL_BONUS = { 白: 0, 绿: 5, 蓝: 10, 紫: 15 };

// ── 技法（图鉴扩充）· unlock=0 初始掌握；from/need=练功可学（用前置技法N次解锁）──
export const TECHNIQUES = {
  炖: { id: "炖", icon: "🍲", needsSteamer: false, unlock: 0,
    desc: "文火慢煨，什么都能炖。不挑调料，新手保底。" },
  炒: { id: "炒", icon: "🥘", needsSteamer: false, unlock: 0, buffAttr: "身法",
    desc: "旺火快炒，锅气足，出餐快。" },
  煎: { id: "煎", icon: "🍳", needsSteamer: false, unlock: 0,
    desc: "少油慢煎，两面金黄，豆腐鱼排都靠它。" },
  炸: { id: "炸", icon: "🫧", needsSteamer: false, unlock: 0, buffAttr: "体魄",
    desc: "宽油旺火，外酥里嫩，酥肉洋芋都离不开。" },
  烤: { id: "烤", icon: "🔥", needsSteamer: false, unlock: 12, buffAttr: "体魄",
    desc: "明火炙烤，肉食加成，焦香入骨。" },
  腌: { id: "腌", icon: "🫙", needsSteamer: false, unlock: 10,
    desc: "盐醋封坛，日久味长，冷吃开胃。" },
  蒸: { id: "蒸", icon: "♨", needsSteamer: true, unlock: 18,
    desc: "竹笼水汽，原味不夺。效果最强，需蒸笼。" },
  卤: { id: "卤", icon: "🍯", needsSteamer: false, unlock: 14,
    desc: "老卤慢浸，五香入骨，一锅老汤养十年。" },
  凉拌: { id: "凉拌", icon: "🥢", needsSteamer: false, unlock: 8,
    desc: "不点火，红油一拌就成，夏天最开胃。" },
  // ── 水传热：从「炖/蒸」练功解锁 ───────────────────────────────
  煨: { id: "煨", icon: "🫕", needsSteamer: false, unlock: 16, from: "炖", need: 3,
    desc: "微火久煨，汤浓味醇，一罐煨一夜，急不得。" },
  焖: { id: "焖", icon: "🥘", needsSteamer: false, unlock: 28, from: "炖", need: 5,
    desc: "盖紧锅盖，靠水汽焖透，省水省火，油焖大虾焖锅饭。" },
  炆: { id: "炆", icon: "🔥", needsSteamer: false, unlock: 32, from: "炖", need: 8,
    desc: "文火炆烧，汁浓肉耙，川粤同法的慢功夫。" },
  烩: { id: "烩", icon: "🥣", needsSteamer: false, unlock: 18, from: "炖", need: 6,
    desc: "多料同锅，薄芡收汤，汤汤水水一锅烩。" },
  烧: { id: "烧", icon: "🍖", needsSteamer: false, unlock: 24, from: "炖", need: 4,
    desc: "先炸后烧，汁浓味厚，红烧的路子。" },
  焯: { id: "焯", icon: "♨", needsSteamer: false, unlock: 14, from: "蒸", need: 3,
    desc: "滚水快焯，断生即起，锁住青菜的脆。" },
  灼: { id: "灼", icon: "♨", needsSteamer: false, unlock: 26, from: "蒸", need: 5,
    desc: "白水灼熟，原汁原味，白灼虾就靠它。" },
  // ── 火传热：从「烤」练功解锁 ─────────────────────────────────
  烘: { id: "烘", icon: "🔥", needsSteamer: false, unlock: 20, from: "烤", need: 3,
    desc: "炭火余温慢烘，干香回脆，面点干货的巧宗。" },
  烙: { id: "烙", icon: "🥞", needsSteamer: false, unlock: 22, from: "烤", need: 5,
    desc: "平底干烙，两面微焦，饼子锅盔都用它。" },
  燎: { id: "燎", icon: "⚡", needsSteamer: false, unlock: 30, from: "烤", need: 8,
    desc: "明火燎烧，去毛燎皮，虎皮椒和猪蹄的狠活。" },
  // ── 油传热：从「炒/炸/煎」练功解锁 ───────────────────────────
  爆: { id: "爆", icon: "💥", needsSteamer: false, unlock: 20, from: "炒", need: 6,
    desc: "急火快爆，油花四溅，葱爆腰花的狠劲。" },
  炝: { id: "炝", icon: "🔥", needsSteamer: false, unlock: 16, from: "炒", need: 3,
    desc: "热油炝锅，一炝出香，炝拌菜的底子。" },
  煸: { id: "煸", icon: "🥘", needsSteamer: false, unlock: 22, from: "炒", need: 5,
    desc: "干煸出油，焦香不柴，干煸豆角四季豆。" },
  熘: { id: "熘", icon: "🍽", needsSteamer: false, unlock: 26, from: "炒", need: 8,
    desc: "先炸后熘，挂汁挂浆，糖醋里脊的熘。" },
  贴: { id: "贴", icon: "🫓", needsSteamer: false, unlock: 34, from: "煎", need: 6,
    desc: "锅贴似的，底贴锅面煎脆，上边焖熟。" },
  // ── 专练外功的技法（train=做这道菜额外练哪门武）────────────────
  片: { id: "片", icon: "🗡", needsSteamer: false, unlock: 20, from: "煎", need: 5, train: "剑法",
    desc: "薄刀轻片，剑走轻灵——片鱼片、片嫩肉，刀光如剑。" },
  串: { id: "串", icon: "🍢", needsSteamer: false, unlock: 20, from: "烤", need: 5, train: "枪法",
    desc: "竹签穿串，势如枪刺——一签一个准，串烧烤肉。" },
  颠: { id: "颠", icon: "🥘", needsSteamer: false, unlock: 18, from: "炒", need: 5, train: "投掷",
    desc: "颠勺抛锅，料在空里翻个——练的正是投掷的准头。" },
};
export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

// ── 炊具（10 件）· 溪边旧铁锅灶房自带 ──────────────────────────────────
export const COOKWARE = [
  { id: "jiutieguo", name: "溪边旧铁锅", quality: "白", default: true, canSteam: false, price: 0,
    desc: "锅沿磕了三个豁口，鱼定大娘说补补还能用十年。灶房自带，炖炒皆可。" },
  { id: "taoguan", name: "熊山陶炖罐", quality: "白", canSteam: false, price: 8,
    desc: "熊山红陶，炖汤不夺味，摔不烂。" },
  { id: "caitan", name: "黑风寨腌菜坛", quality: "白", canSteam: false, price: 8,
    desc: "坛沿水封得严实，腌三年不坏。" },
  { id: "chaoguo", name: "孟记熟铁炒锅", quality: "绿", canSteam: false, price: 16,
    desc: "孟铁匠锻的，锅气足，炒什么都香。" },
  { id: "zhenglong", name: "竹编蒸笼（三层）", quality: "绿", canSteam: true, price: 9,
    desc: "雅江冷箭竹编的，蒸出来带竹香。唯一能上蒸的炊具。" },
  { id: "kaojia", name: "跑马会炭烤架", quality: "绿", canSteam: false, price: 12,
    desc: "铁条焊的，烤全羊都架得住。" },
  { id: "tonghu", name: "铜吊壶", quality: "绿", canSteam: false, price: 10,
    desc: "煮茶煮汤两相宜，铜绿养出来了。" },
  { id: "shizaofu", name: "雪山派石灶釜", quality: "蓝", canSteam: true, price: 30,
    desc: "雪山顶寒铁铸的，导热极匀，亦可蒸。" },
  { id: "falan", name: "锦官城珐琅砂锅", quality: "蓝", canSteam: false, price: 24,
    desc: "官窑珐琅彩，柳青鸢办公桌上炖汤用的同款。" },
  { id: "qingtongding", name: "三星堆仿青铜鼎", quality: "紫", canSteam: true, price: 60,
    desc: "鸭子河畔淘沙人挖出来的，仿商周制式，炖肉有金石气。" },
];
export const COOKWARE_BY_ID = Object.fromEntries(COOKWARE.map(c => [c.id, c]));
export const DEFAULT_COOKWARE_ID = "jiutieguo";

// ── 川味型图鉴 · requires=核心调料（必须在料槽里才算调出此味）──────────
// from/need=练功可学（用前置味型N次解锁），unlock=商店价
export const FLAVORS = [
  { id: "xianxiang", name: "鲜香", label: "清鲜本味，盐提鲜、酱生香", unlock: 0,
    requires: ["贡措海盐"], desc: "咸鲜为主，宁淡勿咸。盐、酱、孜然皆在此味。" },
  { id: "qingdan", name: "清淡", label: "姜葱爽口，原味不夺", unlock: 0,
    requires: ["鱼定村野葱油"], desc: "葱油清香，吃的是食材自己的味道。" },
  { id: "mala", name: "麻辣", label: "麻香打颤，辣而不燥", unlock: 12,
    requires: ["熊山花椒"], desc: "花椒当家，舌尖打颤才够格。" },
  { id: "suanla", name: "酸辣", label: "醇酸微辣，开胃爽口", unlock: 10,
    requires: ["黑风寨苞谷醋"], desc: "苞谷醋的酸，配一点辣，酸得正。" },
  { id: "tian", name: "甜", label: "纯甜而香，回甘绵长", unlock: 10,
    requires: ["雪山野蜂蜜"], desc: "野蜂蜜入膳，甜得干净。" },
  { id: "tiansuan", name: "甜酸", label: "甜酸味厚，似荔枝酸甜", unlock: 16,
    requires: ["黑风寨苞谷醋", "雪山野蜂蜜"], desc: "糖醋路子，先酸后甜，席面收尾的味。" },
  // ── 川菜进阶味型（练功可学，或商店买）───────────────────────────
  { id: "hongyou", name: "红油", label: "辣油鲜亮，香辣不燥", unlock: 18, from: "mala", need: 3,
    requires: ["二荆条辣椒", "雅江菜籽油"], desc: "红油亮、辣子香，凉拌面食的点睛。" },
  { id: "jiachang", name: "家常", label: "豆瓣回锅，家常味厚", unlock: 18, from: "xianxiang", need: 4,
    requires: ["锦官豆瓣酱"], desc: "豆瓣酱打底，回锅肉、麻婆豆腐都是它。" },
  { id: "yuxiang", name: "鱼香", label: "泡椒豆瓣，酸甜咸辣，鱼香不鱼", unlock: 20, from: "suanla", need: 4,
    requires: ["泡海椒"], desc: "鱼香不见鱼——泡椒豆瓣糖醋蒜，四味一体。" },
  { id: "suanni", name: "蒜泥", label: "蒜香冲鼻，咸鲜微辣", unlock: 20, from: "qingdan", need: 4,
    requires: ["雅江独蒜", "天都镇酱油"], desc: "蒜泥白肉、蒜泥茄子的蒜香路子。" },
  { id: "hula", name: "糊辣", label: "干椒糊香，麻而不燥", unlock: 22, from: "mala", need: 4,
    requires: ["二荆条辣椒", "熊山花椒"], desc: "干辣椒花椒炸出糊香，宫保鸡丁的魂。" },
  { id: "jiangxiang", name: "酱香", label: "豆豉酱香，浓郁回甜", unlock: 22, from: "xianxiang", need: 5,
    requires: ["潼川豆豉"], desc: "豆豉吊出酱香，回锅肉炒饭都吃它。" },
  { id: "jiaoma", name: "椒麻", label: "花椒葱香，麻香清口", unlock: 24, from: "mala", need: 6,
    requires: ["汉源清溪花椒", "鱼定村野葱油"], desc: "青花椒配葱油，椒麻鸡的清爽麻香。" },
  { id: "zaoxiang", name: "糟香", label: "醪糟酒香，甜润微醺", unlock: 26, from: "tian", need: 5,
    requires: ["鱼定村醪糟"], desc: "醪糟入菜，糟香四溢，醉鸡糟鱼甜口。" },
  { id: "guaiwei", name: "怪味", label: "咸甜麻辣酸，五味调和", unlock: 30, from: "tiansuan", need: 6,
    requires: ["汉源清溪花椒", "黑风寨苞谷醋", "雪山野蜂蜜"], desc: "五味调和互不压，怪味胡豆怪味鸡。" },
];
export const FLAVOR_BY_ID = Object.fromEntries(FLAVORS.map(f => [f.id, f]));

// ── 食材 / 调味品 · flavor 仅调味品有（它贡献的味型）──────────────────
export const INGREDIENTS = [
  { name: "熊山花椒", kind: "调味品", flavor: "mala", price: 3,
    lore: "麻得舌尖打颤，冷锅鱼底料的灵魂，产自曲措乡熊山。" },
  { name: "贡措海盐", kind: "调味品", flavor: "xianxiang", price: 1,
    lore: "咸而微甘，贡措海畔石上自结的霜，不是晒的，是湖水自己结的。" },
  { name: "锦官豆瓣酱", kind: "调味品", flavor: "xianxiang", price: 2,
    lore: "咸鲜微辣回甜，晒足一年方出缸，锦官城菜的底子。" },
  { name: "雅江菜籽油", kind: "调味品", flavor: "qingdan", price: 1,
    lore: "青香微辛，冷榨而成，青衣楼冷锅鱼就用这个油。" },
  { name: "雪山野蜂蜜", kind: "调味品", flavor: "tian", price: 4,
    lore: "甜带松脂气，量极少，何雨谢一年只收两罐。" },
  { name: "大草甸孜然", kind: "调味品", flavor: "xianxiang", price: 2,
    lore: "辛香暖人，马帮从西域带回，跑马会烤肉必备。" },
  { name: "黑风寨苞谷醋", kind: "调味品", flavor: "suanla", price: 2,
    lore: "酸得粗粝，苞谷酒糟二次发酵，巴桑说酸得正。" },
  { name: "喇嘛庙藏红花", kind: "调味品", flavor: "xianxiang", price: 6,
    lore: "微苦暖香，能染色，入药入膳两用，佛前的东西不浪费。" },
  { name: "天都镇酱油", kind: "调味品", flavor: "xianxiang", price: 2,
    lore: "咸鲜焦香，黄豆晒制，孟铁匠打铁间隙翻缸。" },
  { name: "鱼定村野葱油", kind: "调味品", flavor: "qingdan", price: 2,
    lore: "辛甜葱香浓，鱼定大娘春天熬的，一罐用半年。" },
  { name: "熊山松茸", kind: "食材", price: 2,
    lore: "菌香浓，不可水洗，洗了就没了山的味道，要用小刀刮泥松针擦。" },
  { name: "青城山蕨菜", kind: "食材", price: 1,
    lore: "嫩滑微涩，青城后山所产，松鹤道长说练完剑吃这个清火。" },
  { name: "熊山铁棍山药", kind: "食材", price: 1,
    lore: "粉糯黏液多，熊山北坡沙土里挖，一杆下去三尺深。" },
  { name: "雪山雪莲瓣", kind: "食材", price: 8,
    lore: "清苦回甘冰凉，雪山顶峰雪莲心里采，何雨谢一年只许采三瓣。" },
  { name: "贡措海苔花", kind: "食材", price: 2,
    lore: "鲜而微腥，贡措海浅滩石上刮的，丹增说那是湖底长上来的头发。" },
  { name: "大草甸野韭", kind: "食材", price: 1,
    lore: "辛香冲鼻，比家韭冲三倍，春天头茬最嫩。" },
  { name: "狼曲冷水鱼", kind: "食材", price: 2,
    lore: "肉细刺多鲜甜，狼曲上游石缝里，雪团拍水震鱼嘎则拿草绳串。" },
  { name: "青衣江团鱼", kind: "食材", price: 3,
    lore: "肉厚无刺胶质重，冷锅鱼的正主，青衣楼一天用二十条。" },
  { name: "贡措海裂腹鱼", kind: "食材", price: 4,
    lore: "肉紧微咸自带盐味，贡措海深处，一年只吃一次是丹增的规矩。" },
  { name: "熊曲石斑", kind: "食材", price: 2,
    lore: "肉嫩带苔香，熊曲急流石下，老孙钓的，一年只有两个月肥。" },
  { name: "牦牛腱子肉", kind: "食材", price: 2,
    lore: "纤维粗肉味浓，玉泉寨牧民散养，炖三时辰才烂，急不得。" },
  { name: "藏香猪五花", kind: "食材", price: 3,
    lore: "脂香带松果味，雪山派后山散养，吃松果野菌长大，烤起来满山香。" },
  { name: "大草甸黄羊腿", kind: "食材", price: 4,
    lore: "肉紧膻味轻，跑马大会烤全羊用的就是这个。" },
  { name: "雪山雪鸡肉", kind: "食材", price: 3,
    lore: "肉紧而嫩清炖最佳，加一味当归就够，加多了尝不出雪鸡自己的味。" },
  { name: "牦牛奶酪", kind: "食材", price: 2,
    lore: "奶香带一丝青草味，卓玛用自家牦牛奶做的鲜酪，春天吃野花的牛，奶做的酪是甜的。" },
  { name: "牛奶", kind: "食材", price: 1,
    lore: "鱼定村家家户户养的乳牛产的，一大早现挤，还温着，奶皮子厚。" },
  { name: "鸡蛋", kind: "食材", price: 1,
    lore: "灶房后头那几只芦花鸡下的，个头不大，蛋黄却红得发亮。" },
  { name: "熊猫笋", kind: "食材", price: 1,
    lore: "嫩清甜带竹香，熊猫啃剩的冷箭竹笋尖，护谷弟子说别捡但确实好吃。" },
  { name: "鱼定村青稞", kind: "基底", price: 1,
    lore: "粗嚼劲足微甜，糌和青稞饼的原料。也是酿青稞酒的底子，高原的酒都从它来。" },
  { name: "玉泉寨土豆", kind: "食材", price: 1,
    lore: "粉沙煮烂即化，不挑地，石头缝也长。" },
  { name: "雅江嫩豆腐", kind: "食材", price: 1,
    lore: "嫩豆香易碎，青衣江的水点的卤，别处做不出。" },
  { name: "大草甸蘑菇", kind: "食材", price: 1,
    lore: "鲜肉厚伞大，雨后草坡上的白伞，不能生吃。" },
  { name: "锦官城干笋", kind: "食材", price: 2,
    lore: "脆吸味耐煮，雅江鲜笋晒干运来，泡发要一夜。" },
  // ── 川滇新增（20 味）──────────────────────────────────────────────
  { name: "二荆条辣椒", kind: "调味品", flavor: "mala", price: 2,
    lore: "川西二荆条，辣得香不辣得燥，回口还带一点甜。" },
  { name: "汉源清溪花椒", kind: "调味品", flavor: "mala", price: 4,
    lore: "贡椒，唐代就进贡的那种，麻得正，不苦不涩。" },
  { name: "泡海椒", kind: "调味品", flavor: "suanla", price: 2,
    lore: "老坛泡足一年的海椒，鱼香味的魂，剁碎了油一激就出香。" },
  { name: "保宁醋", kind: "调味品", flavor: "suanla", price: 3,
    lore: "阆中麸醋，酸得柔和回甜，跟苞谷醋两路子，这个温柔。" },
  { name: "潼川豆豉", kind: "调味品", flavor: "xianxiang", price: 2,
    lore: "豆豉乌黑发亮，豉香浓，回锅肉离了它就不对。" },
  { name: "叙府芽菜", kind: "调味品", flavor: "xianxiang", price: 2,
    lore: "宜宾芽菜，咸甜脆嫩，燃面、咸烧白都靠它吊味。" },
  { name: "玫瑰花酱", kind: "调味品", flavor: "tian", price: 4,
    lore: "昆明安宁玫瑰舂的酱，甜里带花香，蘸乳扇是一绝。" },
  { name: "酸木瓜", kind: "调味品", flavor: "suanla", price: 2,
    lore: "滇西酸木瓜，煮鱼酸汤的酸是果酸，不是醋酸，清香。" },
  { name: "香茅草", kind: "调味品", flavor: "qingdan", price: 2,
    lore: "傣家香茅，手一拍就出柠檬香，烤鱼包肉都用它。" },
  { name: "单山蘸水", kind: "调味品", flavor: "mala", price: 2,
    lore: "昆明单山蘸水，辣椒面配了十几种香料，蘸什么都香。" },
  { name: "雅江独蒜", kind: "调味品", flavor: "qingdan", price: 2,
    lore: "独头蒜，辣而不冲，蒜泥白肉的魂，一瓣顶三瓣。" },
  { name: "鱼定村醪糟", kind: "调味品", flavor: "tian", price: 3,
    lore: "糯米酒酿，甜润带酒香，醪糟汤圆、糟香菜的底子。" },
  { name: "宣威火腿", kind: "食材", price: 4,
    lore: "滇腿，切开是玫瑰色，咸香吊汤第一，切片空口吃也行。" },
  { name: "见手青", kind: "食材", price: 3,
    lore: "牛肝菌，手一摸就青，必须炒透——炒不透就见小人。" },
  { name: "鸡枞菌", kind: "食材", price: 4,
    lore: "蚁巢上长的，鲜得掉眉毛，撕丝炸油鸡枞能香一罐。" },
  { name: "干巴菌", kind: "食材", price: 5,
    lore: "其貌不扬一身褶子，异香，云南人拿它当宝贝。" },
  { name: "大理乳扇", kind: "食材", price: 3,
    lore: "牛奶拉成扇，烤到鼓泡蘸玫瑰糖，白族人的甜。" },
  { name: "石屏豆腐", kind: "食材", price: 2,
    lore: "井水点的豆腐，烤到鼓泡包浆，外焦里嫩。" },
  { name: "饵块", kind: "食材", price: 1,
    lore: "大米舷的，烧饵块抹上酱，昆明人的一天从它开始。" },
  { name: "过桥米线", kind: "食材", price: 1,
    lore: "米线细白，汤要滚，料自己往下烫，讲究个顺序。" },
  { name: "折耳根", kind: "食材", price: 1,
    lore: "鱼腥草，爱的人爱死，恨的人绕道，凉拌最凶。" },
  { name: "雕梅", kind: "食材", price: 3,
    lore: "大理雕梅，用刀雕出纹的梅子，酸甜开胃，炖肉解腻。" },
  // ── 小吃用料 ────────────────────────────────────────────────────
  { name: "绿豆", kind: "食材", price: 1,
    lore: "圆绿豆，煮汤起沙，夏天一锅绿豆汤最解暑。" },
  { name: "内江红糖", kind: "调味品", flavor: "tian", price: 2,
    lore: "内江红糖，甜得厚，凉糕冰粉少不了它。" },
  { name: "冰粉籽", kind: "食材", price: 2,
    lore: "冰粉籽手搓出浆，点成冰粉，颤巍巍一碗清凉。" },
  { name: "蜀南大米", kind: "基底", price: 1,
    lore: "蜀南大米，蒸饭粒粒分明，豆花饭的底。蒸熟了拌曲，就是蜀地酒的根。" },
  { name: "麦芽", kind: "基底", price: 4,
    lore: "大麦发芽、晾晒成芽，麦香浓醇，酿麦酒、做麦芽糖的底子。北地酒坊多用此物。" },
  { name: "甜酒曲", kind: "曲", price: 2,
    lore: "根霉小曲，米酒快酿的引子，蜀地酒坊家家灶头备着一包。" },
  { name: "麦曲", kind: "曲", price: 3,
    lore: "麦子发霉制曲，黄酒的糖化发酵全靠它，越陈的曲越香。" },
  { name: "大曲", kind: "曲", price: 5,
    lore: "小麦踩成的大块曲，烧酒的引子——蒸馏酒是打箭炉马帮带回的新货，蜀地人起初嫌它烈。" },
  { name: "藏曲", kind: "曲", price: 4,
    lore: "藏地青稞酒曲，掺了高原野花，玉泉寨牧人冬春蒸青稞就靠它。" },
  { name: "蒸馏器", kind: "工具", price: 60,
    lore: "打箭炉铁匠铺打的甑锅，蒸酒取露的家伙事——烧酒能不能酿，就看有没有它。" },
  { name: "竹签", kind: "食材", price: 1,
    lore: "削尖的竹签，穿肉穿菜，烤串的家伙什。" },
];
export const ING_BY_NAME = Object.fromEntries(INGREDIENTS.map(i => [i.name, i]));

// 商店常规食材不带星；★高级食材由探秘时 AI 即兴生成，存 st.stars（运行时），与商店区别开
export const STAR_MAP = {};
export const starOf = (n) => STAR_MAP[n] || 0;
export const starLabel = (n) => starOf(n) ? "★".repeat(starOf(n)) : "";

// ── 食材分类标签：调料/肉/菜/主食/基底/曲/其他 ───────────────────────
export const ING_TAGS = ["调料", "肉", "菜", "主食", "基底", "曲", "其他"];
const _TAG = {
  调料: ["熊山花椒","贡措海盐","锦官豆瓣酱","雅江菜籽油","雪山野蜂蜜","大草甸孜然","黑风寨苞谷醋","喇嘛庙藏红花","天都镇酱油","鱼定村野葱油","二荆条辣椒","汉源清溪花椒","泡海椒","保宁醋","潼川豆豉","叙府芽菜","玫瑰花酱","酸木瓜","香茅草","单山蘸水","内江红糖"],
  肉: ["牦牛腱子肉","藏香猪五花","大草甸黄羊腿","雪山雪鸡肉","狼曲冷水鱼","青衣江团鱼","贡措海裂腹鱼","熊曲石斑","宣威火腿"],
  菜: ["熊山松茸","青城山蕨菜","熊山铁棍山药","贡措海苔花","大草甸野韭","熊猫笋","玉泉寨土豆","雅江嫩豆腐","大草甸蘑菇","锦官城干笋","见手青","鸡枞菌","干巴菌","石屏豆腐","折耳根"],
  主食: ["过桥米线","饵块"],
  基底: ["蜀南大米","鱼定村青稞","麦芽"],
  曲: ["甜酒曲","麦曲","大曲","藏曲"],
};
export function ingTag(name) {
  for (const [t, arr] of Object.entries(_TAG)) if (arr.includes(name)) return t;
  return "其他";
}

// ── 小吃品类（苏唐的活计）· cat=汤/饭/点心/串/小吃 ────────────────────
export const SNACKS = [
  { id: "douhua", name: "豆花饭", cat: "饭" },
  { id: "langya", name: "狼牙土豆", cat: "小吃" },
  { id: "laonai", name: "老奶洋芋", cat: "小吃" },
  { id: "kaochuan", name: "烤串", cat: "串" },
  { id: "lüdou", name: "绿豆汤", cat: "汤" },
  { id: "bingfen", name: "红糖冰粉", cat: "点心" },
  { id: "danhong", name: "蛋烘糕", cat: "点心" },
];
export const SET_CATS = ["汤", "饭", "点心", "串", "小吃"];

// 商店常备（刷新也总在架）
export const SHOP_BASICS = ["贡措海盐", "雅江菜籽油", "熊山花椒", "二荆条辣椒",
  "玉泉寨土豆", "蜀南大米", "绿豆", "竹签", "牛奶", "鸡蛋",
  "麦芽", "甜酒曲", "麦曲", "大曲", "藏曲", "蒸馏器"];

// ── 商店基酒（应急/没料没时间时买现成的，品质固定；自酿更高）────────
export const SHOP_WINES = [
  { name: "锦官米酒", flavor: "tian", quality: 58, price: 12, desc: "锦官城酒坊的寻常米酒，甜淡，应急用。" },
  { name: "玉泉青稞酒", flavor: "xianxiang", quality: 60, price: 15, strong: true, desc: "玉泉寨牧人酿的青稞酒，粗犷有后劲。" },
  { name: "马帮烧酒", flavor: "mala", quality: 65, price: 25, strong: true, desc: "打箭炉马帮带的蒸馏烧酒，烈如烧刀。" },
  { name: "锦官黄酒", flavor: "chun", quality: 72, price: 30, desc: "锦官城老字号黄酒，陈了三年，醇厚。" },
];

// ── 酿造配方 · 基底+曲+辅料 → 酒 ────────────────────────────────────
// 工序（内功可加速）：米酒=快酿1周 / 青稞=陶罐1-2周 / 麦酒=3周 / 白酒=发酵2-3周+蒸馏(需蒸馏器) / 黄酒=陈酿6-10周
// flavor 尽量用做菜味型 id（匹配客人口味）；strong=烈酒（余味爱，斯文客嫌）；chun/yaoxiang 为酒专属
export const BREW_RECIPES = [
  { id: "nuomijiu", name: "糯米酒", base: "蜀南大米", qu: "甜酒曲", extra: [], flavor: "tian", kind: "米酒", weeks: 1, desc: "醪糟清甜，入口绵，蜀地家家灶上都有的家常酒。" },
  { id: "suanmeiniang", name: "酸梅酿", base: "蜀南大米", qu: "甜酒曲", extra: ["酸木瓜"], flavor: "suanla", kind: "米酒", weeks: 1, desc: "果酸入酒，开胃爽口——余味姑娘口头念叨的酸。" },
  { id: "diaomeijiu", name: "雕梅酒", base: "蜀南大米", qu: "甜酒曲", extra: ["雕梅", "内江红糖"], flavor: "tiansuan", kind: "米酒", weeks: 1, desc: "雕梅的酸甜浸进酒里，琥珀色，甜酸交织。" },
  { id: "meiguilu", name: "玫瑰露", base: "蜀南大米", qu: "甜酒曲", extra: ["玫瑰花酱"], flavor: "tian", kind: "米酒", weeks: 1, desc: "花气入酒，甜而不腻，姑娘们喜欢的。" },
  { id: "mijiu", name: "蜜酒", base: "蜀南大米", qu: "甜酒曲", extra: ["雪山野蜂蜜"], flavor: "tian", kind: "米酒", weeks: 1, desc: "蜜甜润喉，后味干净。" },
  { id: "jiangguozhongniang", name: "浆果重酿", base: "蜀南大米", qu: "甜酒曲", extra: ["避雨浆果窖藏酒"], flavor: "tiansuan", kind: "米酒", weeks: 1, desc: "旧酒为引，新酒为体，浆果香沉在底。" },
  { id: "qingkejiu", name: "青稞酒", base: "鱼定村青稞", qu: "藏曲", extra: [], flavor: "xianxiang", strong: true, kind: "青稞", weeks: 2, desc: "高原粗犷，后劲足，牧人敬酒用的是它。" },
  { id: "naijiu", name: "奶酒", base: "鱼定村青稞", qu: "藏曲", extra: ["乳扇", "牛奶"], flavor: "tian", kind: "青稞", weeks: 2, desc: "牦牛奶香裹着酒气，玉泉寨的暖身酒。" },
  { id: "zangyaojiu", name: "藏药酒", base: "鱼定村青稞", qu: "藏曲", extra: ["喇嘛庙藏红花"], flavor: "yaoxiang", kind: "青稞", weeks: 2, desc: "藏红花入酒，药香辛辣。喇嘛庙规矩是佛前不饮，市井里照喝。" },
  { id: "mishaoshao", name: "米烧酒", base: "蜀南大米", qu: "大曲", extra: [], flavor: "mala", strong: true, kind: "白酒", weeks: 3, needsStill: true, desc: "甑蒸取露，清如水、味极浓烈——李时珍说的烧酒，蜀地人叫烧刀。" },
  { id: "maishaoshao", name: "麦烧酒", base: "麦芽", qu: "大曲", extra: [], flavor: "mala", strong: true, kind: "白酒", weeks: 3, needsStill: true, desc: "麦香冲烈，打箭炉烧坊的手艺。" },
  { id: "qingkebaijiu", name: "青稞白酒", base: "鱼定村青稞", qu: "大曲", extra: [], flavor: "mala", strong: true, kind: "白酒", weeks: 3, needsStill: true, desc: "藏地高度，一口下去胸口烧起来。" },
  { id: "mihuangjiu", name: "米黄酒", base: "蜀南大米", qu: "麦曲", extra: [], flavor: "chun", kind: "黄酒", weeks: 6, desc: "低温慢酵，色如琥珀，陈得越久越醇——锦官城名馆的看家酒。" },
  { id: "yaoxianghuangjiu", name: "药香黄酒", base: "蜀南大米", qu: "麦曲", extra: ["喇嘛庙藏红花"], flavor: "yaoxiang", kind: "黄酒", weeks: 6, desc: "黄酒泡药，入药入膳两用，药铺也收。" },
  { id: "shanzhenhuangjiu", name: "山珍黄酒", base: "蜀南大米", qu: "麦曲", extra: ["熊山松茸"], flavor: "chun", kind: "黄酒", weeks: 6, desc: "松茸沉底，鲜醇厚重。" },
  { id: "mimaijiu", name: "蜜麦酒", base: "麦芽", qu: "麦曲", extra: ["雪山野蜂蜜"], flavor: "tian", kind: "麦酒", weeks: 3, desc: "麦甜蜜香，北地麦酒的蜀地变种。" },
  { id: "huamaizhang", name: "花麦酿", base: "麦芽", qu: "麦曲", extra: ["玫瑰花酱"], flavor: "tian", kind: "麦酒", weeks: 3, desc: "花香裹麦香。" },
  { id: "suanmaijiu", name: "酸麦酒", base: "麦芽", qu: "麦曲", extra: ["酸木瓜"], flavor: "suanla", kind: "麦酒", weeks: 3, desc: "麦酸爽口，配油腻正合适。" },
];

// ── 配方（10 道）· 料槽组合×技法，命中=固定菜名 ────────────────────────
export const RECIPES = [
  { name: "牦牛骨汤", technique: "炖", materials: ["牦牛腱子肉", "贡措海盐"],
    desc: "骨髓熬化了，汤白得像奶。卓玛说这汤是给病人喝的——不是药，但比药暖。" },
  { name: "松茸炖雪鸡", technique: "炖", materials: ["雪山雪鸡肉", "熊山松茸", "贡措海盐"],
    desc: "何雨谢亲手炖的，小火煨一天一夜。呼延雪说师母只炖过三次。" },
  { name: "烤藏香猪", technique: "烤", materials: ["藏香猪五花", "大草甸孜然"],
    desc: "吃松果野菌长大的，烤起来一股松脂香。呼延雪闻闻味道就当吃过了。" },
  { name: "烤黄羊腿", technique: "烤", materials: ["大草甸黄羊腿", "贡措海盐", "大草甸孜然"],
    desc: "跑马大会集市上现烤的，孜然辣椒撒得厚。梅朵每年跑完马都要吃半条。" },
  { name: "冷锅鱼", technique: "炒", materials: ["青衣江团鱼", "熊山花椒", "雅江菜籽油"],
    desc: "青衣楼招牌。冷锅底料铺七分熟鱼片，不开火先吃鱼。不吃冷锅鱼等于没来过雅江。" },
  { name: "熊猫笋炒腊肉", technique: "炒", materials: ["熊猫笋", "牦牛腱子肉", "熊山花椒"],
    desc: "熊猫啃剩的冷箭竹笋尖配腊肉，嫩得能掐出水。护谷弟子说别捡——但确实好吃。" },
  { name: "酸汤裂腹鱼", technique: "腌", materials: ["贡措海裂腹鱼", "黑风寨苞谷醋", "贡措海盐"],
    desc: "苞谷醋腌的裂腹鱼，酸得开胃。丹增说这鱼自带盐味，是贡措海的眼泪。" },
  { name: "腊牦牛肉", technique: "腌", materials: ["牦牛腱子肉", "贡措海盐", "熊山花椒"],
    desc: "盐与花椒封坛，风干半月。含在嘴里慢慢泡软，一块能吃一上午。" },
  { name: "雪莲蒸蛋", technique: "蒸", materials: ["雪山雪莲瓣", "牦牛奶酪", "贡措海盐"],
    desc: "雪莲瓣入蛋，竹笼水汽一蒸，清苦回甘。何雨谢一年只许采三瓣雪莲。" },
  { name: "松茸蒸鸡", technique: "蒸", materials: ["雪山雪鸡肉", "熊山松茸", "喇嘛庙藏红花"],
    desc: "藏红花染出金黄，松茸提鲜。住持说佛前的东西不能浪费，入膳也是修行。" },
  // ── 川滇新增配方 ─────────────────────────────────────────────────
  { name: "回锅肉", technique: "炒", materials: ["藏香猪五花", "潼川豆豉", "二荆条辣椒"],
    desc: "灯盏窝儿卷起来，豆豉二荆条下锅，肥而不腻，下饭三碗起步。" },
  { name: "鱼香肉丝", technique: "炒", materials: ["牦牛腱子肉", "泡海椒", "保宁醋"],
    desc: "没有鱼却有鱼香，泡海椒保宁醋糖醋一兑，咸甜酸辣兼备。" },
  { name: "见手青炒火腿", technique: "炒", materials: ["见手青", "宣威火腿"],
    desc: "菌子炒透、火腿煸香，滇人拿命换的一盘鲜，油要宽火要足。" },
  { name: "油鸡枞", technique: "炒", materials: ["鸡枞菌", "雅江菜籽油"],
    desc: "鸡枞撕丝慢火炸干，油封一罐，拌面夹馍能香一整个冬天。" },
  { name: "烤乳扇", technique: "烤", materials: ["大理乳扇", "玫瑰花酱"],
    desc: "乳扇架火上烤到鼓泡，抹一层玫瑰糖，卷起来吃，甜香拉丝。" },
  { name: "小锅米线", technique: "炖", materials: ["过桥米线", "宣威火腿", "酸木瓜"],
    desc: "小铜锅单锅煮，火腿吊味酸木瓜提酸，米线吸汤，滚烫上桌。" },
  { name: "烧饵块", technique: "烤", materials: ["饵块", "叙府芽菜"],
    desc: "饵块烤到微焦抹上芽菜酱，咸甜一口，昆明早点的魂。" },
  { name: "折耳根拌豆腐", technique: "腌", materials: ["折耳根", "雅江嫩豆腐", "单山蘸水"],
    desc: "折耳根掐节拌嫩豆腐，单山蘸水一撒，爱的人能吃一整盘。" },
  { name: "香煎石屏豆腐", technique: "煎", materials: ["石屏豆腐", "贡措海盐"],
    desc: "井水豆腐煎到鼓泡包浆，外焦里嫩，蘸水一碟就够。" },
  { name: "油酥肉", technique: "炸", materials: ["藏香猪五花", "鱼定村青稞"],
    desc: "青稞面裹五花宽油一炸，酥得掉渣，下酒一流。" },
];

// ── 客人 · 味型/技法/兴趣食材/消费力/点菜口吻（源自 NPC 口味表）────────
export const GUESTS = [
  { id: "caidan", name: "才旦", ident: "村长之女", spend: 20,
    flavor: "qingdan", tech: "炖", fav: "大草甸蘑菇",
    order: "嘴里常是薄荷凉——别太咸，清清淡淡炖一锅就好。" },
  { id: "laosun", name: "老孙", ident: "老孙饭馆掌柜", spend: 24,
    flavor: "xianxiang", tech: "炖", fav: "狼曲冷水鱼",
    order: "来碗鱼汤，要鲜。咸淡我一口就尝得出来。" },
  { id: "daniang", name: "鱼定大娘", ident: "村里厨娘", spend: 20,
    flavor: "tian", tech: "蒸", fav: "雪山野蜂蜜",
    order: "甜奶茶不离手——给大娘蒸个甜的吧。" },
  { id: "basang", name: "巴桑", ident: "黑风寨汉子", spend: 28,
    flavor: "mala", tech: "炒", fav: "熊山花椒",
    order: "无辣不欢，麻香打颤才够格，炒一盘来。" },
  { id: "danzeng", name: "丹增", ident: "贡措海渔人", spend: 28,
    flavor: "xianxiang", tech: "炖", fav: "贡措海裂腹鱼",
    order: "吃鱼只认海里的鲜，别夺了它自己的味。" },
  { id: "zhuoma", name: "卓玛", ident: "村里妇人", spend: 24,
    flavor: "xianxiang", tech: "炖", fav: "牦牛腱子肉",
    order: "认老火慢炖——肉要烂，汤要暖。" },
  { id: "huasao", name: "花嫂", ident: "村口摆摊", spend: 16,
    flavor: "qingdan", tech: "炒", fav: "玉泉寨土豆",
    order: "家常口，土豆下饭就知足，别放太多油盐。" },
  { id: "asuo", name: "阿索", ident: "小牧童", spend: 14,
    flavor: "tian", tech: "烤", fav: "牦牛奶酪",
    order: "奶酪蘸蜂蜜的吃法是我教的——烤过的更香。" },
  { id: "laoliehu", name: "老猎户", ident: "村口猎户", spend: 24,
    flavor: "xianxiang", tech: "烤", fav: "大草甸黄羊腿",
    order: "烤肉要撒厚孜然，山风里就该吃这个。" },
  { id: "zhaxi", name: "扎西", ident: "马帮商人", spend: 50,
    flavor: "xianxiang", tech: "烤", fav: "大草甸孜然",
    order: "马帮把孜然从西域带回——没孜然等于没出门。" },
  { id: "wenzhanggui", name: "温掌柜", ident: "锦官城商人", spend: 80,
    flavor: "xianxiang", tech: "炒", fav: "锦官豆瓣酱",
    order: "一口尝得出豆瓣晒了几年——酱香要浓，火要旺。" },
  { id: "huyanxue", name: "呼延雪", ident: "雪山派小师妹", spend: 60,
    flavor: "tian", tech: "蒸", fav: "雪山雪莲瓣",
    order: "松子糖不离身——甜是她的软肋。" },
  { id: "meiduo", name: "梅朵", ident: "土司之女", spend: 60,
    flavor: "mala", tech: "烤", fav: "大草甸黄羊腿",
    order: "跑马回来的姑娘——烤肉要撒厚辣椒。" },
  { id: "qingyilou", name: "青衣楼老板娘", ident: "雅江冷锅鱼掌柜", spend: 90,
    flavor: "mala", tech: "炒", fav: "青衣江团鱼",
    order: "麻味打颤才够格，鱼要嫩，油要正。" },
  { id: "caimai", name: "黑风寨采买的", ident: "寨里跑腿", spend: 34,
    flavor: "suanla", tech: "炒", fav: "黑风寨苞谷醋",
    order: "巴桑说酸得正——再来点辣，酸辣口才开胃。" },
  { id: "shusheng", name: "锦官城来的书生", ident: "赶考路上", spend: 44,
    flavor: "tiansuan", tech: "炒", fav: "雅江嫩豆腐",
    order: "糖醋里脊那路子——甜酸味厚，最好不过。" },
  // ── 川滇新增客人 ─────────────────────────────────────────────────
  { id: "maguotou", name: "滇西马锅头", ident: "赶马帮的", spend: 56,
    flavor: "xianxiang", tech: "炒", fav: "见手青",
    order: "菌子要炒透，火腿要厚——见手青我敢吃，炒一盘来。" },
  { id: "baiguniang", name: "大理白族姑娘", ident: "三道茶的", spend: 44,
    flavor: "tian", tech: "烤", fav: "大理乳扇",
    order: "乳扇烤到起泡，蘸玫瑰糖——甜的要，别烤糊。" },
  { id: "paochuan", name: "宜宾跑船的", ident: "川江号子", spend: 36,
    flavor: "xianxiang", tech: "炒", fav: "叙府芽菜",
    order: "芽菜下饭，咸甜口——炒一盘，再烫壶酒。" },
  { id: "daijiak", name: "傣家客人", ident: "版纳来的", spend: 40,
    flavor: "qingdan", tech: "烤", fav: "香茅草",
    order: "香茅草拍一拍，烤鱼包肉都行——要那股柠檬香。" },
  // ── 补全口味 + 苏酥 ────────────────────────────────────────────
  { id: "suniang", name: "酸娘子", ident: "醋坊老板娘", spend: 40,
    flavor: "suanla", tech: "炒", fav: "黑风寨苞谷醋",
    order: "酸要酸得亮堂，辣要辣得痛快——酸辣口才开胃。" },
  { id: "tangcu", name: "糖醋举子", ident: "赶考举子", spend: 46,
    flavor: "tiansuan", tech: "煎", fav: "雅江嫩豆腐",
    order: "糖醋适口，甜酸味厚些，煎得两面金黄最好。" },
  { id: "qingxu", name: "清虚道长", ident: "青城道士", spend: 36,
    flavor: "qingdan", tech: "炖", fav: "青城山蕨菜",
    order: "清淡养性，勿油腻——一锅素炖足矣。" },
  { id: "lasan", name: "辣三娘", ident: "江湖厨娘", spend: 52,
    flavor: "mala", tech: "炒", fav: "熊山花椒",
    order: "麻辣要够劲，麻得跳脚才好，别手软。" },
  { id: "xianbo", name: "鲜伯", ident: "退休老饕", spend: 60,
    flavor: "xianxiang", tech: "炖", fav: "青衣江团鱼",
    order: "要一个鲜字——吊汤见真章，别糊弄老头子。" },
  { id: "tiannan", name: "甜囡", ident: "糖铺小姐", spend: 38,
    flavor: "tian", tech: "蒸", fav: "雪山野蜂蜜",
    order: "甜要甜得干净，蒸的润一点。" },
  { id: "susu", name: "苏酥", ident: "苏唐的姐姐·御姐", spend: 120, sister: true,
    flavor: "xianxiang", tech: "蒸", fav: "雪山雪莲瓣",
    order: "妹妹的师兄？手艺如何——做道雅致的来，别让我等太久。" },
  // ── 天都来客（移植自 qucuo 人物）────────────────────────────────
  { id: "lanjie", name: "兰姐", ident: "百花门主·苗族蛊娘", spend: 110, gender: "女",
    flavor: "suanla", tech: "炖", fav: "酸木瓜",
    body: "苗银盛装，风韵犹存，眼尾带算计的细纹，笑起来不达眼底",
    order: "「苗家酸汤鱼的功夫——汤要酸得亮堂，鱼要嫩得夹不起来。我闻得出你有没有用心。」" },
  { id: "luosha", name: "罗刹", ident: "欢喜教圣女·香料行家", spend: 100, gender: "女",
    flavor: "hula", tech: "炒", fav: "汉源清溪花椒",
    body: "妖冶逼人，琥珀色的眼瞳，笑起来危险又勾人",
    order: "「香料管够的来一份，麻要麻到骨头里，辣要辣得人清醒。做好了，姐姐教你看人的本事。」" },
  { id: "liruoyou", name: "李若由", ident: "玉泉小栈·商人之女", spend: 70, gender: "女",
    flavor: "xianxiang", tech: "炒", fav: "雅江嫩豆腐",
    body: "利落的靛青窄袖，算盘珠子翻得飞快，眼神精明",
    order: "「实惠就行，别整花活。豆腐要嫩，火要旺，账我算得清。」" },
  // ── 美食评分员 · 余味（峨眉破戒女侠·品馔录人·小鱼儿）──────────
  // 任性少女，吃酒吃肉破了峨眉戒律的歧途弟子——但依然是峨眉系，年纪轻轻的一流高手，
  // 口味刁钻。谁叫她"前辈"她跟谁急，她还是个姑娘。
  { id: "ryuwei", name: "余味", ident: "峨眉·品馔录人", spend: 888, gender: "女", ryuwei: true,
    flavor: "suanla", tech: "炖", fav: "酸木瓜",
    body: "柳叶脸，素银鱼尾簪做工极好，月白立领小袄靛青马面裙，腰间一枚银鱼符、一柄窄剑，两根竹木筷随身。峨眉破戒的女侠，任性少年气，年纪轻轻的一流高手，口味刁钻",
    order: "本姑娘今儿就要一道收尾干净的酸来。莫急着揭锅，多闷一炷香，酸要收得干干净净——不够刁，我可要念叨一路的。" },
  // ── 云游苦行客（乞丐/僧人/磕长头香客，皆是过路人，消费力低但各有风骨）──
  { id: "qigai", name: "乞丐", ident: "云游乞儿", spend: 8,
    flavor: "jiachang", tech: "炒", fav: "玉泉寨土豆",
    order: "有口热乎的、能压饿的就成。乞儿吃百家饭，什么都吃得，就是不吃嗟来之食——给的时候客气点。" },
  { id: "yunyouseng", name: "云游僧", ident: "云游行脚僧", spend: 18,
    flavor: "qingdan", tech: "炖", fav: "青城山蕨菜",
    order: "贫僧不挑荤素之外的讲究，一碗素炖，添把野菜即可，剩下的随喜。" },
  { id: "kezhangtou", name: "磕长头的", ident: "磕长头朝圣人", spend: 12,
    flavor: "xianxiang", tech: "炖", fav: "牦牛腱子肉",
    order: "一路磕过来，膝盖手掌都磨出了茧——来碗热汤，骨头缝里都是冷的。" },
];

// ── 踢馆梯度：八大菜系 × 5 档（喽啰→总厨），难度递增，挑过一级来下一级 ──
// 第 15 周后每周第二客 50% 概率来"当前该来"的那一位；挑过他，进度往前推。
// ── 女性客人（收功后可受邀留坐闲聊，好感>15）──────────────────────────
export const FEMALE_GUEST_IDS = new Set([
  "caidan", "zhuoma", "huasao", "huyanxue", "meiduo",
  "baiguniang", "daijiak", "suniang", "lasan", "tiannan", "susu",
  "lanjie", "luosha", "liruoyou", "ryuwei",
]);
export const RIVAL_LEVELS = [
  { tag: "喽啰·采买", req: 65, bonus: [40, 60] },
  { tag: "少主", req: 75, bonus: [60, 90] },
  { tag: "大师兄", req: 85, bonus: [80, 110] },
  { tag: "副厨", req: 90, bonus: [100, 140] },
  { tag: "总厨", req: 95, bonus: [140, 220] },
];
export const RIVAL_SCHOOLS = [
  { name: "川菜", chef: "椒麻", flavor: "mala", tech: "炒", fav: "二荆条辣椒", female: [
    { name: "红绫", body: "美若天仙——雪肤花貌，眉目如画，笑起来勾魂摄魄" },
    { name: "阿椒", body: "美若天仙——眼波流转，颊上一对梨涡，辣得让人挪不开眼" },
    { name: "芙蓉", body: "美若天仙——出水芙蓉，艳而不妖，发间别一支山茶" }] },
  { name: "鲁菜", chef: "酱香", flavor: "jiangxiang", tech: "烧", fav: "天都镇酱油", female: [
    { name: "素娥", body: "美若天仙——端庄秀美，温润如玉，话不多但字字入心" },
    { name: "青荷", body: "美若天仙——清丽脱俗，如夏荷初绽，衣袂带香" }] },
  { name: "粤菜", chef: "清鲜", flavor: "xianxiang", tech: "蒸", fav: "青衣江团鱼", female: [
    { name: "晚照", body: "美若天仙——落日余晖般明艳，一颦一笑皆有光" },
    { name: "荔娘", body: "美若天仙——肤白胜雪，笑靥如荔，甜得人心尖发颤" },
    { name: "云锦", body: "美若天仙——锦绣一般华美，目若点漆，顾盼生辉" }] },
  { name: "苏菜", chef: "甜润", flavor: "tiansuan", tech: "熘", fav: "雪山野蜂蜜", female: [
    { name: "烟雨", body: "美若天仙——烟雨朦胧般柔美，眼尾微微上挑" },
    { name: "雪霁", body: "美若天仙——雪后初晴，冷艳清绝，指尖都透着凉" }] },
  { name: "浙菜", chef: "清雅", flavor: "qingdan", tech: "炖", fav: "熊山松茸", female: [
    { name: "疏影", body: "美若天仙——疏影横斜，清冷动人，发丝如墨" },
    { name: "清秋", body: "美若天仙——秋月之容，明净如水，身段袅袅" },
    { name: "凝霜", body: "美若天仙——凝霜为肤，冰肌玉骨，冷而致命" }] },
  { name: "闽菜", chef: "糟香", flavor: "zaoxiang", tech: "煨", fav: "鱼定村醪糟", female: [
    { name: "霓裳", body: "美若天仙——霓裳羽衣，飘逸出尘，步态轻盈" },
    { name: "兰舟", body: "美若天仙——兰舟轻渡，眉眼温柔，声音糯软" }] },
  { name: "湘菜", chef: "辣烈", flavor: "hula", tech: "煸", fav: "泡海椒", female: [
    { name: "湘灵", body: "美若天仙——湘水之灵，明艳动人，泼辣里带媚" },
    { name: "碧水", body: "美若天仙——碧水为眸，灵动生辉，腰肢盈盈一握" },
    { name: "红裳", body: "美若天仙——红衣烈烈，英气与柔美并具" }] },
  { name: "徽菜", chef: "家常", flavor: "jiachang", tech: "烧", fav: "潼川豆豉", female: [
    { name: "棠梨", body: "美若天仙——棠梨煎雪，清甜温婉，笑时眉眼弯弯" },
    { name: "月梳", body: "美若天仙——月下梳妆，皎皎如霜，侧脸在灯下尤其动人" }] },
];
// 按 菜系序号 × 档位序号 生成一位踢馆同行（req=满足阈值，score 达标即服）
// 黑白格定性别：(si+li) 偶=女厨 → 40 位正好 20 女 20 男；女厨各有美名与体貌
export function rivalGuestAt(schoolIdx, levelIdx) {
  const s = RIVAL_SCHOOLS[schoolIdx] || RIVAL_SCHOOLS[0];
  const l = RIVAL_LEVELS[levelIdx] || RIVAL_LEVELS[0];
  const fl = FLAVOR_BY_ID[s.flavor];
  const isF = (schoolIdx + levelIdx) % 2 === 0;
  let name, ident, body;
  if (isF) {
    const fi = schoolIdx % 2 === 0 ? levelIdx / 2 : (levelIdx - 1) / 2;
    const fm = (s.female || [])[fi] || { name: `${s.name}·女厨` };
    name = fm.name;
    ident = `${s.name}女厨·${s.chef}一脉`;
    body = fm.body || "美若天仙——眉眼如画，见之忘俗";
  } else {
    name = `${s.name}·${l.tag}`;
    ident = `${s.name}${l.tag}·踢馆`;
  }
  return {
    id: `rival_${schoolIdx}_${levelIdx}`,
    name, ident, body,
    gender: isF ? "女" : "男",
    spend: 120 + levelIdx * 30,
    rival: true, req: l.req, bonus: l.bonus, schoolIdx, levelIdx,
    flavor: s.flavor, tech: s.tech, fav: s.fav,
    order: `「${l.tag}，${s.name}${s.chef}一系，特来讨教。${fl ? fl.name : "本系"}为本系看家味，须${TECHNIQUES[s.tech].desc}。做不好，招牌我带走。」`,
  };
}

export const START_INV = {
  "贡措海盐": 3, "雅江菜籽油": 3, "鱼定村野葱油": 2, "熊山花椒": 2,
  "黑风寨苞谷醋": 1, "雪山野蜂蜜": 1, "牦牛腱子肉": 2, "狼曲冷水鱼": 2,
  "熊猫笋": 2, "大草甸蘑菇": 2, "玉泉寨土豆": 2, "熊山松茸": 1,
  // 川滇投放
  "二荆条辣椒": 2, "泡海椒": 1, "潼川豆豉": 1, "见手青": 1,
  "过桥米线": 2, "叙府芽菜": 1, "大理乳扇": 1,
};
export const START_COINS = 12;

export const HOURS = ["卯时·开门", "午时·客来", "未时·客来", "酉时·客来", "戌时·收功"];

// ── 探秘地图：十个据点，一据点对一类情境，点开地图选地方去 ──────────
// top/left 是相对底图（assets/map_bg.png）宽高的百分比坐标，不是视口。
export const EXPEDITION_MAP = [
  { id: "xuedong",   name: "雪线古洞", category: "探洞地宫", top: 32, left: 15, guests: ["huyanxue", "qingxu"] },
  { id: "yakou",     name: "风雪垭口", category: "天灾",     top: 15, left: 67, guests: ["basang", "caimai"] },
  { id: "linchang",  name: "转经林场", category: "密林采山", top: 58, left: 20, guests: ["laoliehu", "asuo"] },
  { id: "yeyi",      name: "牧道野驿", category: "奇遇",     top: 74, left: 8,  guests: ["zhaxi", "maguotou"] },
  { id: "gudao",     name: "黑风古道", category: "劫镖江湖", top: 62, left: 47, guests: ["qingyilou", "lasan", "luosha"] },
  { id: "koudu",     name: "官道渡口", category: "水域",     top: 79, left: 72, guests: ["danzeng", "paochuan"] },
  { id: "zaoshi",    name: "早市坊",   category: "市井",     top: 83, left: 38, guests: ["huasao", "daniang"] },
  { id: "miaohui",   name: "庙会集场", category: "节庆",     top: 10, left: 46, guests: ["meiduo", "baiguniang", "daijiak"] },
  { id: "chengjiao", name: "城郊人家", category: "人情",     top: 90, left: 87, guests: ["caidan", "zhuoma", "laosun", "susu"] },
  { id: "guancheng", name: "关城商市", category: "商贸",     top: 91, left: 46, guests: ["wenzhanggui", "tangcu", "shusheng", "suniang", "tiannan", "xianbo", "liruoyou", "lanjie", "ryuwei"] },
];

// 探秘情境，按十类分好（轻度武侠，一据点一类，各据点各记各的上次，不重复）
export const EXP_SCEN_BY_CAT = {
  市井: ["市井讨价还价", "早市抢货", "夜市捡漏", "与胡商砍价", "当铺赎物",
    "粮行议价", "药铺赊账", "铁匠铺订刀", "布庄换料", "酒坊讨酒",
    "补锅还债·免费修一口锅",
    "闹市遇泼皮·登徒子对她动手动脚"],
  奇遇: ["奇遇·老丐传艺", "奇遇·落难客商", "奇遇·隐士指点", "奇遇·捡到头彩", "奇遇·山洪救人",
    "奇遇·古井秘藏", "奇遇·雷劈老树", "奇遇·白狐引路", "奇遇·游方郎中", "奇遇·说书人赠言"],
  // ── 黑夜行侠：同一位夜行人的四条路数，铁钩剔骨刀、锅底灰印、五味呛粉、熟记全巷炊烟，都是这人的招牌细节──
  劫镖江湖: ["劫镖·黑风截道", "护镖·夜走官道", "劫镖·马帮火并", "截胡·夺回赃物", "江湖·擂台赌菜",
    "江湖·厨会斗艺", "江湖·踢馆挑衅", "江湖·恩怨调解", "劫镖·镖银失窃", "江湖·夜探贼巢",
    "夜行侠·铁钩剔骨刀劫土司私库，赃粮换钱塞进穷家窗台",
    "夜行侠·锅底灰印护孤寡，石阵挡门缝塞警示纸条不露脸",
    "夜行侠·赌坊黑市黑吃黑，被围时一撮五味粉呛得自己先打喷嚏脱身",
    "夜行侠·暗中护镖追踪，熟记满城几时哪家飘炊烟",
    "护方子·星夜送出解毒食疗方，甩开抢秘方的追兵",
    "以食证冤·尝味查出真凶，翻了一桩冤案",
    "劫贡还民·截下征贡车，顶级食材物归原主",
    "拦路遇劫·同行女子身陷险境"],
  探洞地宫: ["探山洞·钟乳滴泉", "下地宫·石门锁阵", "探山洞·暗河渡险", "下地宫·长明灯阵", "探山洞·蝙蝠惊群",
    "下地宫·塌陷逃生", "探山洞·石髓采撷", "下地宫·古墓避毒", "探山洞·一线天光", "下地宫·水牢摸鱼"],
  密林采山: ["穿密林·瘴气迷途", "穿密林·兽径追踪", "采山·雨后捡菌", "采山·悬崖采药", "穿密林·藤蔓缠人",
    "采山·雪线寻莲", "穿密林·夜宿山神庙", "采山·溪边网鱼", "穿密林·蜂群夺蜜", "采山·秋风打枣",
    "悬崖失足·同行女子脚下一滑"],
  水域: ["渡口摆渡", "湖心采菱", "急流放排", "冰面凿鱼", "滩涂赶海",
    "夜钓灯下", "瀑布取泉", "沼泽采藕", "退潮拾贝", "春汛捞鲜"],
  节庆: ["赶集·庙会采买", "端午采艾", "中秋打桂花", "重阳登高采菊", "腊八熬粥备料",
    "年关宰年猪", "春社分肉", "秋收打谷", "冬至包饺子", "上元猜灯谜",
    "舌辨鸩毒·分粮宴上救寨老",
    "拆局·美食大会强征贡厨",
    "舍身试毒·护满座宾客",
    "毒疑试探·同行女子要先下筷"],
  人情: ["拜访·老厨讨教", "拜山·猎户分肉", "走亲戚·带土仪", "送菜·府衙宴", "接风·马帮洗尘",
    "谢师·送束脩", "探病·送药膳", "贺寿·做寿面", "满月·送红蛋", "吊唁·送素席",
    "代写家书·顺手留饭",
    "让灶渡人·产妇待哺",
    "替徒担责·私下补一顿",
    "喂饱逃学娃·不声张匀一口",
    "借灶还情·陌生人熬药反是故人",
    "深夜送归·夜路小状况"],
  天灾: ["山火抢收", "风雪封山抢路", "泥石流后寻人", "狼群围村护院", "夜半救火",
    "洪后捞物", "旱年寻水", "雹后抢收", "雾夜迷路", "沙暴避风",
    "施粥棚·荒年舍粮救流民",
    "辨水源·查出瘟疫病根",
    "雪夜留宿·一碗热汤救冻僵人"],
  商贸: ["行商·走村串户", "以物易物", "赊账收账", "拍卖·头彩竞价", "赶集·摆摊卖菜",
    "订购·包下果园", "预售·年菜订金", "换季·清仓甩卖", "团购·府衙采买", "尾货·收山货"],
};

// ── 英雄救美／美救英雄：这5条命中时，据点常客里随机点一位女子同行（没有就全局随便撞见一位）──
// 好感度不设门槛，0也能触发；结算成了=英雄救美，没成=美救英雄，两个方向都写得漂亮，事后都正常涨好感。
export const RESCUE_SCENARIOS = new Set([
  "拦路遇劫·同行女子身陷险境",
  "悬崖失足·同行女子脚下一滑",
  "毒疑试探·同行女子要先下筷",
  "闹市遇泼皮·登徒子对她动手动脚",
  "深夜送归·夜路小状况",
]);

// ── 周历：一轮=一周（原一轮=一天），农历节气×汉地节日×藏历康巴节庆 合一 ──
// month/part 供顶部「第N周·X月Y」展示；festivals[].strong 是 EXPEDITION_MAP 的 category 名单——
// 撞上了就「强夺舍」（探秘全程紧扣节庆写），没撞上只在探秘context里提一句当下节气（弱关联，不改情节）。
export const MONTH_NAMES = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
export const WEEK_CALENDAR = [
  /*  1 */ { month: 12, part: "初", jieqi: { name: "小寒", custom: "吃糯米饭，探梅，年味渐起，家家备腊味" } },
  /*  2 */ { month: 12, part: "上", festivals: [{ name: "腊八节", tag: "汉", custom: "腊月初八，喝腊八粥、泡腊八蒜", strong: ["市井", "人情"] }] },
  /*  3 */ { month: 12, part: "下", jieqi: { name: "大寒", custom: "尾牙祭，除旧布新，赶年集，腌腹肉灌香肠正当时" } },
  /*  4 */ { month: 12, part: "末" },
  /*  5 */ { month: 1, part: "初", jieqi: { name: "立春", custom: "咬春（吃春饼/生萝卜），鞭春牛，迎句芒神" },
    festivals: [{ name: "小年", tag: "汉", custom: "腊月廿三/廿四，祭灶王，扫尘", strong: ["市井", "人情"] }] },
  /*  6 */ { month: 1, part: "上", festivals: [
    { name: "除夕", tag: "汉", custom: "腊月三十，守岁、年夜饭", strong: ["人情", "市井"] },
    { name: "古突·驱鬼节", tag: "藏", custom: "腊月廿九夜，面疙瘩汤占卜来年", strong: ["人情"] }] },
  /*  7 */ { month: 1, part: "上", festivals: [
    { name: "春节", tag: "汉", custom: "正月初一，拜年、放鞭炮", strong: ["节庆", "人情"] },
    { name: "洛萨·藏历新年", tag: "藏", custom: "祈愿大法会（默朗木法会）起", strong: ["节庆", "人情"] }] },
  /*  8 */ { month: 1, part: "下", jieqi: { name: "雨水", custom: "拉保保——四川三百年古俗，认干爹求平安，取「雨露滋润易生长」之意，广汉至今办保保节；回娘家、接寿" },
    festivals: [
      { name: "元宵节", tag: "汉", custom: "正月十五，吃汤圆、赏灯、猜灯谜", strong: ["节庆", "市井", "人情"] },
      { name: "摆花节·酥油花灯节", tag: "藏", custom: "正月十五，僧人塑酥油花供灯，与元宵同日", strong: ["节庆", "市井"] }] },
  /*  9 */ { month: 1, part: "末" },
  /* 10 */ { month: 2, part: "初", jieqi: { name: "惊蛰", custom: "祭白虎化口舌是非，打小人，吃梨" },
    festivals: [
      { name: "龙抬头", tag: "汉", custom: "二月初二，剃龙头，吃龙须面", strong: ["节庆", "市井"] },
      { name: "送魔节·亮宝会", tag: "藏", custom: "二月初七/初八，逐村寨鬼驱邪+寺院晒珍宝法器", strong: ["节庆", "市井"] }] },
  /* 11 */ { month: 2, part: "上" },
  /* 12 */ { month: 2, part: "下", jieqi: { name: "春分", custom: "竖蛋，放风筝，吃春菜，粘雀子嘴（汤圆插田埂免雀啄种）" } },
  /* 13 */ { month: 2, part: "末", festivals: [{ name: "上巳节", tag: "汉", custom: "三月三，部分地区仍存，踏青祓禊", strong: [] }] },
  /* 14 */ { month: 3, part: "初", jieqi: { name: "清明", custom: "扫墓祭祖，踏青插柳，蹴鞠，川地兴吃清明粑（艾草粑）" },
    festivals: [{ name: "清明节", tag: "汉", custom: "与节气同日，扫墓祭祖踏青", strong: ["人情", "节庆"] }] },
  /* 15 */ { month: 3, part: "上", festivals: [{ name: "世轮金刚节", tag: "藏", custom: "时轮金刚法会，三月十五，僧众诵经祈愿", strong: ["节庆"] }] },
  /* 16 */ { month: 3, part: "下", jieqi: { name: "谷雨", custom: "摘谷雨茶，祭仓颉，走谷雨（结伴出游），香椿正当时" } },
  /* 17 */ { month: 3, part: "末" },
  /* 18 */ { month: 4, part: "初", jieqi: { name: "立夏", custom: "称人，斗蛋，尝三新" },
    festivals: [{ name: "转山会·沐佛节", tag: "康", custom: "藏历四月初八，康定跑马山转山会：祭山转山，扎帐野餐，跳锅庄弦子，跑马射箭", strong: ["节庆", "密林采山"] }] },
  /* 19 */ { month: 4, part: "上", festivals: [{ name: "转山会·沐佛节", tag: "康", custom: "跑马山转山会尾声，余兴未散", strong: ["节庆", "密林采山"] }] },
  /* 20 */ { month: 4, part: "上", festivals: [{ name: "萨嘎达瓦节", tag: "藏", custom: "四月十五，纪念释迦牟尼诞生/成佛/圆寂，全月吃素放生", strong: ["节庆"] }] },
  /* 21 */ { month: 4, part: "下", jieqi: { name: "小满", custom: "祭车神，抢水，食苦菜" } },
  /* 22 */ { month: 4, part: "末", festivals: [{ name: "逛林卡", tag: "藏", custom: "五月初一起，全民携帐入林野餐赏景，历时二十天", strong: ["密林采山", "节庆"] }] },
  /* 23 */ { month: 5, part: "初", jieqi: { name: "芒种", custom: "送花神，煮青梅，安苗祭土地祈丰收" } },
  /* 24 */ { month: 5, part: "上", festivals: [
    { name: "端午节", tag: "汉", custom: "五月初五，吃粽子、赛龙舟、挂菖蒲", strong: ["节庆", "水域"] },
    { name: "采花节", tag: "康", custom: "南坪博峪一带，与端午同日，纪念教耕织的莲芝姑娘，姑娘们上山采花两日", strong: ["节庆", "密林采山"] },
    { name: "逛林卡", tag: "藏", custom: "五月十五，全月高潮", strong: ["密林采山"] }] },
  /* 25 */ { month: 5, part: "下", jieqi: { name: "夏至", custom: "吃面（冬至饺子夏至面），祭地，川地兴过水面" } },
  /* 26 */ { month: 5, part: "末" },
  /* 27 */ { month: 6, part: "初", jieqi: { name: "小暑", custom: "食新尝新米祭祖，晒伏" } },
  /* 28 */ { month: 6, part: "上", festivals: [
    { name: "六月六", tag: "汉", custom: "晒衣节，部分地区尝新祭祖", strong: ["市井"] },
    { name: "丹伊得钦·朝山节", tag: "藏", custom: "转湖转山还愿", strong: ["密林采山", "节庆"] }] },
  /* 29 */ { month: 6, part: "上" },
  /* 30 */ { month: 6, part: "下", jieqi: { name: "大暑", custom: "饮伏茶，晒伏姜，斗蟋蟀" } },
  /* 31 */ { month: 6, part: "末", festivals: [{ name: "理塘八一赛马会", tag: "康", custom: "公历8月1日固定，源出藏历六月初三转山赛马古俗，四百余年历史，街市巡马+草原赛马", strong: ["节庆"] }] },
  /* 32 */ { month: 7, part: "初", jieqi: { name: "立秋", custom: "贴秋膘，啃秋，川地兴摸秋讨彩头" },
    festivals: [
      { name: "七夕节", tag: "汉", custom: "七月初七，乞巧", strong: ["市井", "节庆"] },
      { name: "雪顿节", tag: "藏", custom: "六月三十/七月初一，晒佛演藏戏，拉萨一带最盛，康区较淡", strong: [] }] },
  /* 33 */ { month: 7, part: "上", festivals: [
    { name: "中元节", tag: "汉", custom: "七月十五，祭祖「鬼节」", strong: ["人情"] },
    { name: "沐浴节", tag: "藏", custom: "七月六至十二日，嘎玛日吉，全家下河沐浴，历时七天", strong: ["水域"] }] },
  /* 34 */ { month: 7, part: "下", jieqi: { name: "处暑", custom: "放河灯，开渔节，吃鸭子" },
    festivals: [{ name: "望果节", tag: "藏", custom: "秋收前择吉日，绕田巡游祈丰收，过节即开镰", strong: ["节庆", "商贸"] }] },
  /* 35 */ { month: 7, part: "末", festivals: [{ name: "望果节", tag: "藏", custom: "各寨择日不同，部分延至此周", strong: ["节庆"] }] },
  /* 36 */ { month: 8, part: "初", jieqi: { name: "白露", custom: "收清露，饮白露茶，祭禹王" } },
  /* 37 */ { month: 8, part: "上", festivals: [
    { name: "中秋节", tag: "汉", custom: "八月十五，赏月吃月饼，一家团圆", strong: ["节庆", "人情"] },
    { name: "迎秋节·金马节·央勒节", tag: "康", custom: "各寨丰收节俗，择日不一，无统一藏历定日", strong: [] }] },
  /* 38 */ { month: 8, part: "上", jieqi: { name: "秋分", custom: "祭月古俗（中秋祭月即由此演变），竖蛋，吃秋菜，送秋牛图" } },
  /* 39 */ { month: 8, part: "下" },
  /* 40 */ { month: 8, part: "末", festivals: [{ name: "重阳节", tag: "汉", custom: "九月初九，登高、赏菊、插茱萸、吃重阳糕", strong: ["节庆", "密林采山"] }] },
  /* 41 */ { month: 9, part: "初", jieqi: { name: "寒露", custom: "登高赏菊，吃螃蟹，饮菊花酒，采茱萸" } },
  /* 42 */ { month: 9, part: "上" },
  /* 43 */ { month: 9, part: "下", jieqi: { name: "霜降", custom: "赏菊，吃柿子，进补（补冬不如补霜降）" } },
  /* 44 */ { month: 9, part: "末" },
  /* 45 */ { month: 10, part: "初", jieqi: { name: "立冬", custom: "补冬，北饺子南黄酒" },
    festivals: [{ name: "寒衣节", tag: "汉", custom: "十月初一，送寒衣祭祖", strong: ["人情"] }] },
  /* 46 */ { month: 10, part: "上" },
  /* 47 */ { month: 10, part: "下", jieqi: { name: "小雪", custom: "腌腹肉，晒鱼干，酿酒——灌香肠腌腊味的旺季" } },
  /* 48 */ { month: 10, part: "末" },
  /* 49 */ { month: 11, part: "初", jieqi: { name: "大雪", custom: "腌肉，进补，瑞雪兆丰年" } },
  /* 50 */ { month: 11, part: "上", festivals: [{ name: "仙女节·白拉姆节", tag: "藏", custom: "十月十五，妇女向护法女神献祭祈福", strong: ["节庆"] }] },
  /* 51 */ { month: 11, part: "下", jieqi: { name: "冬至", custom: "祭祖，北饺子南汤圆，冬至大如年，数九起" },
    festivals: [{ name: "燃灯节", tag: "藏", custom: "十月二十五，宗喀巴圆寂纪念日，家家屋顶点酥油灯", strong: ["节庆", "人情"] }] },
  /* 52 */ { month: 11, part: "末" },
];

// day 是累加的轮次计数（原「第几天」，现「第几周」），按 52 周循环取周历内容——超过52自然进入下一年循环。
export function weekCalOf(day) {
  const idx = ((((day - 1) % 52) + 52) % 52);
  return WEEK_CALENDAR[idx];
}
// 当下节气：找不到当周的就往前找最近一次生效的（节气是延续到下个节气前的一段时节，不是单日）
export function currentJieqiName(day) {
  for (let back = 0; back < 52; back++) {
    const e = weekCalOf(day - back);
    if (e.jieqi) return e.jieqi.name;
  }
  return null;
}
// 顶部展示用：「X月Y」，不含「第N周」（那部分由调用处自己拼，好复用同一份 st.day 数字）
export function weekLabel(day) {
  const e = weekCalOf(day);
  return `${MONTH_NAMES[e.month - 1]}${e.part}`;
}
// 探秘据点×当周历法：撞上强关联就整段节庆背景，没撞上就一句当下节气弱提示
export function calendarContextFor(day, category) {
  const e = weekCalOf(day);
  const matched = (e.festivals || []).filter(f => (f.strong || []).includes(category));
  if (matched.length) {
    return {
      strong: true,
      scenario: matched.map(f => f.name).join("·"),
      text: matched.map(f => `${f.name}（${f.tag}俗）：${f.custom}`).join("；"),
    };
  }
  const jn = currentJieqiName(day);
  if (!jn) return { strong: false, scenario: null, text: null };
  const je = e.jieqi ? e.jieqi.custom : null;
  return { strong: false, scenario: null, text: `当下节气「${jn}」${je ? "：" + je : ""}` };
}

// ── 探秘维度系统（玩家不可见，AI出题+系统判定用；设计见 docs/探秘系统设计.md）──
// 维度只决定"这题在考什么"，不出现在题干文本里。四类分组用于抽题时保证不重复类别。
export const DIMENSION_GROUPS = ["身法", "硬功", "智谋", "心性"];
export const DIMENSIONS = {
  轻功: { group: "身法", skillKey: "轻功", hint: "崖壁、独木、浮桥、树梢" },
  投掷: { group: "身法", skillKey: "投掷", hint: "够不着的东西、暗器、勾索" },
  武艺: { group: "硬功", skillKey: null, hint: "拦路的人/兽、需要硬碰" }, // 判定取刀法/剑法/拳掌/枪法最高者
  内功: { group: "硬功", skillKey: "内功", hint: "寒气、毒瘴、水底、暗劲" },
  眼力: { group: "智谋", skillKey: "眼力", hint: "雾气、灰烬、药草、赝品" },
  见识: { group: "智谋", skillKey: "见识", hint: "认不得的兽迹、碑文、异味", icon: "favicon_jian_shi.png" },
  口才: { group: "心性", skillKey: "口才", hint: "守门人、市侩、赌局", icon: "favicon_kou_cai.png" },
  胆识: { group: "心性", skillKey: "胆识", hint: "阴风、尸骸、深不见底" },
  赌博: { group: "心性", skillKey: "赌博", hint: "骰盅、庄家、输赢一线", icon: "favicon_du_bo.png" }, // 骰子检定维度，熟能生巧（见 state.js checks）
};
// 非常规维度：不进常规抽取池，按概率附加在主维度之外
export const SPECIAL_DIMENSIONS = {
  资源: { hint: "靠包里的东西过——绳索/药/火折子/银钱，不检定，直接扣" },
  苏唐: { hint: "靠苏唐的手艺或好感过（协作）" },
};

// ── 探秘任务类型：七大类，出题时给AI的情境倾向（张力+典型场景）────
export const EXPEDITION_TASK_TYPES = {
  穿行: { dims: ["轻功", "胆识", "资源"], tension: "过不过得去", examples: "渡河、攀崖、走索桥、踏冰" },
  探寻: { dims: ["眼力", "见识", "苏唐"], tension: "找不找得到、认不认得", examples: "山洞、密林、地宫、废村" },
  交锋: { dims: ["武艺", "口才", "胆识"], tension: "打得过还是谈得拢", examples: "劫镖、拦路、野兽、劫匪" },
  市井: { dims: ["口才", "赌博", "眼力", "资源"], tension: "值不值、上不上当", examples: "讨价还价、黑市、赌局、酒馆" },
  造化: { dims: ["见识", "赌博", "胆识"], tension: "认不认得宝、取不取", examples: "奇遇、天材地宝、野味、古物" },
  夜行: { dims: ["胆识", "内功"], tension: "赶路还是停", examples: "天黑、涨潮、雨季、灯油将尽" },
  协作: { dims: ["苏唐", "赌博", "口才"], tension: "信不信她、怎么分工", examples: "双人配合、她掌锅你探路" },
};
// 地图据点 category（EXP_SCEN_BY_CAT 的key）→ 候选任务类型池，决定该据点抽题时任务类型的取值范围
export const CATEGORY_TASK_TYPES = {
  探洞地宫: ["探寻"],
  天灾: ["夜行"],
  密林采山: ["探寻", "穿行"],
  奇遇: ["造化"],
  劫镖江湖: ["交锋"],
  水域: ["穿行"],
  市井: ["市井"],
  节庆: ["协作"],
  人情: ["协作"],
  商贸: ["市井"],
};

// ── 选项类别库：8种动作原型，AI出选项从这里挑，每道题至少含1个"智察"类──
export const OPTION_ARCHETYPES = {
  强攻: { checks: ["武艺"], resolve: "roll", reward: "高", risk: "失败伤血" },
  巧取: { checks: ["轻功", "投掷"], resolve: "roll", reward: "中", risk: "失败落空不伤" },
  智察: { checks: ["眼力", "见识"], resolve: "roll", reward: "解锁隐藏选项", risk: "无" },
  口舌: { checks: ["口才"], resolve: "roll", reward: "省资源", risk: "失败降好感" },
  资源: { checks: [], resolve: "consume", reward: "直接过", risk: "消耗道具/银钱" },
  借苏唐: { checks: ["苏唐"], resolve: "roll", reward: "苏唐长经验", risk: "消耗好感" },
  回避: { checks: [], resolve: "none", reward: "无", risk: "错过收获，可能耗时" },
  赌运: { checks: ["赌博"], resolve: "roll", reward: "高", risk: "高风险" },
};
