// The captain's log: every entry is chronological and kept forever.
import type { Contract, LogKind } from "../types";
import { doctrineById } from "./data";
import { getState } from "./state";

export function logAdd(text: string, kind?: LogKind): void {
  const S = getState();
  S.log.push({ day: S.day, text, kind: kind || "plain" });
}

// ASCII art entries (sector charts) render preformatted in the log stream.
export function logAscii(text: string): void {
  const S = getState();
  S.log.push({ day: S.day, text, kind: "plain", ascii: true });
}

export function logVoyageHeader(contract: Contract): void {
  const S = getState();
  logAdd(
    "VOYAGE " +
      (S.voyageCount + 1) +
      ": " +
      contract.name +
      " (" +
      contract.from +
      " to " +
      contract.to +
      "), " +
      contract.ticks +
      " days under " +
      doctrineById(S.doctrine).name.toLowerCase() +
      " doctrine.",
    "voyage"
  );
}
