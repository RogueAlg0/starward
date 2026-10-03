// One log entry as a DOM element, with an ASCII flourish before
// voyage headers. textContent keeps player-entered strings safe.
import type { LogEntry } from "../types";
import { VOYAGE_DIVIDER } from "../art/setpieces";

export function logEntryHTML(e: LogEntry): HTMLElement {
  const div = document.createElement("div");
  if (e.kind === "voyage") {
    const rule = document.createElement("div");
    rule.className = "logdiv";
    rule.textContent = VOYAGE_DIVIDER;
    div.appendChild(rule);
  }
  const p = document.createElement("div");
  p.className = "entry " + e.kind + (e.ascii ? " ascii" : "");
  p.textContent = e.text;
  div.appendChild(p);
  return div;
}
