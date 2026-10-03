// One log entry as an HTML string. esc() keeps player-entered strings safe.
// Campaign/general entries get the divider flourish; battle/officer/supply/
// weather entries get category chips; tone drives good/bad coloring.
import type { LogEntry } from "../types";
import { esc } from "./helpers";

const WAR_DIVIDER = "· · ─ · ·";

const CHIP: Partial<Record<LogEntry["kind"], string>> = {
  battle: "Battle",
  officer: "Officer",
  supply: "Supply",
  weather: "Weather",
  war: "War",
};

function kindClass(kind: LogEntry["kind"]): string {
  if (kind === "campaign") return "voyage";
  if (kind === "general") return "captain";
  return kind;
}

export function logEntryHTML(e: LogEntry): string {
  let h = "";
  if (e.kind === "campaign" || e.kind === "general") {
    h += '<div class="logdiv">' + WAR_DIVIDER + "</div>";
  }
  const chip = CHIP[e.kind];
  const tick =
    e.tick != null
      ? '<span class="readout" style="color:var(--dim);font-size:11px;margin-right:8px">T' + e.tick + "</span>"
      : "";
  h +=
    '<div class="entry ' + kindClass(e.kind) + (e.tone ? " " + e.tone : "") + '">' +
    (chip ? '<span class="dchip ' + e.kind + '">' + chip + "</span>" : "") +
    tick +
    esc(e.text) +
    "</div>";
  return h;
}

/** Full stream with day dividers, for the diary and the campaign view. */
export function logStreamHTML(entries: LogEntry[]): string {
  let h = "";
  let lastDay = -1;
  for (const e of entries) {
    if (e.day !== lastDay) {
      h += '<div class="day">Day ' + e.day + "</div>";
      lastDay = e.day;
    }
    h += logEntryHTML(e);
  }
  return h;
}
