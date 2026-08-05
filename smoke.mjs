// 端到端冒烟：借 qucuo 的 playwright，真浏览器走一天流程
import { createRequire } from "module";
import { startServer } from "./server.mjs";
const require = createRequire("/Users/sagev/Documents/Default Project/qucuo/package.json");
const { chromium } = require("playwright");

const PORT = 8743;
const OUT = "/var/folders/xp/xb0k04_16ws_129w6ybfwj000000gn/T/opencode";
const server = startServer(PORT);

await new Promise(r => setTimeout(r, 300));
const errors = [];
let browser;
let page;
try {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on("pageerror", e => errors.push("[pageerror] " + e.message));
  page.on("console", m => {
    // 无密钥检索模型时的 401 是预期探针，不算失败
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push("[console] " + m.text());
  });

  await page.goto(`http://localhost:${PORT}`, { waitUntil: "load" });
  await page.click("#btn-new");
  await page.waitForSelector("#guestcard .gname", { timeout: 8000 });
  const g1 = await page.textContent("#guestcard .gname");
  console.log("guest1:", g1);

  const servedCount = () => page.evaluate(() =>
    (document.querySelector("#log").textContent.match(/文铜钱/g) || []).length);
  const modalClosed = () => page.waitForFunction(() =>
    !document.querySelector("#modal-root").classList.contains("open"), null, { timeout: 8000 });
  const waitServed = (n) => page.waitForFunction((k) =>
    (document.querySelector("#log").textContent.match(/文铜钱/g) || []).length >= k, n, { timeout: 15000 });

  // ── 第一客：命中配方 牦牛骨汤 ──
  await page.click('#side [data-act="cook"]');
  await page.waitForSelector(".ck-mat");
  await page.click('.ck-mat[data-mat="牦牛腱子肉"]');
  await page.click('.ck-mat[data-mat="贡措海盐"]');
  const pred = await page.textContent(".ck-scroll");
  if (!pred.includes("牦牛骨汤")) throw new Error("预测未命中配方: " + pred);
  await page.screenshot({ path: `${OUT}/xc-cook.png` });
  await page.click("[data-fire]");
  await modalClosed();
  await page.waitForFunction(() => document.querySelector("#log").textContent.includes("出锅"), null, { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/xc-main.png` });
  await page.waitForSelector(".entry.comment", { timeout: 8000 });
  const bg = await page.evaluate(() => document.querySelector("#sutang")?.style.backgroundPosition);
  if (!bg) throw new Error("左栏表情未切换");
  await page.click('#side [data-act="serve"]');
  await waitServed(1);

  // ── 第二、三客：妙手偶得 ──
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector("#guestcard .gname");
    await page.click('#side [data-act="cook"]');
    await page.waitForSelector(".ck-mat");
    await page.click(".ck-mat:not(.zero)");
    await page.click("[data-fire]");
    await modalClosed();
    await page.click('#side [data-act="serve"]');
    await waitServed(i + 2);
  }

  // ── 收功：市集不自动开，手动进出，下一日才翻篇 ──
  await page.waitForSelector('#side [data-act="next"]:not(.disabled)', { timeout: 8000 });
  if (await page.$(".shop-grid")) throw new Error("市集不应自动弹出");
  await page.click('#side [data-act="shop"]:not(.disabled)');
  await page.waitForSelector(".shop-grid", { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/xc-shop.png` });
  await page.click('[data-tab="ingredient"]');
  const coinsBefore = await page.textContent("#status");
  await page.click('[data-buy="贡措海盐"]');
  const coinsAfter = await page.textContent("#status");
  if (coinsBefore === coinsAfter) throw new Error("购买未扣钱");
  await page.click("[data-leave]");
  // 返回后仍可再进
  await page.waitForSelector('#side [data-act="shop"]:not(.disabled)');
  await page.click('#side [data-act="shop"]');
  await page.waitForSelector(".shop-grid", { timeout: 8000 });
  await page.click("[data-leave]");
  // 下一日
  await page.click('#side [data-act="next"]');

  // ── 第二天 + 终端命令 ──
  await page.waitForFunction(() => document.querySelector("#log").textContent.includes("第 2 天"), null, { timeout: 8000 });
  await page.fill("#cmd", "帮助");
  await page.press("#cmd", "Enter");
  await page.waitForSelector("#modal-root .modal h2");
  await page.click('#modal-root [data-back]');

  // 设置：流式默认开；无密钥检索应报失败
  console.log("stage: settings");
  await page.click('#side [data-act="settings"]');
  await page.waitForSelector("#set-stream");
  if (!(await page.isChecked("#set-stream"))) throw new Error("流式未默认打开");
  if ((await page.inputValue("#set-dish")) !== "360") throw new Error("出菜字数默认应为360");
  if ((await page.inputValue("#set-chat")) !== "160") throw new Error("闲聊字数默认应为160");
  await page.click("[data-fetch]");
  await page.waitForFunction(() =>
    (document.querySelector("#set-msg")?.textContent || "").includes("检索失败"),
    null, { timeout: 20000 });
  await page.click('#modal-root [data-back]');

  console.log("stage: prefill");
  // 说「做 牦牛骨汤」→ 灶台自动备料
  await page.fill("#cmd", "做 牦牛骨汤");
  await page.press("#cmd", "Enter");
  await page.waitForSelector(".ck-slots");
  const pre = await page.textContent(".ck-scroll");
  if (!pre.includes("牦牛骨汤")) throw new Error("口述备料未命中: " + pre);
  await page.click("[data-back]");

  console.log("stage: reload");
  // 读档：刷新 → 继续
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#btn-cont", { state: "visible" });
  await page.click("#btn-cont");
  await page.waitForFunction(() => document.querySelector("#status").textContent.includes("第2天")
    || document.querySelector("#status").textContent.includes("第 2 天"), null, { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/xc-day2.png` });

  console.log("stage: done");
  console.log("SMOKE PASS");
} catch (e) {
  console.error("SMOKE FAIL:", e.message);
  try {
    const dbg = await page.evaluate(() => ({
      modalClass: document.querySelector("#modal-root").className,
      modalHead: document.querySelector("#modal-root").innerHTML.slice(0, 400),
      logTail: document.querySelector("#log").textContent.slice(-300),
    }));
    console.error("DBG", JSON.stringify(dbg, null, 2));
  } catch { /* noop */ }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server.close();
}
if (errors.length) {
  console.error("PAGE ERRORS:\n" + errors.join("\n"));
  process.exitCode = 1;
}
