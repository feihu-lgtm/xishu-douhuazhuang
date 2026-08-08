// 西蜀豆花庄 · 灶边留声（BGM）
// 循环播放，设置弹窗里可调：曲目 / 音量 / 循环开关 / 启停。
// 偏好存 localStorage（xiaochu.bgm.v1），不开自动播放——浏览器会拦，开一局自己点。

export const BGM_TRACKS = [
  { id: "yema",     name: "空山·野马",     artist: "Bethybai / 岸炘", src: "./assets/music/kongshan_yema.mp3" },
  { id: "hexi",     name: "河西走廊之梦",   artist: "Yanni",           src: "./assets/music/hexi_zoulang_zhi_meng.mp3" },
  { id: "yehang",   name: "夜航星",         artist: "不才（蔡明希）",   src: "./assets/music/yehangxing.mp3" },
  { id: "suifeng",  name: "随风而逝",       artist: "程池",             src: "./assets/music/suifeng_ershi.mp3" },
  { id: "qiuzi",    name: "一个人的龟兹",   artist: "程池",             src: "./assets/music/yigeren_de_qiuzi.mp3" },
  { id: "heiniu",   name: "黑牦牛（藏语）", artist: "朋措达杰",         src: "./assets/music/heimaoniu.mp3" },
];

const KEY = "xiaochu.bgm.v1";
const DEFAULT = { on: false, idx: 0, vol: 0.6, loop: true };
let pref = { ...DEFAULT };
try {
  pref = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) };
} catch { /* 脏数据兜底 */ }

let audio = null;
function el() {
  if (!audio) {
    audio = new Audio();
    audio.loop = pref.loop;
    audio.volume = Math.max(0, Math.min(1, pref.vol));
    audio.preload = "auto";
    audio.style.display = "none";
    document.body.appendChild(audio);
  }
  return audio;
}
const save = () => localStorage.setItem(KEY, JSON.stringify(pref));

// 返回设置 UI 用的当前状态快照
export const bgmState = () => ({ ...pref });

export function bgmPlay(i = pref.idx) {
  pref.idx = ((i % BGM_TRACKS.length) + BGM_TRACKS.length) % BGM_TRACKS.length;
  pref.on = true;
  const a = el();
  a.src = BGM_TRACKS[pref.idx].src;
  a.loop = pref.loop;
  a.volume = pref.vol;
  a.play().catch(() => { pref.on = false; }); // 被浏览器拦（非手势）就安静退回
  save();
  return bgmState();
}

export function bgmPause() {
  pref.on = false;
  if (audio) audio.pause();
  save();
  return bgmState();
}

export function bgmToggle() {
  return pref.on ? bgmPause() : bgmPlay();
}

export function bgmNext() {
  return bgmPlay(pref.idx + 1);
}
export function bgmPrev() {
  return bgmPlay(pref.idx - 1);
}

export function bgmSetVolume(v) {
  pref.vol = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = pref.vol;
  save();
  return bgmState();
}

export function bgmSetLoop(b) {
  pref.loop = !!b;
  if (audio) audio.loop = pref.loop;
  save();
  return bgmState();
}

// 恢复上次状态：能自动播就续上；被浏览器拦（无手势）就退回暂停，别假装在放
export function bgmInit() {
  if (!pref.on) return;
  el();
  const a = audio;
  a.play().then(() => { pref.on = true; save(); }).catch(() => { pref.on = false; save(); });
}
