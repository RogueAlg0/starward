// Entry point: init, delegated event handling, headless test hooks.
import type { Screen } from "./types";
import { getState, loadGame, saveGame, setState, wipeSave } from "./game/state";
import { crewById, newCrewMember } from "./game/crew";
import { initStarfield } from "./art/starfield";
import { shipSigil } from "./art/sigil";
import { crewIdenticon } from "./art/identicon";
import { hashStr } from "./game/rng";
import { goTab, render } from "./ui/shell";
import {
  chooseHeir,
  chooseStranger,
  checkCaptainFate,
} from "./game/captain";
import {
  finishCommission,
  pickHull,
  rerollCapName,
  rerollShipName,
  startCommission,
  syncCommissionInputs,
  togglePick,
} from "./game/commission";
import { dealContracts } from "./game/contracts";
import {
  commissionReplacement,
  dealDramas,
  dealHirePool,
  dramaChoice,
  hireCrew,
  pickNewHull,
  releaseCrew,
  repairShip,
  restock,
  toVoyageSetup,
} from "./game/station";
import {
  destroyShip,
  endVoyage,
  launchVoyage,
  runVoyageEvent,
  skipVoyage,
  toggleSpeed,
  voyageTick,
} from "./game/voyage";
import { logAdd } from "./game/log";
import { exportSave, importSave } from "./game/state";

function pickContract(id: number): void {
  const S = getState();
  S.activeContract = id;
  saveGame(true);
  render();
}

function pickDoctrine(id: string): void {
  const S = getState();
  S.doctrine = id;
  saveGame(true);
  render();
}

function setLogFilter(id: string): void {
  const S = getState();
  S.logFilter = id;
  render();
}

function dismissGuide(): void {
  const S = getState();
  S.guideDismissed = true;
  saveGame(true);
  render();
}

function assignStation(id: number, stationId: string): void {
  const m = crewById(id);
  if (!m || !m.alive) return;
  m.station = stationId || null;
  saveGame(true);
  render();
}

function confirmNewDynasty(): void {
  const S = getState();
  if (
    window.confirm(
      "Start a new dynasty? This wipes the current chronicle (export first if you want to keep it)."
    )
  ) {
    if (S.voyageTimer) window.clearInterval(S.voyageTimer);
    wipeSave();
    startCommission();
  }
}

function handleAction(action: string, el: HTMLElement): void {
  const d = el.dataset;
  const num = (v: string | undefined) => (v === undefined ? NaN : Number(v));
  switch (action) {
    case "tab":
      goTab(d.id as Screen);
      break;
    case "pick-hull":
      pickHull(d.id as string);
      break;
    case "toggle-pick":
      togglePick(num(d.id));
      break;
    case "reroll-ship":
      rerollShipName();
      break;
    case "reroll-cap":
      rerollCapName();
      break;
    case "finish-commission":
      finishCommission();
      break;
    case "pick-contract":
      pickContract(num(d.id));
      break;
    case "pick-doctrine":
      pickDoctrine(d.id as string);
      break;
    case "launch":
      launchVoyage();
      break;
    case "speed":
      toggleSpeed();
      break;
    case "skip":
      skipVoyage();
      break;
    case "drama":
      dramaChoice(num(d.i), num(d.j));
      break;
    case "hire":
      hireCrew(num(d.id));
      break;
    case "release":
      releaseCrew(num(d.id));
      break;
    case "repair":
      repairShip();
      break;
    case "restock":
      restock();
      break;
    case "to-setup":
      toVoyageSetup();
      break;
    case "pick-new-hull":
      pickNewHull(d.id as string);
      break;
    case "commission-replacement": {
      const input = document.getElementById("newshipname") as HTMLInputElement | null;
      commissionReplacement(input ? input.value : "");
      break;
    }
    case "choose-heir":
      chooseHeir(num(d.id));
      break;
    case "choose-stranger":
      chooseStranger();
      break;
    case "log-filter":
      setLogFilter(d.id as string);
      break;
    case "dismiss-guide":
      dismissGuide();
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
    case "ship-name":
      S.commission.shipName = (el as HTMLInputElement).value;
      break;
    case "cap-name":
      S.commission.captainName = (el as HTMLInputElement).value;
      break;
    case "assign":
      assignStation(Number(el.dataset.id), el.value);
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
    if (action === "finish-commission") syncCommissionInputs();
    handleAction(action, t);
  });
  // text inputs update state live without re-rendering (keeps focus)
  app.addEventListener("input", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-input]") as HTMLInputElement | null;
    if (!t) return;
    const kind = t.dataset.input;
    if (kind !== "ship-name" && kind !== "cap-name") return;
    handleInput(kind, t);
  });
  app.addEventListener("change", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-input]") as HTMLInputElement | HTMLSelectElement | null;
    if (!t) return;
    const kind = t.dataset.input;
    if (!kind || kind === "ship-name" || kind === "cap-name") return;
    handleInput(kind, t);
  });
}

function init(): void {
  initStarfield();
  wireEvents();
  if (loadGame()) {
    // never resume mid-voyage: ticks are live, not persisted
    const S = getState();
    if (S.phase === "voyage") {
      S.phase = "station";
      S.screen = "voyage";
      S.activeContract = null;
      if (!S.contracts.length) dealContracts();
      if (!S.hirePool) dealHirePool();
    }
    render();
  } else {
    startCommission();
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
    startCommission,
    finishCommission,
    pickHull,
    togglePick,
    pickContract,
    pickDoctrine,
    launchVoyage,
    voyageTick,
    endVoyage,
    skipVoyage,
    toggleSpeed,
    dealContracts,
    dealHirePool,
    dealDramas,
    dramaChoice,
    hireCrew,
    goTab,
    releaseCrew,
    repairShip,
    restock,
    toVoyageSetup,
    commissionReplacement,
    checkCaptainFate,
    chooseHeir,
    chooseStranger,
    destroyShip,
    runVoyageEvent,
    newCrewMember,
    logAdd,
    saveGame,
    loadGame,
    exportSave,
    assignStation,
    setLogFilter,
    pickNewHull,
    dismissGuide,
    render,
    shipSigil,
    crewIdenticon,
    hashStr,
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { syncCommissionInputs };
