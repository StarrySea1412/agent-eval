// 本地无头验收（VOL.06）：四枚小样逐状态、错误收集、移动端溢出
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("D:/project/machine-skill/node_modules/");
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "shots");
await mkdir(shots, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const file = join(root, p === "/" ? "index.html" : p);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
console.log("serving", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const font = await page.evaluate(() => document.fonts.check('16px "LXGW WenKai"'));
const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute("src"), ok: i.naturalWidth > 0 })));
console.log("font:", font, "| images:", imgs.length, "| broken:", imgs.filter((i) => !i.ok).map((i) => i.src).join(",") || "none");
await page.screenshot({ path: join(shots, "00-hero.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });

async function shot(sel, name, fn) {
  const el = await page.$(sel);
  await el.scrollIntoViewIfNeeded();
  if (fn) await fn();
  await page.waitForTimeout(150);
  const box = await el.boundingBox();
  await page.screenshot({ path: join(shots, name), clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: Math.min(1440, box.width + 12), height: Math.min(2000, box.height + 12) } });
}

/* D1 */
const ci = async (name, n, a, b) => {
  await page.evaluate(([n, a, b]) => {
    const set = (id, v) => { const e = document.querySelector(id); e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); };
    set("#ci-n", n); set("#ci-k", a); set("#ci-k2", b);
  }, [n, a, b]);
  await page.waitForTimeout(100);
  await shot("#demo-ci", name);
  console.log("ci", n, a, b, await page.evaluate(() => ({
    pa: document.querySelector("#ci-pa").textContent, ia: document.querySelector("#ci-ia").textContent,
    pb: document.querySelector("#ci-pb").textContent, ib: document.querySelector("#ci-ib").textContent,
    overlap: document.querySelector("#ci-overlap").textContent,
  })));
};
await ci("01-ci-default.png", 19, 3, 5);
await ci("02-ci-15-12.png", 19, 15, 12);
await ci("03-ci-62.png", 62, 55, 62);
await ci("04-ci-n5.png", 5, 0, 5);

/* D2 */
const judge = async (mode, name, win = 15, th = 0.25) => {
  await page.evaluate(([mode, win, th]) => {
    const b = document.querySelector(`#judge-modes button[data-j="${mode}"]`); b.click();
    const w = document.querySelector("#judge-window"); w.value = String(win); w.dispatchEvent(new Event("input", { bubbles: true }));
    const t = document.querySelector("#judge-th"); t.value = String(th); t.dispatchEvent(new Event("input", { bubbles: true }));
  }, [mode, win, th]);
  await page.waitForTimeout(120);
  await shot("#demo-judge", name);
  console.log("judge", mode, win, th, await page.evaluate(() => ({
    score: document.querySelector("#judge-score").textContent.trim().replace(/\s+/g, " "),
    rate: document.querySelector("#judge-rate").textContent,
    fp: document.querySelector("#judge-fp").textContent,
  })));
};
await judge("exact", "05-judge-exact.png");
await judge("time", "06-judge-time.png");
await judge("bigram", "07-judge-bigram.png");
await judge("jaccard", "08-judge-jaccard.png");
await judge("bigram", "09-judge-window30.png", 30, 0.15);

/* D3 */
const runs = async (name, p, n, total, seedBtn) => {
  await page.evaluate(([p, n, total, seedBtn]) => {
    if (seedBtn) document.querySelector(`#runs-seed button[data-s="${seedBtn}"]`).click();
    const set = (id, v) => { const e = document.querySelector(id); e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); };
    set("#runs-p", p); set("#runs-n", n); set("#runs-total", total);
  }, [p, n, total, seedBtn]);
  await page.waitForTimeout(120);
  await shot("#demo-runs", name);
  console.log("runs", p, n, total, await page.evaluate(() => ({
    mean: document.querySelector("#runs-mean").textContent,
    sd: document.querySelector("#runs-sd").textContent,
    min: document.querySelector("#runs-min").textContent,
    max: document.querySelector("#runs-max").textContent,
    note: document.querySelector("#runs-note").textContent,
  })));
};
await runs("10-runs-default.png", 0.8, 12, 19);
await runs("11-runs-single.png", 0.8, 1, 19);
await runs("12-runs-60.png", 0.8, 60, 19, "2");
await runs("13-runs-p60.png", 0.6, 30, 19);

/* D4 */
const gate = async (name, states) => {
  await page.evaluate((states) => {
    const map = { contract: 0, golden: 1, quality: 2, human: 3 };
    document.querySelectorAll("#gates .gate").forEach((g) => {
      const want = states[map[g.dataset.g]];
      const isPass = g.classList.contains("pass");
      if (Boolean(want) !== isPass) g.click();
    });
  }, states);
  await page.waitForTimeout(100);
  await shot("#demo-gate", name);
  console.log("gate", states.join(""), await page.evaluate(() => ({
    v: document.querySelector("#gate-v").textContent,
    why: document.querySelector("#gate-why").textContent,
  })));
};
await gate("14-gate-block.png", [1, 1, 1, 0]);
await gate("15-gate-ship.png", [1, 1, 1, 1]);
await gate("16-gate-quality-fail.png", [1, 1, 0, 1]);

/* mobile */
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
mobile.on("pageerror", (e) => errors.push("mobile pageerror: " + e.message));
await mobile.goto(base, { waitUntil: "networkidle" });
await mobile.evaluate(() => document.fonts.ready);
await mobile.screenshot({ path: join(shots, "17-mobile-hero.png") });
for (const [sel, name] of [["#demo-ci", "18-mobile-ci.png"], ["#demo-judge", "19-mobile-judge.png"], ["#demo-runs", "20-mobile-runs.png"], ["#demo-gate", "21-mobile-gate.png"]]) {
  const el = await mobile.$(sel);
  await el.scrollIntoViewIfNeeded();
  await mobile.waitForTimeout(120);
  const box = await el.boundingBox();
  await mobile.screenshot({ path: join(shots, name), clip: { x: 0, y: Math.max(0, box.y), width: 390, height: Math.min(900, box.height) } });
}
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log("mobile overflow:", overflow);
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
server.close();
