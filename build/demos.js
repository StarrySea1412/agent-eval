/* 四枚确定性小样 + 阅读进度条（零依赖，全部原生 DOM）。 */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";

  const prog = $("#progress");
  if (prog) {
    const paint = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      prog.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
    };
    addEventListener("scroll", paint, { passive: true });
    addEventListener("resize", paint, { passive: true });
    paint();
  }

  /* ── 公共：bigram（与 eval/run.py 同构） ── */
  const norm = (text) => String(text).toLowerCase().match(/[\u4e00-\u9fff a-z0-9]+/g)?.join("") || "";
  const grams = (text) => {
    const s = norm(text);
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const bigram = (a, b) => {
    const ga = grams(a);
    if (!ga.length) return 0;
    const gb = new Set(grams(b));
    let hit = 0;
    for (const g of ga) if (gb.has(g)) hit++;
    return hit / ga.length;
  };
  const tokens = (text) => new Set((String(text).toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g) || []));
  const jaccard = (a, b) => {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    return inter / (A.size + B.size - inter);
  };
  const fmtT = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.round(t % 60)).padStart(2, "0");
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ══════ DEMO 01 · 置信区间尺 ══════ */
  (() => {
    const root = $("#demo-ci"); if (!root) return;
    const elN = $("#ci-n"), elK = $("#ci-k"), elK2 = $("#ci-k2");
    const outRows = $("#ci-rows"), outGrid = $("#ci-grid"), outTicks = $("#ci-ticks");
    const outPa = $("#ci-pa"), outPb = $("#ci-pb"), outIa = $("#ci-ia"), outIb = $("#ci-ib");
    const outOverlap = $("#ci-overlap"), outConclusion = $("#ci-conclusion"), outVerdict = $("#ci-verdict"), outNeed = $("#ci-need");

    function wilson(k, n, z = 1.96) {
      if (!n) return [0, 1];
      const p = k / n, d = 1 + z * z / n;
      const c = (p + z * z / (2 * n)) / d;
      const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
      return [Math.max(0, c - h), Math.min(1, c + h)];
    }

    function render() {
      const n = +elN.value;
      elK.max = String(n); elK2.max = String(n);
      if (+elK.value > n) elK.value = String(n);
      if (+elK2.value > n) elK2.value = String(n);
      const ka = +elK.value, kb = +elK2.value;
      $("#ci-n-v").textContent = n;
      $("#ci-k-v").textContent = ka;
      $("#ci-k2-v").textContent = kb;
      const A = wilson(ka, n), B = wilson(kb, n);
      outPa.textContent = pct(ka / n); outPb.textContent = pct(kb / n);
      outIa.textContent = pct(A[0]) + "–" + pct(A[1]);
      outIb.textContent = pct(B[0]) + "–" + pct(B[1]);
      const overlap = A[0] <= B[1] && B[0] <= A[1];
      outOverlap.textContent = overlap ? "是" : "否";
      outConclusion.textContent = overlap ? "不成立" : "可区分（保守）";
      const need = Math.ceil(1.96 * 1.96 * 0.8 * 0.2 / (0.1 * 0.1));
      outNeed.textContent = need + " 条";
      outVerdict.textContent = overlap
        ? "两个区间重叠：这点差异完全可能是抽样噪声，不能宣称 B 更好。"
        : "两个 95% 区间不重叠：差异不太可能纯由抽样造成（保守近似，不是正式检验）。";

      outRows.innerHTML = "";
      const rows = [["A", A, ka / n, "a"], ["B", B, kb / n, "b"]];
      rows.forEach(([lbl, ci, p, cls], i) => {
        const row = document.createElement("div");
        row.className = "ci-row";
        row.style.top = (18 + i * 62) + "px";
        row.innerHTML = `<span class="lbl">${lbl}</span>
          <span class="ci-bar ${cls}" style="left:${ci[0] * 100}%;width:${Math.max(0.4, (ci[1] - ci[0]) * 100)}%"></span>
          <span class="ci-dot" style="left:${p * 100}%"></span>`;
        outRows.appendChild(row);
      });
      outGrid.innerHTML = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) =>
        `<i style="left:${v}%"></i>`).join("");
      outTicks.innerHTML = [0, 20, 40, 60, 80, 100].map((v) =>
        `<span class="ci-tick" style="left:calc(36px + (100% - 50px) * ${v / 100})">${v}%</span>`).join("");
    }

    $("#ci-presets").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]"); if (!b) return;
      $$("#ci-presets button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const [a, c, n] = b.dataset.p.split(",").map(Number);
      elN.value = String(n); elK.value = String(a); elK2.value = String(c);
      render();
    });
    [elN, elK, elK2].forEach((el) => el.addEventListener("input", () => {
      $$("#ci-presets button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      render();
    }));
    render();
  })();

  /* ══════ DEMO 02 · 判分器对照台 ══════ */
  (() => {
    const root = $("#demo-judge"); if (!root) return;
    const GOLD = EVAL_DATA.gold, PRED = EVAL_DATA.pred;
    const state = { mode: "bigram", window: 15, th: 0.25 };
    const outList = $("#judge-list"), outScore = $("#judge-score"), outRate = $("#judge-rate");
    const outDef = $("#judge-def"), outFp = $("#judge-fp");

    const DEFS = {
      exact: "预测文本与金标准逐字相同（忽略空白）；不设时间窗",
      time: "±窗口内有任意一条预测即命中；完全不看内容",
      bigram: "bigram ≥ 阈值，且 |Δt| ≤ 窗口；每条金标准只能被一条预测认领",
      jaccard: "词元集合 Jaccard ≥ 阈值，且 |Δt| ≤ 窗口"
    };

    function scoreOne(g, p) {
      const dt = Math.abs(p.t - g.t);
      if (state.mode === "exact") return { hit: norm(g.text) === norm(p.text), s: norm(g.text) === norm(p.text) ? 1 : 0, dt };
      if (dt > state.window) return { hit: false, s: 0, dt };
      if (state.mode === "time") return { hit: true, s: 1, dt };
      const s = state.mode === "jaccard" ? jaccard(g.text, p.text) : bigram(g.text, p.text);
      return { hit: s >= state.th, s, dt };
    }

    function render() {
      const used = new Set();
      const rows = [];
      let hits = 0, fp = 0;
      GOLD.forEach((g) => {
        let best = null;
        PRED.forEach((p, i) => {
          if (used.has(i)) return;
          if (state.mode !== "exact" && Math.abs(p.t - g.t) > state.window) return;
          const r = scoreOne(g, p);
          if (!best || r.s > best.s || (r.s === best.s && r.dt < best.dt)) best = { p, i, ...r };
        });
        if (best && best.hit) {
          used.add(best.i); hits++;
          if (state.mode === "time") {
            const near = PRED.filter((q) => Math.abs(q.t - g.t) <= state.window);
            const bestContent = near.length ? Math.max(...near.map((q) => bigram(g.text, q.text))) : 0;
            if (bestContent < 0.25) fp++;
          }
          rows.push({ g, p: best.p, s: best.s, dt: best.dt, hit: true });
        } else {
          rows.push({ g, p: null, hit: false });
        }
      });
      outList.innerHTML = rows.map((r) => `
        <div class="jrow ${r.hit ? "hit" : "miss"}">
          <span class="t">${fmtT(r.g.t)}</span>
          <span><span class="g">${r.g.text}</span>
            ${r.p ? `<span class="p">↳ ${r.p.text}${r.hit && state.mode !== "exact" && state.mode !== "time" ? ` · 相似 ${r.s.toFixed(3)} · Δt ${r.dt.toFixed(0)}s` : ""}</span>` : ""}
          </span>
          <span class="mark">${r.hit ? "HIT" : "MISS"}</span>
        </div>`).join("");
      outScore.innerHTML = hits + " <small>/ " + GOLD.length + "</small>";
      outRate.textContent = pct(hits / GOLD.length);
      outDef.textContent = DEFS[state.mode];
      outFp.textContent = String(fp);
      $("#judge-window-v").textContent = "±" + state.window + "s";
      $("#judge-th-v").textContent = state.th.toFixed(2);
    }

    $("#judge-modes").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-j]"); if (!b) return;
      state.mode = b.dataset.j;
      $$("#judge-modes button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
    $("#judge-window").addEventListener("input", (e) => { state.window = +e.target.value; render(); });
    $("#judge-th").addEventListener("input", (e) => { state.th = +e.target.value; render(); });
    render();
  })();

  /* ══════ DEMO 03 · 重复运行 ══════ */
  (() => {
    const root = $("#demo-runs"); if (!root) return;
    const elP = $("#runs-p"), elN = $("#runs-n"), elTotal = $("#runs-total");
    const outPlot = $("#runs-plot"), outNote = $("#runs-note");
    let seed = 2026;

    function sampleBinomial(n, p, rnd) {
      let k = 0;
      for (let i = 0; i < n; i++) if (rnd() < p) k++;
      return k;
    }

    function render() {
      const p = +elP.value, runs = +elN.value, total = +elTotal.value;
      $("#runs-p-v").textContent = p.toFixed(2);
      $("#runs-n-v").textContent = runs;
      $("#runs-total-v").textContent = total;
      const rnd = mulberry32(seed);
      const vals = Array.from({ length: runs }, () => sampleBinomial(total, p, rnd) / total);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)) : null;
      const se = sd === null ? null : sd / Math.sqrt(vals.length);
      const lo = se === null ? mean : Math.max(0, mean - 1.96 * se);
      const hi = se === null ? mean : Math.min(1, mean + 1.96 * se);
      const min = Math.min(...vals), max = Math.max(...vals);

      outPlot.innerHTML = "";
      const band = document.createElement("div");
      band.className = "runs-band";
      band.style.bottom = (26 + lo * 130) + "px";
      band.style.height = ((hi - lo) * 130) + "px";
      outPlot.appendChild(band);
      const meanLine = document.createElement("div");
      meanLine.className = "runs-mean";
      meanLine.style.bottom = (26 + mean * 130) + "px";
      outPlot.appendChild(meanLine);
      vals.forEach((v, i) => {
        const dot = document.createElement("div");
        dot.className = "runs-dot";
        dot.style.left = (8 + (i / Math.max(1, vals.length - 1)) * 84) + "%";
        dot.style.bottom = (26 + v * 130) + "px";
        dot.title = "第 " + (i + 1) + " 次：" + pct(v);
        outPlot.appendChild(dot);
      });
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        const lab = document.createElement("span");
        lab.className = "runs-label";
        lab.style.left = "6px";
        lab.style.bottom = (20 + v * 130) + "px";
        lab.textContent = Math.round(v * 100) + "%";
        outPlot.appendChild(lab);
      });

      $("#runs-mean").textContent = pct(mean);
      $("#runs-sd").textContent = sd === null ? "—" : pct(sd);
      $("#runs-min").textContent = pct(min);
      $("#runs-max").textContent = pct(max);
      outNote.textContent = sd === null
        ? "只跑了一次：这是「一个样本」，不是「这个系统的水平」。"
        : `单次范围 ${pct(min)}–${pct(max)}；${runs} 次均值 ${pct(mean)}，95% 区间 ${pct(lo)}–${pct(hi)}。` +
          (runs < 8 ? " 次数太少，均值本身仍然很飘。" : " 均值开始稳定，但仍不等于「真实能力」——系统性偏差还在。");
    }

    $("#runs-seed").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-s]"); if (!b) return;
      seed = b.dataset.s === "2" ? 7 : 2026;
      $$("#runs-seed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
    [elP, elN, elTotal].forEach((el) => el.addEventListener("input", render));
    render();
  })();

  /* ══════ DEMO 04 · 发布门禁 ══════ */
  (() => {
    const root = $("#demo-gate"); if (!root) return;
    const gates = $$("#gates .gate");
    const outV = $("#gate-v"), outWhy = $("#gate-why");
    const state = { contract: true, golden: true, quality: true, human: false };
    const WHY = {
      contract: "合同测试失败：代码不允许合并，谈质量没有意义。",
      golden: "金标准回归未达标：内容覆盖退步，先修管线再谈发布。",
      quality: "质量门 fail：报告存在结构性错误（缺时间戳或时间戳越界），必须修复。",
      human: "人工复核未完成：金标准与质量门通过，只能说明「机器没坏、产物像话」，不能替代人对内容的判断。"
    };
    function render() {
      gates.forEach((g) => {
        const key = g.dataset.g;
        g.classList.toggle("pass", state[key]);
        g.classList.toggle("fail", !state[key]);
        g.querySelector(".st").textContent = state[key] ? "PASS" : "FAIL";
      });
      const all = Object.values(state).every(Boolean);
      outV.textContent = all ? "SHIP" : "BLOCK";
      outV.className = "v " + (all ? "ship" : "block");
      outWhy.textContent = all
        ? "四道门全过：合同测试、金标准回归、质量门、人工复核均通过，允许发布。"
        : WHY[Object.keys(state).find((k) => !state[k])];
    }
    gates.forEach((g) => g.addEventListener("click", () => {
      state[g.dataset.g] = !state[g.dataset.g];
      render();
    }));
    render();
  })();
})();
