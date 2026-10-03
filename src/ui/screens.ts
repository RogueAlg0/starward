// All screens as HTML strings. Event wiring lives in main.ts via
// data-action / data-input attributes (no inline handlers).
// Pixel art comes from art/pixel (data URLs, generated at runtime).
import type { Dilemma, Dive, Officer, Regiment } from "../types";
import { ADVISOR, DOCTRINES, REGIMENTS, UPGRADES } from "../game/world";
import { esc, bar } from "./helpers";
import { getState } from "../game/state";
import {
  aliveOfficers,
  bestApt,
  officerById,
  quirkText,
  traitById,
} from "../game/officers";
import { diveMods, terrainById, twistById, weatherById } from "../game/dives";
import { townMood, seasonOf } from "../game/garrison";
import { frontSummary } from "../game/livingwar";
import { activeDiveOf, campaignLeg } from "../game/campaign";
import { logStreamHTML } from "./logEntry";
import { portraitURL, standardURL, tacticalMapURL } from "../art/pixel";

export function portrait(o: Officer, size = 64): string {
  return (
    '<img class="pix" width="' + size + '" height="' + Math.round(size * 1.25) + '" ' +
    'src="' + portraitURL(o.name + "|" + o.id) + '" alt="">'
  );
}

export function standard(r: Regiment, size = 64): string {
  const def = REGIMENTS.find((x) => x.id === r.id);
  const colors = def ? (def.colors as [string, string]) : (["#3f6b4f", "#8a8f98"] as [string, string]);
  const emblem = def ? def.emblem : "eel";
  // traditions mark the standard: the seed changes when a name is earned
  const seed = r.id + "|" + r.traditions.length;
  return (
    '<img class="pix" width="' + size + '" height="' + Math.round(size * 1.25) + '" ' +
    'src="' + standardURL(seed, colors, emblem) + '" alt="">'
  );
}

export function rating(o: Officer): number {
  const a = o.apt;
  return Math.round(((a.infantry + a.cavalry + a.artillery + a.scouts + a.supply + a.surgery) / 6) * 10);
}

export function traitTags(o: Officer): string {
  return o.traits
    .map((id) => {
      const t = traitById(id);
      const name = t ? t.name : id;
      const desc = t ? t.desc : "";
      return '<span class="tag trait" title="' + esc(desc) + '">' + esc(name) + "</span>";
    })
    .join("");
}

export function quirkTag(o: Officer): string {
  return '<span class="tag quirk" title="Quirk">' + esc(quirkText(o.quirk)) + "</span>";
}

export function relText(o: Officer): string {
  if (!o.relations.length) return '<span class="muted small">no ties yet</span>';
  return o.relations
    .map((r) => {
      const other = officerById(r.with);
      const nm = other ? other.name : "a departed soul";
      return '<span class="tag">' + esc(r.type) + ": " + esc(nm) + "</span>";
    })
    .join("");
}

export function postOf(o: Officer): string {
  if (o.regiment) {
    const r = getState().regiments.find((x) => x.id === o.regiment);
    return "Commands " + (r ? r.name : o.regiment);
  }
  if (o.staff === "quartermaster") return "Quartermaster";
  if (o.staff === "scout") return "Scout-master";
  if (o.staff === "surgeon") return "Surgeon";
  return "Unposted";
}

function statCell(label: string, value: string, cls?: string): string {
  return '<div class="cell"><span class="micro">' + esc(label) + "</span><b" +
    (cls ? ' class="' + cls + '"' : "") + ">" + value + "</b></div>";
}

/* ------------------------------------------------------------------ */
/* Muster: name, draft, assign — then the standing army                  */
/* ------------------------------------------------------------------ */

function advisorPanel(): string {
  const S = getState();
  if (S.guideDismissed) return "";
  const step = S.guideStep || 0;
  const line =
    step === 0 ? ADVISOR.lines.muster : step === 1 ? ADVISOR.lines.draft : ADVISOR.lines.assign;
  const beats = ["Name yourself", "Draft six officers", "Give the regiments commanders"];
  let h = '<div class="panel guide"><div class="row"><div><h2 style="margin:0">' +
    esc(ADVISOR.name) + '</h2><div class="small muted">' + esc(ADVISOR.title) + "</div></div>" +
    '<div class="spacer"></div><button class="linkbtn" data-action="dismiss-guide">Skip the counsel</button></div>';
  h += '<p class="small" style="margin:8px 0">&ldquo;' + esc(line) + "&rdquo;</p>";
  h += '<div class="row small">' + beats.map((b, i) =>
    '<span class="tag' + (i === step ? " quirk" : "") + '">' + (i + 1) + ". " + esc(b) + "</span>"
  ).join("") + "</div></div>";
  return h;
}

function draftFlow(): string {
  const S = getState();
  const m = S.muster;
  let h = advisorPanel();
  h += '<div class="panel"><div class="sechead">Name your general</div>';
  h += '<div class="lblrow"><label>General&rsquo;s name</label>' +
    '<button class="linkbtn" data-action="gen-reroll">Reroll</button></div>';
  h += '<div class="namerow"><input type="text" id="genname" data-input="gen-name" value="' +
    esc(m.generalName) + '"></div></div>';

  h += '<div class="panel"><div class="sechead">Draft your officers <span class="r">' + (6 - m.picked.length) + " to pick</span></div>";
  h += '<p class="muted small">Six officers. Their traits, quirks, and ties to each other are the story engine. Choose people, not stats.</p>';
  h += '<div class="grid c3">';
  for (const cand of S.candidates) {
    const sel = m.picked.includes(cand.id) ? " selected" : "";
    const rels = cand.relations
      .map((r) => {
        const other = S.candidates.find((x) => x.id === r.with);
        return other ? r.type + ": " + other.name.split(" ")[0] : "";
      })
      .filter(Boolean)
      .join(", ");
    h +=
      '<div class="card pick' + sel + '" data-action="toggle-pick" data-id="' + cand.id + '">' +
      '<div class="candhead">' + portrait(cand, 48) +
      "<div><h4>" + esc(cand.name) + ' <span class="muted small">age ' + cand.age + "</span></h4>" +
      '<div class="rateblock"><span class="micro">Rating</span><b>' + rating(cand) + "</b></div>" +
      traitTags(cand) + quirkTag(cand) + "</div></div>" +
      '<div class="small dim">Hook: ' + esc(cand.hook) + "</div>" +
      (rels ? '<div class="small" style="color:var(--warn)">' + esc(rels) + "</div>" : "") +
      '<div class="small muted mt">Best at: ' + bestApt(cand) + "</div></div>";
  }
  h += "</div></div>";

  const pickedOfficers = S.candidates.filter((c) => m.picked.includes(c.id));
  h += '<div class="panel"><div class="sechead">Give the regiments commanders</div>';
  h += '<div class="row"><button class="linkbtn" data-action="auto-assign">Let the Marshal assign</button></div>';
  h += '<div class="grid c3">';
  for (const r of REGIMENTS) {
    const cur = m.assignments[r.id];
    h += '<div class="card"><div class="candhead">' + standard({
      id: r.id, name: r.name, specialty: r.specialty, commander: null,
      strength: 0, maxStrength: 0, morale: 0, xp: 0, scars: [], honors: [], traditions: [],
    }, 40) + "<div><h4>" + esc(r.name) + '</h4><div class="small muted">' +
      esc(r.specialty) + ". " + esc(r.flavor) + "</div></div></div>";
    h += '<label>Commander</label><select data-input="assign" data-reg="' + r.id + '">';
    h += '<option value="">Choose...</option>';
    for (const o of pickedOfficers) {
      const taken = Object.entries(m.assignments).some(([k, v]) => k !== r.id && v === o.id);
      h += '<option value="' + o.id + '"' + (cur === o.id ? " selected" : "") + (taken ? " disabled" : "") + ">" +
        esc(o.name) + " (" + bestApt(o) + ")</option>";
    }
    h += "</select></div>";
  }
  h += "</div>";
  const ready = m.picked.length === 6 && REGIMENTS.every((r) => m.assignments[r.id] != null);
  h += '<div class="center mt"><button class="primary" ' + (ready ? "" : "disabled") +
    ' data-action="finish-muster">Sound the muster</button>';
  if (!ready) h += '<div class="small muted mt">Draft six officers and name three commanders.</div>';
  h += "</div></div>";
  return h;
}

function armyView(): string {
  const S = getState();
  const avgMorale = Math.round(S.regiments.reduce((a, r) => a + r.morale, 0) / Math.max(1, S.regiments.length));
  let h = '<div class="stathead">' +
    statCell("Regiments", String(S.regiments.length)) +
    statCell("Officers", String(aliveOfficers().length), "cy") +
    statCell("Avg morale", String(avgMorale), avgMorale >= 60 ? "gn" : "rd") +
    statCell("War score", String(S.warScore), S.warScore >= 0 ? "gn" : "rd") +
    "</div>";
  h += '<div class="sechead">Standing regiments</div>';
  for (const r of S.regiments) {
    const cmd = officerById(r.commander || -1);
    h += '<div class="panel"><div class="shiphead">' + standard(r, 72) +
      '<div class="idblock"><h2 style="margin:0">' + esc(r.name) + "</h2>" +
      '<div class="small muted readout">' + esc(r.specialty) + " // " +
      (cmd ? "CMDR " + esc(cmd.name) : "NO COMMANDER") + "</div>" +
      '<div class="statstrip readout">' +
      '<p class="stat"><span class="micro">Str</span><b>' + r.strength + "/" + r.maxStrength + "</b></p>" +
      '<p class="stat"><span class="micro">Mor</span><b>' + r.morale + "</b></p>" +
      '<p class="stat"><span class="micro">Vet</span><b>' + r.xp + "</b></p></div>" +
      '<div class="meter mt"><span class="micro">Morale</span>' + bar(r.morale, "mor") + "</div></div></div>";
    if (cmd) {
      h += '<div class="row mt"><div class="candhead">' + portrait(cmd, 40) +
        "<div><b>" + esc(cmd.name) + '</b><div class="small muted">' + esc(postOf(cmd)) + "</div>" +
        traitTags(cmd) + quirkTag(cmd) + "</div></div></div>";
    }
    if (r.traditions.length || r.honors.length || r.scars.length) {
      h += '<div class="mt small">' +
        r.traditions.map((x) => '<span class="tag station" title="+2 battle, earned in the field">&ldquo;' + esc(x) + "&rdquo;</span>").join("") +
        r.honors.map((x) => '<span class="tag station">' + esc(x) + "</span>").join("") +
        r.scars.map((sc) => '<span class="tag scar" title="' + esc(sc.story) + '">' + esc(sc.name) + "</span>").join("") +
        "</div>";
    }
    h += "</div>";
  }
  h += '<div class="sechead">Officers</div><div class="grid c3">';
  for (const o of S.officers) {
    if (!o.alive) continue;
    h += '<div class="card"><div class="candhead">' + portrait(o, 56) +
      "<div><h4>" + esc(o.name) + ' <span class="muted small">age ' + o.age + "</span></h4>" +
      '<div class="small" style="color:var(--good)">' + esc(postOf(o)) + "</div>" +
      '<div class="rateblock"><span class="micro">Rating</span><b>' + rating(o) + "</b></div>" +
      traitTags(o) + quirkTag(o) + "</div></div>" +
      '<div class="small dim">Hook: ' + esc(o.hook) + "</div>" +
      '<div class="meter mt"><span class="micro">Health</span>' + bar(o.health, "hp") + "<b>" + o.health + "</b></div>" +
      '<div class="meter mt"><span class="micro">Morale</span>' + bar(o.morale, "mor") + "<b>" + o.morale + "</b></div>";
    if (o.memories.length) {
      h += '<div class="small mt" style="color:var(--gold)">Remembers: ' + esc(o.memories[o.memories.length - 1]) + "</div>";
    }
    h += '<div class="small mt">' + relText(o) + "</div></div>";
  }
  h += "</div>";
  // relations that outlive any one general
  const rel = S.relations;
  if (rel.allies.length || rel.rivals.length || rel.favors.length) {
    h += '<div class="panel"><div class="sechead">Debts and grudges <span class="r">they outlive the chair</span></div><div class="small">';
    if (rel.allies.length) h += '<div class="mb">Allies: ' + rel.allies.map((x) => '<span class="tag station">' + esc(x) + "</span>").join("") + "</div>";
    if (rel.rivals.length) h += '<div class="mb">Rivals: ' + rel.rivals.map((x) => '<span class="tag scar">' + esc(x) + "</span>").join("") + "</div>";
    if (rel.favors.length) h += "<div>Owed favors: " + rel.favors.map((x) => '<span class="tag quirk">' + esc(x) + "</span>").join("") + "</div>";
    h += "</div></div>";
  }
  const dead = S.officers.filter((o) => !o.alive);
  if (dead.length) {
    h += '<div class="panel"><div class="sechead">The fallen</div><div class="small">' +
      dead.map((o) => '<span class="tag scar">' + esc(o.name) + "</span>").join("") + "</div></div>";
  }
  return h;
}

export function renderMuster(): string {
  const S = getState();
  if (S.phase === "muster") return draftFlow();
  return armyView();
}

function warTracker(): string {
  const S = getState();
  const wr = S.warRecord;
  if (!wr) return "";
  const r = wr.rival;
  let h = '<div class="panel"><div class="sechead">War tracker <span class="r">' + esc(wr.name) + "</span></div>";
  h += '<p class="small muted" style="margin:0 0 12px">&ldquo;' + esc(wr.casusBelli) + "&rdquo;</p>";
  h += '<div class="meter mb"><span class="micro">Thalmar</span>' + bar(wr.thalmarScore / 1.2, "mor") + "<b>" + wr.thalmarScore + "</b></div>";
  h += '<div class="meter mb"><span class="micro">Veskar</span>' + bar(wr.veskarScore / 1.2, "hullbar") + "<b>" + wr.veskarScore + "</b></div>";
  h += '<div class="small mb"><b style="color:var(--bad)">' + esc(r.name) + "</b>, " + esc(r.title) +
    ' <span class="tag scar">' + esc(r.personality) + "</span><br>" +
    '<span class="muted">' + esc(r.quirk) + "</span></div>";
  if (r.grudges.length) {
    h += '<div class="small mb"><span class="micro">What ' + esc(r.name.split(" ")[0]) + " remembers</span><br>" +
      r.grudges.slice(-3).map((g) => '<span class="tag scar">' + esc(g) + "</span>").join("") + "</div>";
  }
  h += '<div class="small muted mb readout">FRONT: ' + esc(frontSummary()) + "</div>";
  h += '<div class="small muted mb">Sectors: ' + S.fronts.map((f) =>
    '<span class="tag ' + (f.holder === "Thalmar" ? "station" : "scar") + '">' + esc(f.sector) + "</span>"
  ).join("") + "</div>";
  if (wr.campaigns.length) {
    h += '<div class="small"><span class="micro">Campaigns</span><br>' + wr.campaigns.map((c) =>
      '<div class="sitrow"><span class="t">' + esc(c.outcome.toUpperCase()) + '</span><span><span class="h">' +
      esc(c.name) + '</span><div class="b">' + esc(c.note) + " &mdash; " + c.divesWon + "/" + c.dives + " dives taken.</div></span></div>"
    ).join("") + "</div>";
  } else {
    h += '<div class="small muted">No campaigns fought yet in this war. That will change.</div>';
  }
  h += "</div>";
  return h;
}

function apPips(n: number): string {
  let s = '<span class="small muted">Action points: </span>';
  for (let i = 0; i < 4; i++) {
    s += '<span class="tag' + (i < n ? " quirk" : "") + '">' + (i < n ? "●" : "○") + "</span>";
  }
  return '<div class="mb">' + s + "</div>";
}

function townMoodPanel(): string {
  const S = getState();
  const mood = townMood();
  const season = seasonOf(S.day);
  if (mood === "celebration") {
    return '<div class="notice good"><p><b>Evensbrook celebrates.</b></p>' +
      '<p class="small">Bells till midnight, and Maelis opened the barrel he swore he would never open. ' +
      "It is " + season + ", and the town dares to hope.</p></div>";
  }
  if (mood === "refugees") {
    return '<div class="notice bad"><p><b>Refugees in the square.</b></p>' +
      '<p class="small">Families from the fallen sectors, wrapped in blankets and bad news. The shrine hands out soup. ' +
      "It is " + season + ", and nobody is celebrating.</p></div>";
  }
  return "";
}

export function renderGarrison(): string {
  const S = getState();
  let h = warTracker();
  h += townMoodPanel();
  h += '<div class="panel"><div class="sechead">Evensbrook <span class="r">' + esc(seasonOf(S.day)) + " // day " + S.day + "</span></div>";
  h += '<div class="stathead">' +
    statCell("War chest", String(S.spoils), "cy") +
    statCell("Supply", String(S.supply), S.supply >= 25 ? "gn" : "rd") +
    statCell("War score", String(S.warScore), S.warScore >= 0 ? "gn" : "rd") +
    statCell("Action pts", String(S.ap)) +
    "</div>";
  h += apPips(S.ap);
  h += '<div class="grid c2">';
  h += '<div><label>Drill a regiment (+veterancy)</label><div class="row">';
  for (const r of S.regiments) {
    h += '<button data-action="drill" data-id="' + r.id + '" ' + (S.ap <= 0 ? "disabled" : "") + ">Drill " + esc(r.name.split(" ")[1]) + "</button>";
  }
  h += '</div></div>';
  h += '<div><label>Inspect the troops</label><div class="row">';
  for (const r of S.regiments) {
    h += '<button data-action="inspect" data-id="' + r.id + '" ' + (S.ap <= 0 ? "disabled" : "") + ">Inspect " + esc(r.name.split(" ")[1]) + "</button>";
  }
  h += "</div></div></div>";
  h += '<div class="row mt"><button data-action="rest" ' + (S.ap <= 0 ? "disabled" : "") + ">Rest the army</button>";
  h += '<button data-action="listen" ' + (S.ap <= 0 ? "disabled" : "") + ">Listen in the town</button>";
  h += '<div class="spacer"></div><button class="primary" data-action="to-setup">March to war</button></div></div>';

  h += '<div class="panel"><div class="sechead">Heard in Evensbrook</div>';
  if (!S.gossip.length) h += '<p class="muted small">The town is quiet. For now.</p>';
  for (const g of S.gossip.slice(0, 8)) {
    const cls = g.kind === "rumor" ? "quirk" : g.kind === "regiment" ? "station" : "";
    h += '<div class="small" style="margin-bottom:8px"><span class="tag ' + cls + '">' + esc(g.kind) + "</span> " + esc(g.text) + "</div>";
  }
  h += "</div>";

  h += '<div class="panel"><div class="sechead">Officers seeking posts <span class="r">the pool churns</span></div>' +
    '<p class="muted small">New blades arrive in Evensbrook every season. Those not hired move on.</p>';
  if (!S.recruitPool.length) h += '<p class="muted small">No seekers at the moment.</p>';
  h += '<div class="grid c3">';
  for (const m of S.recruitPool) {
    h += '<div class="card"><div class="candhead">' + portrait(m, 48) +
      "<div><h4>" + esc(m.name) + ' <span class="muted small">age ' + m.age + "</span></h4>" +
      '<div class="rateblock"><span class="micro">Rating</span><b>' + rating(m) + "</b></div>" +
      traitTags(m) + quirkTag(m) + "</div></div>" +
      '<div class="small dim">Hook: ' + esc(m.hook) + "</div>" +
      '<div class="small muted mt">Best at: ' + bestApt(m) + "</div>" +
      '<div class="center mt"><button data-action="hire" data-id="' + m.id + '">Offer commission (' + m.fee + " spoils)</button></div></div>";
  }
  h += "</div></div>";

  h += '<div class="panel"><div class="sechead">War chest <span class="r">' + S.spoils + " spoils</span></div>" +
    '<div class="grid c2">';
  h += "<div><h3>Muster levies</h3>";
  for (const r of S.regiments) {
    const missing = r.maxStrength - r.strength;
    h += '<div class="row small" style="margin-bottom:8px"><span>' + esc(r.name) + " (" + missing + " missing)</span>" +
      '<div class="spacer"></div><button data-action="levy" data-id="' + r.id + '" ' + (missing <= 0 || S.spoils <= 0 ? "disabled" : "") + ">Levy (" + Math.ceil(missing / 4) + ")</button></div>";
  }
  h += "</div><div><h3>Evensbrook works</h3>";
  for (const u of UPGRADES) {
    const owned = S.upgrades.some((x) => x.id === u.id && x.owned);
    h += '<div class="row small" style="margin-bottom:8px"><span><b>' + esc(u.name) + "</b> &mdash; " + esc(u.desc) + "</span>" +
      '<div class="spacer"></div>' + (owned ? '<span class="tag station">built</span>' :
        '<button data-action="buy-upgrade" data-id="' + u.id + '" ' + (S.spoils < u.cost ? "disabled" : "") + ">Build (" + u.cost + ")</button>") + "</div>";
  }
  h += "</div></div></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Campaign setup: the dive sequence, doctrine per dive                 */
/* ------------------------------------------------------------------ */

const DIVE_TYPE_LABEL: Record<Dive["type"], string> = {
  seize: "Seize",
  siege: "Break siege",
  raid: "Raid",
  hold: "Hold",
};

function diveCard(d: Dive): string {
  const S = getState();
  const t = terrainById(d.terrainId);
  const w = weatherById(d.weatherId);
  const tw = twistById(d.twistId);
  const mods = diveMods(d);
  const foes = d.enemyIds
    .map((id) => {
      const e = S.enemy.find((x) => x.id === id);
      return e ? e.name + " (" + e.commander + ")" : id;
    })
    .join(" + ");
  let h = '<div class="panel"><div class="sechead">Dive ' + (d.index + 1) + " of " + S.dives.length +
    ' <span class="r">' + "●".repeat(d.difficulty) + "○".repeat(Math.max(0, 3 - d.difficulty)) + "</span></div>";
  h += "<h2 style=\"margin:0 0 4px\">" + esc(d.name) + "</h2>";
  h += '<div class="small muted readout mb">' + esc(DIVE_TYPE_LABEL[d.type]) + " // " + d.ticks + " DAYS // " +
    esc(d.risk).toUpperCase() + " // SPOILS " + d.spoils + "</div>";
  h += '<div class="small mb"><span class="micro">Terrain</span> ' + esc(t.name) + " &mdash; " + esc(t.desc) + "</div>";
  h += '<div class="small mb"><span class="micro">Weather</span> ' + esc(w.name) + " &mdash; " + esc(w.desc) + "</div>";
  h += '<div class="small mb"><span class="micro">Twist</span> ' + esc(tw.name) + " &mdash; " + esc(tw.desc) + "</div>";
  h += '<div class="small mb"><span class="micro">Enemy</span> ' + esc(foes) +
    (mods.enemyMult !== 1 ? ' <span class="tag scar">x' + mods.enemyMult.toFixed(2) + " strength</span>" : "") + "</div>";
  h += '<label>Doctrine for this dive</label><div class="row">';
  for (const doc of DOCTRINES) {
    const sel = d.doctrine === doc.id;
    h += '<button class="' + (sel ? "gold" : "") + '" data-action="pick-dive-doctrine" data-i="' + d.index +
      '" data-id="' + doc.id + '" title="' + esc(doc.desc) + '">' + esc(doc.name) + "</button>";
  }
  h += "</div></div>";
  return h;
}

export function renderCampaignSetup(): string {
  const S = getState();
  let h = "";
  if (S.warRecord) {
    h += '<div class="panel"><div class="sechead">The war <span class="r">' + esc(S.warRecord.name) + "</span></div>";
    h += '<p class="small muted" style="margin:0">&ldquo;' + esc(S.warRecord.casusBelli) + "&rdquo;</p>";
    h += '<p class="small readout" style="margin:8px 0 0">THALMAR ' + S.warRecord.thalmarScore +
      " // VESKAR " + S.warRecord.veskarScore +
      ' // RIVAL: <span style="color:var(--bad)">' + esc(S.warRecord.rival.name) + "</span></p></div>";
  }
  h += '<div class="panel"><div class="sechead">Campaign plan <span class="r">' + esc(S.campaignName) + "</span></div>";
  h += '<p class="muted small">&ldquo;' + esc(ADVISOR.lines.objective) + "&rdquo; &mdash; " + esc(ADVISOR.name) + "</p>";
  h += '<p class="muted small">Each dive is generated from the campaign seed. Difficulty and extraction pressure escalate per dive. ' +
    "Withdrawal between dives costs 5 war score.</p></div>";
  for (const d of S.dives) h += diveCard(d);
  h += '<div class="center mb"><button class="primary" data-action="launch-dive" data-i="0">Launch dive 1</button></div>';
  return h;
}

/* ------------------------------------------------------------------ */
/* Campaign: the live dive                                              */
/* ------------------------------------------------------------------ */

function tacticalMap(): string {
  const S = getState();
  const war = S.war;
  if (!war) return "";
  const known = S.tick < war.scoutedUntil;
  const url = tacticalMapURL({ enemyX: war.enemyX, enemyY: war.enemyY, enemyKnown: known, seed: war.seed });
  const cols = ["A", "B", "C", "D", "E", "F"];
  const rows = ["1", "2", "3", "4", "5", "6", "7", "8"];
  let h = '<div class="tacwrap mapwrap"><img class="pix" src="' + url + '" alt="Tactical map">';
  h += '<div class="taccols">' + cols.map((c, i) =>
    '<span style="left:' + (i * 100 / 6 + 100 / 12) + '%">' + c + "</span>").join("") + "</div>";
  h += '<div class="tacrows">' + rows.map((r, i) =>
    '<span style="top:' + (i * 100 / 8 + 100 / 16) + '%">' + r + "</span>").join("") + "</div>";
  h += "</div>";
  h += '<div class="taclegend"><span class="li"><span class="blip f"></span>US</span>' +
    '<span class="li"><span class="blip ' + (known ? "h" : "u") + '"></span>' +
    (known ? "ENEMY (SCOUTED)" : "ENEMY (REPORTED)") + "</span></div>";
  return h;
}

function ordersPanel(): string {
  const S = getState();
  const war = S.war;
  if (!war || S.dilemmas.length) return "";
  const ou = war.ordersUsed;
  let h = '<div class="sechead">Orders <span class="r">once per dive</span></div>';
  h += '<button class="orderbtn" data-action="order-scouts" ' + (ou.scouts || S.supply < 12 ? "disabled" : "") + ">" +
    '<span class="k">SCOUTS</span><span class="d"><b>Dispatch scouts</b><span>TRUE REPORTS 3 TICKS // COST 12 SUPPLY' +
    (ou.scouts ? " // SPENT" : "") + "</span></span></button>";
  h += '<button class="orderbtn" data-action="order-council" ' + (ou.council || S.supply < 8 ? "disabled" : "") + ">" +
    '<span class="k">COUNCIL</span><span class="d"><b>War council</b><span>+6 MORALE ALL // COST 8 SUPPLY' +
    (ou.council ? " // SPENT" : "") + "</span></span></button>";
  h += '<div class="row"><button data-action="speed">' + (S.campaignSpeed === 1 ? "Faster" : "Slower") + "</button>";
  h += '<button data-action="skip">Skip</button></div>';
  return h;
}

export function renderCampaignRun(): string {
  const S = getState();
  const d = activeDiveOf();
  const war = S.war;
  let h = '<div class="panel">';
  h += '<div class="sechead">Dive ' + ((war?.diveIndex ?? 0) + 1) + " of " + S.dives.length +
    (d ? " <span class=\"r\">" + esc(d.name) + "</span>" : "") + "</div>";
  h += '<div class="stathead">' +
    statCell("Leg", campaignLeg()) +
    statCell("Day", S.tick + "/" + S.tickTotal) +
    statCell("Supply", String(S.supply), S.supply >= 25 ? "gn" : "rd") +
    statCell("War score", String(S.warScore), S.warScore >= 0 ? "gn" : "rd") +
    "</div>";
  h += tacticalMap();
  h += '<div class="mt">' + ordersPanel() + "</div>";
  h += "</div>";
  h += '<div class="panel"><div class="sechead">Situation log <span class="r">live</span></div>';
  h += '<div class="logstream" id="voylog">' + logStreamHTML(S.log) + "</div></div>";
  // sync the incremental painter with the full render
  S._painted = S.log.length;
  if (S.dilemmas.length) h += dilemmaModal(S.dilemmas[0]);
  return h;
}

function dilemmaModal(d: Dilemma): string {
  let h = '<div class="modal-overlay"><div class="panel modal">';
  h += "<h2>" + esc(d.title) + "</h2>";
  h += '<p class="small">' + esc(d.text) + "</p>";
  d.choices.forEach((c, j) => {
    h += '<button class="mt" style="display:block;width:100%;text-align:left" data-action="dilemma" data-i="0" data-j="' + j + '">' + esc(c) + "</button>";
  });
  h += "</div></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Aftermath: the dive debrief                                          */
/* ------------------------------------------------------------------ */

export function renderAftermath(): string {
  const S = getState();
  const a = S.aftermath;
  if (!a) return '<div class="panel"><p class="muted">The field is quiet.</p></div>';
  const cls = a.outcome === "victory" ? "good" : a.outcome === "defeat" ? "bad" : "";
  let h = '<div class="panel"><div class="sechead">Dive debrief <span class="r">dive ' + (a.diveIndex + 1) + " of " + a.divesTotal + "</span></div>";
  h += "<h2>" + esc(a.objectiveName) + " &mdash; " + esc(a.place) + "</h2>";
  h += '<div class="notice ' + cls + '"><p><b>' + esc(a.summary) + "</b></p>";
  h += '<p class="small">Spoils taken: ' + a.spoilsGained + ". War score " +
    (a.warScoreDelta >= 0 ? "+" : "") + a.warScoreDelta + ". The enemy was " + esc(a.enemyName) + ".</p></div>";

  h += '<div class="sechead">The fallen (' + a.dead.length + ")</div>";
  if (!a.dead.length) {
    h += '<p class="small muted">No dead. The surgeons are as surprised as anyone.</p>';
  } else {
    h += '<p class="muted small">Named, every one. A regiment without names is a statistic.</p>';
    h += '<div class="memorial">';
    const byReg: Record<string, typeof a.dead> = {};
    for (const d of a.dead) {
      (byReg[d.regiment] = byReg[d.regiment] || []).push(d);
    }
    for (const [reg, list] of Object.entries(byReg)) {
      h += '<div class="small" style="color:var(--gold);margin:12px 0 4px">' + esc(reg) + " &mdash; " + list.length + "</div>";
      for (const d of list) {
        h += '<div class="small memorial-row"><b>' + esc(d.name) + "</b> <span class=\"muted\">" + esc(d.line) + ".</span></div>";
      }
    }
    h += "</div>";
  }
  if (a.wounded.length) {
    h += '<div class="sechead">The wounded</div>' + a.wounded.map((w) => '<div class="small">&middot; ' + esc(w) + "</div>").join("");
  }
  const newTraditions = S.regiments.flatMap((r) =>
    r.traditions.slice(-1).map((t) => r.name + ': &ldquo;' + t + "&rdquo;")
  );
  if (newTraditions.length) {
    h += '<div class="sechead">Colors earned</div>' +
      newTraditions.map((x) => '<div class="small"><span class="tag station">' + x + "</span></div>").join("");
  }
  h += '<div class="center mt">';
  if (a.diveIndex + 1 < a.divesTotal) {
    h += '<button class="primary" data-action="push-dive">Push to dive ' + (a.diveIndex + 2) + "</button> ";
    h += '<button data-action="withdraw-dive">Withdraw (war score -5)</button>';
  } else {
    h += '<button class="primary" data-action="end-campaign">Return to Evensbrook</button>';
  }
  h += "</div></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Heir                                                                 */
/* ------------------------------------------------------------------ */

export function renderHeir(): string {
  let h = '<div class="panel"><div class="sechead">The chair is empty</div>';
  h += '<p class="muted small">Choose who takes the general&rsquo;s chair. The grudges, debts, and reputation come with it.</p>';
  h += '<div class="grid c3">';
  for (const o of aliveOfficers()) {
    h += '<div class="card pick" data-action="choose-heir" data-id="' + o.id + '">' +
      '<div class="candhead">' + portrait(o, 48) +
      "<div><h4>" + esc(o.name) + ' <span class="muted small">age ' + o.age + "</span></h4>" +
      '<div class="small" style="color:var(--good)">' + esc(postOf(o)) + "</div>" +
      '<div class="rateblock"><span class="micro">Rating</span><b>' + rating(o) + "</b></div>" +
      traitTags(o) + quirkTag(o) + "</div></div></div>";
  }
  h += "</div>";
  h += '<div class="center mt"><button data-action="choose-stranger">Or bring in a stranger</button></div></div>';
  return h;
}

/* ------------------------------------------------------------------ */
/* Diary                                                                */
/* ------------------------------------------------------------------ */

const DIARY_FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["battle", "Battles"],
  ["officer", "Officers"],
  ["supply", "Supply"],
  ["weather", "Weather"],
  ["war", "War"],
];

export function renderDiary(): string {
  const S = getState();
  const f = S.logFilter || "all";
  const st = S.stats;
  let h = '<div class="stathead">' +
    statCell("Entries", String(S.log.length)) +
    statCell("Victories", String(st.victories), "gn") +
    statCell("Fallen", String(st.fallen), "rd") +
    statCell("Spoils earned", String(st.spoilsEarned), "cy") +
    "</div>";
  h += '<div class="panel"><div class="row"><div class="sechead" style="margin:0">War diary</div><div class="spacer"></div>';
  for (const [id, label] of DIARY_FILTERS) {
    h += '<button class="linkbtn" data-action="log-filter" data-id="' + id + '"' +
      (f === id ? ' style="color:var(--gold)"' : "") + ">" + label + "</button>";
  }
  const wr = S.warRecord;
  h += '</div><div class="logstream compact mt">' +
    logStreamHTML(f === "all" ? S.log : S.log.filter((e) => e.kind === f)) +
    "</div>";
  if (wr && wr.campaigns.length) {
    h += '<div class="sechead mt">War history <span class="r">' + esc(wr.name) + "</span></div>";
    h += wr.campaigns.map((c) =>
      '<div class="sitrow"><span class="t">' + esc(c.outcome.toUpperCase()) + '</span><span><span class="h">' +
      esc(c.name) + '</span><div class="b">' + esc(c.note) + " &mdash; " + c.divesWon + "/" + c.dives + " dives taken.</div></span></div>"
    ).join("");
  }
  h += "</div>";
  return h;
}
