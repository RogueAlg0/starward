// Headless Chromium drive-through for WARBOUND.
// Drives muster -> garrison -> campaign (all dilemmas) -> aftermath ->
// second campaign -> heir, at two viewports. Fails on any JS error or
// horizontal overflow. Screenshots every screen.
// Usage: node verify/drive.mjs [viewport]  (viewport: phone | desktop | both)
import { spawn, execSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT_DIR = path.join(ROOT, "verify", "shots");
const CHROME = "/opt/meta-chromium/chrome";
const PORT = 8931;
const CDP_PORT = 9331;

const errors = [];
const shots = [];

function serve() {
  const server = http.createServer((req, res) => {
    let f = path.join(DIST, req.url === "/" ? "index.html" : req.url.slice(1));
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

async function cdp() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, o) => { ws.onopen = r; ws.onerror = o; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { r, j } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) j(new Error(JSON.stringify(m.error))); else r(m.result);
    } else if (m.method === "Runtime.exceptionThrown" || m.method === "Log.entryAdded") {
      errors.push(JSON.stringify(m.params || m).slice(0, 400));
    }
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    pending.set(i, { r, j });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async (expr, awaitPromise = false) => {
    const res = await send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
    if (res.exceptionDetails) throw new Error("JS exception: " + JSON.stringify(res.exceptionDetails).slice(0, 500));
    return res.result && res.result.value;
  };
  return { send, evalJs, close: () => ws.close() };
}

async function shot(c, name, w, h) {
  const { data } = await c.send("Page.captureScreenshot", { format: "png" });
  const f = path.join(SHOT_DIR, `${name}-${w}x${h}.png`);
  fs.writeFileSync(f, Buffer.from(data, "base64"));
  shots.push(f);
}

async function overflow(c) {
  return c.evalJs(`({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    bw: document.body.scrollWidth
  })`);
}

async function drive(viewport) {
  const W = viewport === "phone" ? 390 : 1440;
  const H = viewport === "phone" ? 844 : 900;
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=${W},${H}`,
    "about:blank",
  ], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2500));
  const c = await cdp();
  await c.send("Log.enable");
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: viewport === "phone" });
  // NOTE: served over HTTP is blocked by Chrome's private-network policy in this
  // environment, so load the single-file build directly from disk instead.
  await c.send("Page.navigate", { url: `file://${DIST}/index.html` });
  await new Promise((r) => setTimeout(r, 2500));
  // Fresh save for every drive: the game persists to localStorage.
  await c.evalJs(`localStorage.clear()`);
  await c.send("Page.navigate", { url: `file://${DIST}/index.html` });
  await new Promise((r) => setTimeout(r, 2500));

  const E = (expr) => {
    const t = expr.trim();
    const isBlock = t.startsWith("{") || t.includes(";");
    const body = isBlock ? t : `return (${t});`;
    return c.evalJs(`(() => { const __sw = window.__sw; const S = __sw.S; const fns = __sw.fns; ${body} })()`);
  };
  const checkOverflow = async (label) => {
    const o = await overflow(c);
    if (o.sw > o.iw || o.bw > o.iw) errors.push(`OVERFLOW at ${label}: scrollWidth=${o.sw} body=${o.bw} inner=${o.iw}`);
  };
  const step = async (label, shotName) => {
    await new Promise((r) => setTimeout(r, 400));
    await checkOverflow(label);
    if (shotName) await shot(c, shotName, W, H);
  };

  // --- MUSTER ---
  let phase = await E(`S.phase`);
  if (phase !== "muster") throw new Error("expected muster, got " + phase);
  await step("muster-name", "01-muster");
  await E(`fns.dismissGuide()`);
  await E(`{ const ids = S.candidates.slice(0,6).map(c=>c.id); ids.forEach(id=>fns.togglePick(id)); }`);
  await E(`fns.autoAssign()`);
  await E(`S.muster.generalName = "Test General"`);
  await step("muster-assigned", "02-muster-assigned");
  await E(`fns.finishMuster()`);
  phase = await E(`S.phase`);
  if (phase !== "garrison") throw new Error("expected garrison, got " + phase);

  // --- GARRISON ---
  await E(`fns.goTab("army")`);
  await step("army", "03-army");
  await E(`fns.goTab("officers")`);
  await step("officers", "04-officers");
  await E(`fns.goTab("campaign")`);
  await step("garrison", "05-garrison");
  await E(`fns.drill("pike")`);
  await E(`fns.rest()`);
  await E(`fns.listen()`);
  const ap = await E(`S.ap`);
  if (ap !== 1) throw new Error("expected 1 AP left, got " + ap);
  await step("garrison-actions", "06-garrison-actions");
  await E(`fns.toCampaignSetup()`);

  // --- CAMPAIGN SETUP ---
  await step("setup", "07-setup");
  await E(`fns.pickDiveDoctrine(0, "balanced")`);
  await E(`fns.launchDive(0)`);
  await E(`clearInterval(S.campaignTimer)`);

  // --- CAMPAIGN: run every dive, answer every dilemma (alternate choices) ---
  let dilemmasSeen = [];
  let choice = 0;
  for (let i = 0; i < 900; i++) {
    const st = await E(`({phase: S.phase, d: S.dilemmas.length, tick: S.tick, total: S.tickTotal, di: S.aftermath ? S.aftermath.diveIndex : -1, ndives: S.dives.length})`);
    if (st.phase === "aftermath" && st.di >= 0 && st.di + 1 < st.ndives) {
      // Between dives: push onward, alternate doctrine.
      await step("debrief-dive" + (st.di + 1), "08b-debrief-" + (st.di + 1));
      await E(`fns.pushDive(); fns.pickDiveDoctrine(S.activeDive, "${choice ? "bold" : "cautious"}"); fns.launchDive(S.activeDive); clearInterval(S.campaignTimer);`);
      choice = 1 - choice;
      continue;
    }
    if (st.phase === "aftermath") break;
    if (st.phase !== "campaign") throw new Error("unexpected phase " + st.phase + " at iter " + i);
    if (st.d > 0) {
      const did = await E(`S.dilemmas[0].id`);
      dilemmasSeen.push(did);
      await E(`fns.dilemmaChoice(0, ${choice})`);
      choice = 1 - choice;
      await step("dilemma-" + did, "08-dilemma-" + did);
      continue;
    }
    if (st.tick === Math.floor(st.total / 2)) await step("campaign-mid", "09-campaign-mid");
    await E(`fns.campaignTick()`);
  }
  phase = await E(`S.phase`);
  if (phase !== "aftermath") throw new Error("expected aftermath, got " + phase + "; dilemmas: " + dilemmasSeen.join(","));
  // --- AFTERMATH ---
  await step("aftermath", "10-aftermath");
  const dead = await E(`S.aftermath.dead.length`);
  console.log(`[${viewport}] named dead:`, dead);
  await E(`fns.endCampaignFromDebrief()`);
  await E(`fns.toGarrison()`);

  // --- SECOND CAMPAIGN (skip path) ---
  await E(`fns.toCampaignSetup(); fns.pickDiveDoctrine(0, "bold"); fns.launchDive(0);`);
  await E(`fns.skipCampaign()`);
  phase = await E(`S.phase`);
  if (phase !== "aftermath") throw new Error("expected aftermath after skip, got " + phase);
  await E(`fns.endCampaignFromDebrief(); fns.toGarrison();`);

  // --- HEIR ---
  await E(`S.general.age = 90; let n=0; while(!fns.checkGeneralFate() && n<300) n++;`);
  phase = await E(`S.phase`);
  if (phase !== "heir") throw new Error("expected heir, got " + phase);
  await step("heir", "11-heir");
  const heirId = await E(`S.officers.find(o=>o.alive).id`);
  await E(`fns.chooseHeir(${heirId})`);
  phase = await E(`S.phase`);
  if (phase !== "garrison") throw new Error("expected garrison after heir, got " + phase);
  const gen = await E(`S.general.generation`);
  if (gen !== 2) throw new Error("expected generation 2, got " + gen);

  // diary
  await E(`fns.goTab("diary")`);
  await step("diary", "12-diary");

  c.close();
  chrome.kill();
  return { dilemmasSeen, dead };
}

const which = process.argv[2] || "both";
const server = await serve();
fs.mkdirSync(SHOT_DIR, { recursive: true });
const viewports = which === "both" ? ["phone", "desktop"] : [which];
let failed = false;
for (const v of viewports) {
  try {
    const r = await drive(v);
    console.log(`[${v}] OK`, JSON.stringify(r));
  } catch (e) {
    failed = true;
    console.error(`[${v}] FAILED:`, e.message);
  }
}
server.close();
if (errors.length) {
  console.error("ERRORS (" + errors.length + "):");
  errors.slice(0, 20).forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("zero JS errors, zero overflow. shots in", SHOT_DIR);
process.exit(failed ? 1 : 0);
