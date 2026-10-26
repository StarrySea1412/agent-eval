// 拼接单文件站点：head + style + hero + 七章 + 结语 + footer + demos.js
// 用法：node build/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const style = read("build/style.css");
const hero = read("build/hero.html");
const chapters = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7"]
  .map((n) => read(`build/${n}.html`)).join("\n");
const footer = read("build/footer.html");
const js = read("build/demos.js");
const data = read("build/data.json");

const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="theme-color" content="#f2f3ee"/>
<link rel="preload" href="assets/fonts/wenkai-regular.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23f2f3ee'/%3E%3Crect x='3' y='17.5' width='18' height='1.3' fill='%232f6f57'/%3E%3Crect x='5' y='9' width='2.4' height='8.5' fill='none' stroke='%232f6f57' stroke-width='1.2'/%3E%3Crect x='10.8' y='5' width='2.4' height='12.5' fill='none' stroke='%232f6f57' stroke-width='1.2'/%3E%3Crect x='16.6' y='11.5' width='2.4' height='6' fill='none' stroke='%232f6f57' stroke-width='1.2'/%3E%3Ccircle cx='12' cy='3' r='1.3' fill='%239c3b2e'/%3E%3C/svg%3E"/>
<meta name="description" content="给 Agent 打分：评测不是分数，是一场可复现的实验。金标准、判分器、置信区间、受控重跑与发布门禁——SeeFlow 评测设施的深度解剖，附四枚可玩小样。"/>
<meta name="author" content="StarrySea1412"/>
<meta property="og:title" content="给 Agent 打分 · 造物手记 VOL.06"/>
<meta property="og:description" content="同一份输出，三种判分器给出 0/19、3/19、5/19。分数不是一个数，是一个区间。"/>
<meta property="og:type" content="article"/>
<meta property="og:image" content="assets/art/hero.webp"/>
<title>给 Agent 打分 · 造物手记 VOL.06</title>
<style>
${style}
</style>
</head>
<body>
<div class="progress" id="progress"></div>
`;
const tail = `
<script>
const EVAL_DATA = ${data};
${js}
</script>
</body>
</html>
`;

const html = head + hero + "\n<main>\n" + chapters + "\n</main>\n" + footer + tail;
writeFileSync(join(root, "index.html"), html, "utf8");
console.log(`built index.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
