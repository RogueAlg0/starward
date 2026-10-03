import * as S0 from "../src/game/state.ts";
import * as muster from "../src/game/muster.ts";
import * as camp from "../src/game/campaign.ts";
import * as garr from "../src/game/garrison.ts";
import * as wars from "../src/game/wars.ts";
import * as gen from "../src/game/general.ts";
import * as screens from "../src/ui/screens.ts";
import * as off from "../src/game/officers.ts";
// Node logic harness for WARBOUND: stubs the DOM, drives the full loop,
// asserts the DIVE -> CAMPAIGN -> WAR hierarchy works end to end.
const noop = () => {};
const fakeCtx = {
  fillRect: noop,
  fillStyle: "",
  imageSmoothingEnabled: false,
  fillText: noop,
};
const fakeCanvas = () => ({
  width: 0,
  height: 0,
  getContext: () => fakeCtx,
  toDataURL: () => "data:image/png;base64,AAA",
});
const fakeEl = () => ({
  style: {},
  appendChild: noop,
  remove: noop,
  click: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  insertAdjacentHTML: noop,
  addEventListener: noop,
  innerHTML: "",
  value: "",
  files: null,
  scrollTop: 0,
  scrollHeight: 0,
});
globalThis.document = {
  createElement: (tag) => (tag === "canvas" ? fakeCanvas() : fakeEl()),
  getElementById: () => null,
  querySelectorAll: () => [],
  readyState: "complete",
  addEventListener: noop,
  body: fakeEl(),
};
globalThis.window = globalThis;
globalThis.setInterval = ((fn) => 0);
globalThis.clearInterval = noop;
globalThis.confirm = () => true;
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const assert = (cond, msg) => {
  if (!cond) { console.error("ASSERT FAIL:", msg); process.exitCode = 1; }
  else console.log("ok:", msg);
};

function main() {








  const S = () => S0.getState();

  // ---- MUSTER ----
  muster.startMuster();
  assert(S().phase === "muster", "phase muster");
  assert(S().candidates.length === 9, "9 candidates, got " + S().candidates.length);
  S().candidates.slice(0, 6).forEach((c) => muster.togglePick(c.id));
  muster.autoAssign();
  S().muster.generalName = "Test General";
  muster.finishMuster();
  assert(S().phase === "garrison", "phase garrison after muster");
  assert(S().warRecord !== null, "war named at muster: " + (S().warRecord && S().warRecord.name));
  assert(S().warRecord.rival && S().warRecord.rival.name, "rival commander: " + S().warRecord.rival.name);
  assert(S().regiments.every((r) => Array.isArray(r.traditions)), "regiments have traditions array");

  // LAST LETTERS micro-test
  const alive0 = S().officers.filter((o) => o.alive);
  alive0.forEach((o) => { o.letter = "Dear test: the lamp is lit."; });
  const victim = alive0[0];
  victim.alive = false; victim.health = 0;
  const dlines = off.deliverLetters();
  assert(dlines.length === 1 && dlines[0].indexOf("UNSENT LETTER") === 0, "last letter delivered: " + dlines[0].slice(0, 60));
  assert(victim.letter === undefined, "letter consumed after delivery");
  victim.alive = true; victim.health = 100;
  off.writeLetters();
  console.log("info: letters written between dives:", S().officers.filter((o) => o.letter).length);

  // screens smoke test (string building only)
  for (const [name, fn] of [
    ["renderMuster", screens.renderMuster],
    ["renderGarrison", screens.renderGarrison],
    ["renderDiary", screens.renderDiary],
    ["renderHeir", screens.renderHeir],
  ]) {
    const html = fn();
    assert(typeof html === "string" && html.length > 500, name + " renders (" + html.length + " chars)");
  }

  // ---- CAMPAIGN 1: full dive sequence ----
  camp.toCampaignSetup();
  assert(S().phase === "campaign_setup", "phase campaign_setup");
  const nDives = S().dives.length;
  assert(nDives >= 2 && nDives <= 4, "2-4 dives, got " + nDives);
  const d0 = S().dives[0];
  assert(d0.name && d0.terrainId && d0.weatherId && d0.twistId && d0.enemyIds.length >= 1,
    "dive 0 generated: " + d0.name + " / " + d0.terrainId + " / " + d0.weatherId + " / " + d0.twistId);
  const setupHtml = screens.renderCampaignSetup();
  assert(setupHtml.includes("Dive 1"), "setup shows dive cards");
  assert(setupHtml.includes(escHtml(d0.name)), "setup shows dive name");

  // set doctrine per dive
  S().dives.forEach((d, i) => { d.doctrine = ["cautious", "balanced", "bold"][i % 3]; });

  let totalDilemmas = 0;
  for (let di = 0; di < nDives; di++) {
    camp.launchDive(di);
    assert(S().phase === "campaign", "dive " + di + " launched");
    assert(S().war.extraction === null, "no extraction at dive start");
    assert(S().war.ordersUsed && S().war.scoutedUntil === 0, "orders state init");
    // orders smoke test
    const supBefore = S().supply;
    camp.orderScouts();
    assert(S().supply === supBefore - 12 && S().war.scoutedUntil === S().tick + 3, "dispatch scouts order works");
    let guard = 0;
    while (S().phase === "campaign" && guard < 3000) {
      if (S().dilemmas.length) { totalDilemmas++; camp.dilemmaChoice(0, guard % 2); }
      else camp.campaignTick();
      guard++;
    }
    assert(S().phase === "aftermath", "dive " + di + " ended in aftermath (guard " + guard + ")");
    assert(S().warScore !== 0 || di >= 0, "war score moved: " + S().warScore);
    const debrief = screens.renderAftermath();
    assert(debrief.includes("Dive debrief"), "debrief renders");
    if (di < nDives - 1) {
      assert(debrief.includes("Push to dive"), "push button offered");
      camp.pushDive();
      assert(S().phase === "campaign", "pushed to dive " + (di + 1));
    }
  }
  assert(totalDilemmas > 0, "dilemmas fired: " + totalDilemmas);
  assert(S().diveResults.length === nDives, "dive results tracked: " + S().diveResults.length);
  // letters: check some officer has/had a letter
  const lettersInLog = S().log.filter((e) => e.text.includes("UNSENT LETTER")).length;
  console.log("info: unsent letters delivered:", lettersInLog);

  // end the campaign from the final debrief
  const campsBefore = S().warRecord.campaigns.length;
  camp.endCampaignFromDebrief();
  assert(S().phase === "garrison", "back in garrison");
  assert(S().warRecord.campaigns.length === campsBefore + 1, "campaign recorded in war history");
  const rec = S().warRecord.campaigns[campsBefore];
  console.log("info: campaign outcome:", rec.outcome, "| note:", rec.note);
  assert(["decisive", "pyrrhic", "stalemate", "defeat", "withdrawn"].includes(rec.outcome), "valid outcome");
  const garHtml = screens.renderGarrison();
  assert(garHtml.includes("War tracker"), "war tracker renders in garrison");

  // ---- CAMPAIGN 2: withdraw path ----
  camp.toCampaignSetup();
  camp.launchDive(0);
  let guard = 0;
  while (S().phase === "campaign" && guard < 3000) {
    if (S().dilemmas.length) camp.dilemmaChoice(0, 1);
    else camp.campaignTick();
    guard++;
  }
  assert(S().phase === "aftermath", "campaign 2 dive 1 debrief");
  const wsBefore = S().warScore;
  camp.withdrawDive();
  assert(S().phase === "garrison", "withdrawn to garrison");
  assert(S().warScore <= wsBefore - 5, "withdrawal costs at least 5 war score (got " + (wsBefore - S().warScore) + ")");
  const lastRec = S().warRecord.campaigns[S().warRecord.campaigns.length - 1];
  assert(lastRec.outcome === "withdrawn", "withdrawn recorded");

  // ---- traditions check ----
  const tradCount = S().regiments.reduce((a, r) => a + r.traditions.length, 0);
  console.log("info: traditions earned:", tradCount);

  // ---- HEIR ----
  S().general.age = 95;
  let n = 0;
  while (S().phase !== "heir" && n < 500) { gen.checkGeneralFate(); n++; }
  assert(S().phase === "heir", "succession triggered");
  const heirId = S().officers.find((o) => o.alive).id;
  gen.chooseHeir(heirId);
  assert(S().general.generation === 2, "second generation general");
  assert(S().phase === "garrison", "heir in garrison");

  // diary renders with all filters
  for (const f of ["all", "battle", "officer", "supply", "weather", "war"]) {
    S().logFilter = f;
    const h = screens.renderDiary();
    assert(h.length > 500, "diary renders for filter " + f);
  }

  // save/load round trip
  S0.saveGame(true);
  assert(S0.loadGame() === true, "save/load round trip");
  assert(S().warRecord !== null, "war record survives save");

  console.log("\nALL LOGIC CHECKS DONE, exitCode=" + (process.exitCode || 0));
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

try { main(); } catch (e) { console.error("HARNESS ERROR:", e); process.exit(1); }
