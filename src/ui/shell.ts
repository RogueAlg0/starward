// UI shell: title bar, tab nav, the render dispatcher, and the live
// voyage view updater (streams new log entries, refreshes the status
// panel without killing the log).
import type { Screen } from "../types";
import { getState } from "../game/state";
import { esc } from "./helpers";
import { logEntryHTML } from "./logEntry";
import {
  renderCommission,
  renderCrew,
  renderHeir,
  renderLog,
  renderShip,
  renderStation,
  renderVoyageRun,
  renderVoyageSetup,
} from "./screens";

export function headerHTML(): string {
  const S = getState();
  const cap = S.captain ? esc(S.captain.name) + ", age " + S.captain.age : "no captain";
  const ship = S.ship ? esc(S.ship.name) : "no ship";
  return (
    '<div class="titlebar"><h1>STARWARD</h1>' +
    '<div class="sub">Day ' + S.day + " &nbsp;|&nbsp; " + ship +
    " &nbsp;|&nbsp; Captain " + cap +
    ' &nbsp;|&nbsp; <b style="color:var(--gold)">' + S.credits + " cr</b></div></div>"
  );
}

export function tabsHTML(): string {
  const S = getState();
  const tabs: Array<[Screen, string]> = [
    ["ship", "Ship"],
    ["crew", "Crew"],
    ["voyage", "Voyage"],
    ["log", "Captain's Log"],
  ];
  let h = '<nav class="tabs">';
  for (const [id, label] of tabs) {
    const dis = S.phase === "commission" || S.phase === "heir" ? " disabled" : "";
    const act = S.screen === id ? " active" : "";
    h += '<button class="' + act + '"' + dis + ' data-action="tab" data-id="' + id + '">' + label + "</button>";
  }
  h += "</nav>";
  return h;
}

export function goTab(screen: Screen): void {
  const S = getState();
  S.screen = screen;
  render();
}

export function render(): void {
  const S = getState();
  const app = document.getElementById("app");
  if (!app) return;
  let h: string;
  if (S.phase === "commission") {
    h = headerHTML() + renderCommission();
  } else if (S.phase === "heir") {
    h = headerHTML() + renderHeir();
  } else if (S.phase === "voyage") {
    h = headerHTML() + tabsHTML() + renderVoyageRun();
  } else {
    h = headerHTML() + tabsHTML();
    if (S.screen === "ship") h += renderShip();
    else if (S.screen === "crew") h += renderCrew();
    else if (S.screen === "voyage") h += S.phase === "station" ? renderStation() : renderVoyageSetup();
    else h += renderLog();
  }
  app.innerHTML = h;
}

export function updateVoyageView(): void {
  const S = getState();
  const el = document.getElementById("voylog");
  if (!el) return;
  // append only the newest entries since last paint (count lives on state,
  // because the status panel above gets re-rendered around the log)
  const from = S._painted || 0;
  const fresh = S.log.slice(from);
  for (const e of fresh) {
    el.appendChild(logEntryHTML(e));
  }
  S._painted = S.log.length;
  el.scrollTop = el.scrollHeight;
  // refresh the status panel without killing the log
  const panels = document.querySelectorAll("#app .panel");
  if (panels.length) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderVoyageRun();
    const newPanel = tmp.querySelector(".panel");
    if (newPanel) panels[0].replaceWith(newPanel);
  }
}
