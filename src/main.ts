// Entry point: init, delegated event handling, headless test hooks.
import "./index.css";
import "./terminal.css";
import type { Screen } from "./types";
import { getState, loadGame, saveGame, setState, wipeSave } from "./game/state";
import { officerById } from "./game/officers";
import {
  autoAssign,
  assignCommander,
  dismissGuide,
  finishMuster,
  rerollGeneralName,
  startMuster,
  syncMusterInputs,
  togglePick,
} from "./game/muster";
import {
  buyUpgrade,
  drill,
  hireRecruit,
  inspect,
  levy,
  listen,
  rest,
} from "./game/garrison";
import {
  campaignTick,
  dilemmaChoice,
  endCampaignFromDebrief,
  launchDive,
  launchCampaign,
  orderCouncil,
  orderScouts,
  pushDive,
  resolveBattle,
  runCampaignEvent,
  skipCampaign,
  toggleSpeed,
  toCampaignSetup,
  toGarrison,
  withdrawDive,
} from "./game/campaign";
import { chooseHeir, chooseStranger, checkGeneralFate } from "./game/general";
import { logAdd } from "./game/log";
import { exportSave, importSave } from "./game/state";
import { goTab, render } from "./ui/shell";

function pickDiveDoctrine(diveIndex: number, id: string): void {
  const S = getState();
  const d = S.dives[diveIndex];
  if (!d) return;
  d.doctrine = id;
  saveGame(true);
  render();
}

function setLogFilter(id: string): void {
  const S = getState();
  S.logFilter = id;
  render();
}

function confirmNewDynasty(): void {
  const S = getState();
  if (
    window.confirm(
      "Start a new chronicle? This wipes the current war (export first if you want to keep it)."
    )
  ) {
    if (S.campaignTimer) window.clearInterval(S.campaignTimer);
    wipeSave();
    startMuster();
  }
}

function handleAction(action: string, el: HTMLElement): void {
  const d = el.dataset;
  const num = (v: string | undefined) => (v === undefined ? NaN : Number(v));
  switch (action) {
    case "tab":
      goTab(d.id as Screen);
      break;
    case "gen-reroll":
      rerollGeneralName();
      break;
    case "toggle-pick":
      togglePick(num(d.id));
      break;
    case "auto-assign":
      autoAssign();
      break;
    case "finish-muster":
      finishMuster();
      break;
    case "dismiss-guide":
      dismissGuide();
      break;
    case "drill":
      drill(d.id as string);
      break;
    case "rest":
      rest();
      break;
    case "listen":
      listen();
      break;
    case "inspect":
      inspect(d.id as string);
      break;
    case "levy":
      levy(d.id as string);
      break;
    case "hire":
      hireRecruit(num(d.id));
      break;
    case "buy-upgrade":
      buyUpgrade(d.id as string);
      break;
    case "to-setup":
      toCampaignSetup();
      break;
    case "pick-dive-doctrine":
      pickDiveDoctrine(num(d.i), d.id as string);
      break;
    case "launch-dive":
      launchDive(num(d.i));
      break;
    case "order-scouts":
      orderScouts();
      break;
    case "order-council":
      orderCouncil();
      break;
    case "speed":
      toggleSpeed();
      break;
    case "skip":
      skipCampaign();
      break;
    case "dilemma":
      dilemmaChoice(num(d.i), num(d.j));
      break;
    case "push-dive":
      pushDive();
      break;
    case "withdraw-dive":
      withdrawDive();
      break;
    case "end-campaign":
      endCampaignFromDebrief();
      break;
    case "to-garrison":
      toGarrison();
      break;
    case "choose-heir":
      chooseHeir(num(d.id));
      break;
    case "choose-stranger":
      chooseStranger();
      break;
    case "log-filter":
      setLogFilter(d.id as string);
      break;
    case "export":
      exportSave();
      break;
    case "new-dynasty":
      confirmNewDynasty();
      break;
    default:
      break;
  }
}

function handleInput(inputKind: string, el: HTMLInputElement | HTMLSelectElement): void {
  const S = getState();
  switch (inputKind) {
    case "gen-name":
      S.muster.generalName = (el as HTMLInputElement).value;
      break;
    case "assign":
      assignCommander(el.dataset.reg as string, Number((el as HTMLSelectElement).value));
      break;
    case "import": {
      const files = (el as HTMLInputElement).files;
      if (files && files[0]) importSave(files[0], render);
      el.value = "";
      break;
    }
    default:
      break;
  }
}

function wireEvents(): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!t) return;
    const action = t.dataset.action;
    if (!action) return;
    if (action === "finish-muster") syncMusterInputs();
    handleAction(action, t);
  });
  app.addEventListener("input", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-input]") as HTMLInputElement | null;
    if (!t) return;
    if (t.dataset.input !== "gen-name") return;
    handleInput("gen-name", t);
  });
  app.addEventListener("change", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-input]") as HTMLInputElement | HTMLSelectElement | null;
    if (!t) return;
    const kind = t.dataset.input;
    if (!kind || kind === "gen-name") return;
    handleInput(kind, t);
  });
}

function init(): void {
  wireEvents();
  if (loadGame()) {
    const S = getState();
    if (S.phase === "campaign") {
      S.phase = "garrison";
      S.screen = "campaign";
      S.war = null;
      S.activeDive = -1;
      logAdd("The campaign was interrupted by circumstance. The regiments regroup at Evensbrook.", "plain");
    }
    render();
  } else {
    startMuster();
  }
}

// Test hooks: hidden from the UI, used by the headless harness.
(window as unknown as { __sw: unknown }).__sw = {
  get S() {
    return getState();
  },
  set S(v) {
    setState(v);
  },
  fns: {
    startMuster,
    finishMuster,
    togglePick,
    autoAssign,
    assignCommander,
    toCampaignSetup,
    pickDiveDoctrine,
    launchDive,
    launchCampaign,
    campaignTick,
    resolveBattle,
    skipCampaign,
    toggleSpeed,
    orderScouts,
    orderCouncil,
    dilemmaChoice,
    pushDive,
    withdrawDive,
    endCampaignFromDebrief,
    drill,
    rest,
    listen,
    inspect,
    levy,
    hireRecruit,
    buyUpgrade,
    toGarrison,
    checkGeneralFate,
    chooseHeir,
    chooseStranger,
    runCampaignEvent,
    logAdd,
    saveGame,
    loadGame,
    exportSave,
    goTab,
    setLogFilter,
    dismissGuide,
    render,
    officerById,
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { syncMusterInputs };
