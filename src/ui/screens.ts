// All screens as HTML strings. Event wiring lives in main.ts via
// data-action / data-input attributes (no inline handlers).
import type { CrewMember, Drama, Screen } from "../types";
import { DOCTRINES, HULLS, STATIONS, hullById } from "../game/data";
import { esc } from "./helpers";
import { bar } from "./helpers";
import { getState } from "../game/state";
import {
  aliveCrew,
  bestRole,
  crewById,
  traitById,
} from "../game/crew";
import { dramaChoices, dramaText, pickStation } from "../game/station";
import { ordinal } from "../game/captain";
import { riskDesc } from "../game/contracts";
import { logEntryHTML } from "./logEntry";
import { shipSigil } from "../art/sigil";
import { crewIdenticon } from "../art/identicon";
import { asciiRule, starMapSVG, shipSchematicSVG } from "../art/setpieces";

export function traitTags(crew: CrewMember): string {
  return crew.traits
    .map((id) => {
      const t = traitById(id);
      const name = t ? t.name : id;
      const desc = t ? t.desc : "";
      return '<span class="tag trait" title="' + esc(desc) + '">' + esc(name) + "</span>";
    })
    .join("");
}

export function relText(crew: CrewMember): string {
  if (!crew.relations.length) return '<span class="muted small">no ties yet</span>';
  return crew.relations
    .map((r) => {
      const other = crewById(r.with);
      const nm = other ? other.name : "a departed soul";
      return '<span class="tag">' + esc(r.type) + ": " + esc(nm) + "</span>";
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/* Commission                                                          */
/* ------------------------------------------------------------------ */

export function renderCommission(): string {
  const S = getState();
  const c = S.commission;
  let h = '<div class="panel"><h2>Commission your ship</h2>';
  h +=
    '<p class="muted">You are the captain. You will manage, never pilot. ' +
    "Name your vessel, choose a hull, draft a crew of six. The chronicle begins the moment you sign.</p>";
  h += '<div class="grid c2">';
  h +=
    '<div><label>Ship name</label><div class="row">' +
    shipSigil(c.shipName || "Unnamed", c.hullId || "frigate", 64) +
    '<div style="flex:1"><input type="text" id="shipname" data-input="ship-name" value="' +
    esc(c.shipName) +
    '">' +
    '<button class="mt" data-action="reroll-ship">Reroll name</button></div></div></div>';
  h +=
    '<div><label>Captain name</label><input type="text" id="capname" data-input="cap-name" value="' +
    esc(c.captainName) +
    '">' +
    '<button class="mt" data-action="reroll-cap">Reroll name</button></div>';
  h += "</div></div>";

  h += '<div class="panel"><h2>Choose a hull</h2><div class="grid c3">';
  for (const hull of HULLS) {
    const sel = c.hullId === hull.id ? " selected" : "";
    h +=
      '<div class="card pick' + sel + '" data-action="pick-hull" data-id="' + hull.id + '">' +
      '<div class="row">' + shipSigil("preview|" + hull.id, hull.id, 72) +
      "<h4>" + esc(hull.name) + "</h4></div>" +
      '<div class="small muted">' + esc(hull.desc) + "</div>" +
      '<div class="small mt">Cargo ' + hull.cargo + " &nbsp; Hull " + hull.hull +
      " &nbsp; Guns " + hull.guns + " &nbsp; Scan " + hull.scan + "</div>" +
      '<div class="small" style="color:var(--gold)">' + esc(hull.bonus) + "</div></div>";
  }
  h += "</div></div>";

  h += '<div class="panel"><h2>Draft your crew: pick ' + (6 - c.picked.length) + " more</h2>";
  h +=
    '<p class="muted small">Six souls. Their traits, hooks, and ties to each other are the story engine. Choose people, not stats.</p>';
  h += '<div class="grid c3">';
  for (const cand of S.candidates) {
    const sel = c.picked.includes(cand.id) ? " selected" : "";
    const rels = cand.relations
      .map((r) => {
        const other = S.candidates.find((x) => x.id === r.with);
        return other ? r.type + ": " + other.name.split(" ")[0] : "";
      })
      .filter(Boolean)
      .join(", ");
    h +=
      '<div class="card pick' + sel + '" data-action="toggle-pick" data-id="' + cand.id + '">' +
      '<div class="candhead">' + crewIdenticon(cand.name + "|" + cand.id, 48) +
      "<div><h4>" + esc(cand.name) + ' <span class="muted small">age ' + cand.age + "</span></h4>" +
      traitTags(cand) + "</div></div>" +
      '<div class="small dim">Hook: ' + esc(cand.hook) + "</div>" +
      (rels ? '<div class="small" style="color:var(--warn)">' + esc(rels) + "</div>" : "") +
      '<div class="small muted mt">Best at: ' + bestRole(cand) + "</div></div>";
  }
  h += "</div>";
  const ready = c.hullId && c.picked.length === 6;
  h +=
    '<div class="center mt"><button class="primary" ' + (ready ? "" : "disabled") +
    ' data-action="finish-commission">Sign the commission</button></div></div>';
  return h;
}

/* ------------------------------------------------------------------ */
/* Ship screen                                                         */
/* ------------------------------------------------------------------ */

function heirHint(): string {
  const candidates = aliveCrew().filter((m) => m.age >= 25);
  if (!candidates.length) return "none yet";
  const best = candidates.slice().sort((a, b) => b.morale - a.morale)[0];
  return best.name + " (the crew would follow them)";
}

export function renderShip(): string {
  const S = getState();
  if (!S.ship || !S.captain) return "";
  const hull = hullById(S.ship.hullId);
  let h =
    '<div class="panel"><div class="shiphead">' +
    shipSigil(S.ship.name, S.ship.hullId, 110) +
    '<div class="idblock"><h2>' + esc(S.ship.name) +
    ' <span class="muted small">' + esc(hull.name) + " class</span></h2>";
  h +=
    '<div class="kv"><dt>Condition</dt><dd>' + Math.round(S.ship.condition) + " / " +
    S.ship.maxCondition + bar((S.ship.condition / S.ship.maxCondition) * 100, "hullbar") + "</dd>";
  h += "<dt>Credits</dt><dd>" + S.credits + " cr</dd>";
  h += "<dt>Cargo hold</dt><dd>" + hull.cargo + " tons</dd>";
  h += "<dt>Voyages</dt><dd>" + S.voyageCount + "</dd></div></div></div>";

  // signature set piece: the ship schematic, scars and quirks marked
  h += '<div class="panel"><h2>Ship schematic</h2>';
  h += '<div class="schemwrap">' + shipSchematicSVG(S.ship) + "</div>";
  h +=
    '<p class="muted small center">Battle damage marked in red, numbered to match the scar record. ' +
    "Quirks marked in gold. Drawn from the ship's own service history.</p></div>";

  if (S.ship.scars.length) {
    h += '<h3 class="mt">Scars</h3>';
    h += S.ship.scars
      .map(
        (s, i) =>
          '<div class="small"><span class="tag scar">#' + (i + 1) + " scar</span><b>" + esc(s.name) +
          "</b>: " + esc(s.story) + "</div>"
      )
      .join("");
  } else {
    h += '<p class="muted small mt">No scars yet. Give it time.</p>';
  }
  if (S.ship.quirks.length) {
    h += '<h3 class="mt">Quirks</h3>';
    h += S.ship.quirks
      .map(
        (q) =>
          '<div class="small"><span class="tag quirk">quirk</span><b>' + esc(q.name) +
          "</b>: " + esc(q.story) + "</div>"
      )
      .join("");
  }
  h += "</div>";

  h += '<div class="panel"><h2>Captain ' + esc(S.captain.name) + "</h2>";
  h += '<div class="kv"><dt>Age</dt><dd>' + S.captain.age + "</dd>";
  h += "<dt>Generation</dt><dd>" + ordinal(S.captain.generation) + " captain of this chronicle</dd>";
  h += "<dt>Heir apparent</dt><dd>" + esc(heirHint()) + "</dd></div>";
  if (S.captain.age >= 60) {
    h +=
      '<div class="notice mt">The captain is ' + S.captain.age +
      ". The chair will not stay warm forever. Name an heir in your heart, if not on paper.</div>";
  }
  h += "</div>";

  h += '<div class="panel"><h2>Dynasty</h2><div class="row">';
  h += '<button data-action="export">Export save (JSON)</button>';
  h +=
    '<label class="small muted" style="margin:0">Import save <input type="file" data-input="import" accept=".json" style="width:auto"></label>';
  h += '<span class="spacer"></span>';
  h += '<button class="danger" data-action="new-dynasty">New dynasty</button>';
  h +=
    "</div><p class=\"muted small\">Autosaves after every phase. Export keeps your chronicle safe; import resumes it anywhere.</p></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Crew screen                                                         */
/* ------------------------------------------------------------------ */

export function renderCrew(): string {
  const S = getState();
  if (!S.ship) return "";
  let h = '<div class="panel"><h2>Crew of the ' + esc(S.ship.name) + "</h2>";
  h +=
    '<p class="muted small">Assign each station. The officer on a station decides the related checks during a voyage. One soul stays off duty and rests.</p>';
  h +=
    '<div style="overflow-x:auto"><table class="roster"><tr><th></th><th>Name</th><th>Health</th><th>Morale</th><th>Station</th><th>Traits / hook</th></tr>';
  for (const m of S.crew) {
    if (!m.alive) continue;
    h += "<tr><td>" + crewIdenticon(m.name + "|" + m.id, 40) + "</td>";
    h +=
      "<td><b>" + esc(m.name) + '</b> <span class="muted small">age ' + m.age +
      "<br>" + esc(m.hook) + "</span><br>" + relText(m) + "</td>";
    h += "<td>" + Math.round(m.health) + bar(m.health, "hp") + "</td>";
    h += "<td>" + Math.round(m.morale) + bar(m.morale, "mor") + "</td>";
    h += '<td><select data-input="assign" data-id="' + m.id + '">';
    h += '<option value="">off duty</option>';
    for (const st of STATIONS) {
      const taken = S.crew.some((o) => o.alive && o.station === st.id && o.id !== m.id);
      h +=
        '<option value="' + st.id + '"' +
        (m.station === st.id ? " selected" : "") +
        (taken ? " disabled" : "") +
        ">" + st.label + (taken ? " (filled)" : "") + "</option>";
    }
    h += "</select></td>";
    h += "<td>" + traitTags(m) + "</td></tr>";
  }
  h += "</table></div>";
  const dead = S.crew.filter((m) => !m.alive);
  if (dead.length) {
    h +=
      '<h3 class="mt">Fallen</h3><p class="muted small">' +
      dead.map((m) => esc(m.name)).join(", ") + " are remembered in the log.</p>";
  }
  h +=
    '<div class="center mt"><button class="primary" data-action="tab" data-id="voyage">Back to the voyage board</button></div>';
  h += "</div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Voyage setup: contracts, star map, doctrine                          */
/* ------------------------------------------------------------------ */

export function renderVoyageSetup(): string {
  const S = getState();
  let h = "";
  if (S.voyageCount === 0 && !S.guideDismissed) {
    h +=
      '<div class="panel guide"><h2>Your first command</h2>' +
      "<ol>" +
      "<li><b>Pick a contract.</b> Three offers, three tempers of dark. Safe lanes pay less and bite less.</li>" +
      "<li><b>Pick a doctrine.</b> Your standing order for the whole voyage: cautious, balanced, or bold.</li>" +
      "<li><b>Press Depart.</b> The voyage resolves live, day by day, and the log writes itself.</li>" +
      "</ol>" +
      '<button class="gold" data-action="dismiss-guide">Understood</button></div>';
  }
  // signature set piece: the star map board
  h += '<div class="panel"><h2>The board</h2>';
  h +=
    '<p class="muted small">Known space, per this morning\'s charts. Pick a contract below and its route lights up.</p>';
  h += '<div class="mapwrap">' + starMapSVG(S.contracts, S.activeContract) + "</div></div>";

  h += '<div class="panel"><h2>Voyage ' + (S.voyageCount + 1) + ": choose a contract</h2>";
  h +=
    '<p class="muted small">Three offers on the board. Risk sets the pay and the temper of the dark between ports. ' +
    "Your doctrine shapes every event to come.</p>";
  h += '<div class="grid c3">';
  const riskColor: Record<string, string> = { safe: "good", risky: "warn", perilous: "bad" };
  for (const c of S.contracts) {
    h +=
      '<div class="card pick' + (S.activeContract === c.id ? " selected" : "") +
      '" data-action="pick-contract" data-id="' + c.id + '">' +
      "<h4>" + esc(c.name) + "</h4>" +
      '<div class="small muted">' + esc(c.from) + " to " + esc(c.to) + "</div>" +
      '<div class="small mt">Risk: <b style="color:var(--' + riskColor[c.risk] + ')">' + c.risk +
      "</b> <span class='muted'>" + esc(riskDesc(c.risk)) + "</span></div>" +
      '<div class="small">Duration: ' + c.ticks + " days &nbsp; Pay: <b style='color:var(--gold)'>" +
      c.pay + " cr</b></div></div>";
  }
  h += "</div></div>";

  h += '<div class="panel"><h2>Doctrine</h2><div class="grid c3">';
  for (const d of DOCTRINES) {
    h +=
      '<div class="card pick' + (S.doctrine === d.id ? " selected" : "") +
      '" data-action="pick-doctrine" data-id="' + d.id + '"><h4>' + esc(d.name) + "</h4>" +
      '<div class="small muted">' + esc(d.desc) + "</div></div>";
  }
  h += "</div>";
  const ready = S.activeContract !== null && S.activeContract !== undefined;
  h +=
    '<div class="center mt"><button class="primary" ' + (ready ? "" : "disabled") +
    ' data-action="launch">Depart</button>';
  if (!ready) h += ' <span class="muted small">pick a contract first</span>';
  h += "</div></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Voyage run                                                          */
/* ------------------------------------------------------------------ */

export function renderVoyageRun(): string {
  const S = getState();
  const c = S.contracts.find((x) => x.id === S.activeContract);
  if (!c || !S.ship) return "";
  const pct = Math.round((S.tick / S.tickTotal) * 100);
  let h =
    '<div class="panel"><h2>' + esc(c.name) + ": " + esc(c.from) + " to " + esc(c.to) + "</h2>";
  h += '<div class="row"><div style="flex:1">' + bar(pct, "hullbar") + "</div>";
  h += '<div class="small muted">Day ' + S.tick + " of " + S.tickTotal + "</div>";
  h += '<button data-action="speed">Speed: ' + S.voyageSpeed + "x</button>";
  h += '<button data-action="skip">Skip to arrival</button></div>';
  h += '<div class="row mt small"><span class="stat">Hull <b>' + Math.round(S.ship.condition) + "</b></span>";
  h += '<span class="stat">Credits <b>' + S.credits + "</b></span>";
  const hurt = aliveCrew().filter((m) => m.health < 60).length;
  if (hurt) h += '<span class="stat" style="color:var(--bad)">Injured: <b>' + hurt + "</b></span>";
  h += "</div></div>";
  h += '<div class="logstream" id="voylog"></div>';
  if (S.voyageCount === 0) {
    h +=
      '<p class="muted small mt">The log streams live below. Speed toggles the pace, Skip jumps straight to arrival. Nothing here can hurt your save: explore freely.</p>';
  }
  return h;
}

/* ------------------------------------------------------------------ */
/* Station screen                                                      */
/* ------------------------------------------------------------------ */

export function renderStation(): string {
  const S = getState();
  let h = "";
  if (S.needsNewHull) {
    h += '<div class="panel"><h2>The ' + esc(S._lostName || "ship") + " is gone</h2>";
    h +=
      '<p class="muted">Insurance covers a new hull, free and clear. The name, the log, and the scars that matter carry over. Choose her successor.</p>';
    h +=
      '<div><label>Ship name</label><input type="text" id="newshipname" value="' +
      esc((S._lostName || "Starward") + " II") + '"></div>';
    h += '<div class="grid c3 mt">';
    for (const hull of HULLS) {
      const sel = S._newHullId === hull.id ? " selected" : "";
      h +=
        '<div class="card pick' + sel + '" data-action="pick-new-hull" data-id="' + hull.id + '">' +
        '<div class="row">' + shipSigil("preview|" + hull.id, hull.id, 64) +
        "<h4>" + esc(hull.name) + "</h4></div>" +
        '<div class="small muted">' + esc(hull.desc) + "</div></div>";
    }
    h += "</div>";
    h +=
      '<div class="center mt"><button class="primary" ' + (S._newHullId ? "" : "disabled") +
      ' data-action="commission-replacement">Commission her</button></div></div>';
    return h;
  }

  if (!S.ship) return h;
  h += '<div class="panel"><h2>Station: ' + esc(pickStation()) + "</h2>";
  h +=
    '<p class="muted small">Voyage ' + S.voyageCount +
    " complete. Repair, hire, settle shipboard business, then pick the next contract.</p>";

  // repair and resupply
  const repairCost = Math.ceil((S.ship.maxCondition - S.ship.condition) * 2);
  h +=
    '<div class="row"><button ' + (repairCost <= 0 || S.credits < repairCost ? "disabled" : "") +
    ' data-action="repair">Repair hull (' + repairCost + " cr)</button>";
  h +=
    '<button ' + (S.credits < 40 ? "disabled" : "") +
    ' data-action="restock">Restock and celebrate (40 cr, +morale)</button>';
  h +=
    '<span class="muted small">Hull ' + Math.round(S.ship.condition) + "/" + S.ship.maxCondition +
    " &nbsp; Credits " + S.credits + "</span></div></div>";

  // drama
  if (S.dramas && S.dramas.length) {
    h += '<div class="panel"><h2>Shipboard business</h2>';
    S.dramas.forEach((d: Drama, i: number) => {
      h += '<div class="notice"><p>' + esc(dramaText(d)) + "</p><div class='row'>";
      dramaChoices(d).forEach((label: string, j: number) => {
        h +=
          '<button data-action="drama" data-i="' + i + '" data-j="' + j + '">' + esc(label) + "</button>";
      });
      h += "</div></div>";
    });
    h += "</div>";
  }

  // hiring
  h += '<div class="panel"><h2>Hiring hall</h2>';
  if (aliveCrew().length >= 8) {
    h += '<p class="muted small">Your crew is full (8 bunks, 8 souls). Release someone below to make room.</p>';
  } else if (!S.hirePool.length) {
    h += '<p class="muted small">No candidates on this station.</p>';
  } else {
    h += '<div class="grid c3">';
    for (const m of S.hirePool) {
      h +=
        '<div class="card"><div class="candhead">' + crewIdenticon(m.name + "|" + m.id, 44) +
        "<div><h4>" + esc(m.name) + ' <span class="muted small">age ' + m.age + "</span></h4>" +
        traitTags(m) + "</div></div>" +
        '<div class="small dim">Hook: ' + esc(m.hook) + "</div>" +
        '<div class="small muted">Best at: ' + bestRole(m) + "</div>" +
        '<div class="center mt"><button ' + (S.credits < (m.fee || 0) ? "disabled" : "") +
        ' data-action="hire" data-id="' + m.id + '">Sign (' + m.fee + " cr)</button></div></div>";
    }
    h += "</div>";
  }
  // release crew
  const releasable = aliveCrew();
  if (releasable.length > 1) {
    h += '<h3 class="mt">Release crew</h3><div class="row">';
    for (const m of releasable) {
      h +=
        '<button class="danger small" data-action="release" data-id="' + m.id + '">Release ' +
        esc(m.name.split(" ")[0]) + "</button>";
    }
    h += "</div>";
  }
  h += "</div>";

  h += '<div class="center"><button class="primary" data-action="to-setup">Choose the next contract</button></div>';
  return h;
}

/* ------------------------------------------------------------------ */
/* Heir                                                                */
/* ------------------------------------------------------------------ */

export function renderHeir(): string {
  const S = getState();
  let h = '<div class="panel"><h2>The chair is empty</h2>';
  h += '<div class="logdiv">' + asciiRule() + "</div>";
  h +=
    '<p class="muted">' +
    (S.fateKind === "die"
      ? "The captain is gone. The chronicle does not stop for grief; it records it."
      : "The captain has earned their rest. The chronicle does not stop; it turns a page.") +
    " Name the heir.</p>";
  h += '<div class="grid c3">';
  for (const m of aliveCrew()) {
    h +=
      '<div class="card pick" data-action="choose-heir" data-id="' + m.id + '">' +
      '<div class="candhead">' + crewIdenticon(m.name + "|" + m.id, 48) +
      "<div><h4>" + esc(m.name) + ' <span class="muted small">age ' + m.age + "</span></h4>" +
      traitTags(m) + "</div></div>" +
      '<div class="small dim">' + esc(m.hook) + "</div></div>";
  }
  h +=
    '<div class="card pick" data-action="choose-stranger">' +
    "<h4>A stranger</h4>" +
    '<div class="small muted">A decorated officer from another line, seeking a chair. Younger, unknown, hungry.</div></div>';
  h += "</div></div>";
  return h;
}

/* ------------------------------------------------------------------ */
/* Captain's log                                                       */
/* ------------------------------------------------------------------ */

const LOG_FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["voyage", "Voyages"],
  ["captain", "Captain"],
  ["events", "Events"],
];

function logMatches(kind: string, f: string): boolean {
  if (f === "all") return true;
  if (f === "voyage") return kind === "voyage";
  if (f === "captain") return kind === "captain";
  if (f === "events") return kind === "good" || kind === "bad";
  return true;
}

export function renderLog(): string {
  const S = getState();
  const f = S.logFilter || "all";
  let h = '<div class="panel"><h2>Captain\'s log</h2>';
  h +=
    '<p class="muted small">The keepsake. Every voyage, every scar, every name. ' +
    S.log.length + " entries across " + S.voyageCount + " voyages.</p>";
  h += '<div class="row">';
  for (const [id, label] of LOG_FILTERS) {
    h +=
      '<button class="' + (f === id ? "gold" : "") + '" data-action="log-filter" data-id="' + id + '">' +
      label + "</button>";
  }
  h += "</div></div>";
  h += '<div class="logstream compact" id="fulllog"></div>';
  // fill after insert
  setTimeout(() => {
    const el = document.getElementById("fulllog");
    if (!el) return;
    let lastDay = -1;
    for (const e of S.log) {
      if (!logMatches(e.kind, f)) continue;
      if (e.day !== lastDay) {
        const d = document.createElement("div");
        d.className = "day mono";
        d.textContent = "Day " + e.day;
        el.appendChild(d);
        lastDay = e.day;
      }
      el.appendChild(logEntryHTML(e));
    }
    el.scrollTop = el.scrollHeight;
  }, 0);
  return h;
}

export type { Screen };
