// UI shell: dense header, the bottom command bar (MUSTER / GARRISON /
// CAMPAIGN / DIARY on every screen), the render dispatcher, and the live
// campaign view updater.
import type { Screen } from "../types";
import { GAME_TITLE } from "../game/world";
import { getState } from "../game/state";
import { esc } from "./helpers";
import { logStreamHTML } from "./logEntry";
import {
  renderAftermath,
  renderCampaignRun,
  renderCampaignSetup,
  renderDiary,
  renderGarrison,
  renderHeir,
  renderMuster,
} from "./screens";

export function headerHTML(): string {
  const S = getState();
  const gen = S.general
    ? esc(S.general.name) + " // AGE " + S.general.age
    : "NO GENERAL";
  return (
    '<div class="titlebar"><h1>' + esc(GAME_TITLE) + ' <span class="muted">// EVENSBROOK</span></h1>' +
    '<div class="sub readout"><span class="tseg">DAY ' + S.day + "</span>" +
    '<span class="tseg">' + gen + "</span>" +
    '<span class="tseg gold">' + S.spoils + " SPOILS</span></div></div>"
  );
}

const TABS: Array<[Screen, string, string]> = [
  ["muster", "Muster", "\u25C6"],
  ["garrison", "Garrison", "\u25A3"],
  ["campaign", "Campaign", "\u25CE"],
  ["diary", "Diary", "\u2261"],
];

export function tabsHTML(): string {
  const S = getState();
  let h = '<nav class="tabs">';
  for (const [id, label, tic] of TABS) {
    const dis =
      S.phase === "muster" || S.phase === "heir" ? (id === "muster" ? "" : " disabled") : "";
    const act = S.screen === id ? " active" : "";
    h += '<button class="' + act + '"' + dis + ' data-action="tab" data-id="' + id + '">' +
      '<span class="tic">' + tic + "</span>" + label + "</button>";
  }
  h += "</nav>";
  return h;
}

export function goTab(screen: Screen): void {
  const S = getState();
  S.screen = screen;
  render();
}

function screenHTML(): string {
  const S = getState();
  if (S.phase === "muster") return renderMuster();
  if (S.phase === "heir") return renderHeir();
  switch (S.screen) {
    case "muster":
      return renderMuster();
    case "garrison":
      return S.phase === "garrison" ? renderGarrison() : renderMuster();
    case "campaign":
      if (S.phase === "campaign_setup") return renderCampaignSetup();
      if (S.phase === "aftermath") return renderAftermath();
      if (S.phase === "garrison") return renderCampaignSetup();
      return renderMuster();
    case "diary":
    default:
      return renderDiary();
  }
}

export function render(): void {
  const S = getState();
  const app = document.getElementById("app");
  if (!app) return;
  let h: string;
  if (S.phase === "campaign") {
    h = headerHTML() + renderCampaignRun() + tabsHTML();
  } else if (S.phase === "muster" || S.phase === "heir") {
    h = headerHTML() + screenHTML() + tabsHTML();
  } else {
    h = headerHTML() + screenHTML() + tabsHTML();
  }
  app.innerHTML = h;
}

export function updateCampaignView(): void {
  const S = getState();
  const el = document.getElementById("voylog");
  if (!el) return;
  const from = S._painted || 0;
  const fresh = S.log.slice(from);
  if (fresh.length) el.insertAdjacentHTML("beforeend", logStreamHTML(fresh));
  S._painted = S.log.length;
  el.scrollTop = el.scrollHeight;
  // refresh the status panel without killing the diary
  const panels = document.querySelectorAll("#app .panel");
  if (panels.length) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderCampaignRun();
    const newPanel = tmp.querySelector(".panel");
    if (newPanel) panels[0].replaceWith(newPanel);
  }
}
