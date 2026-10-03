// The war diary: every entry is chronological and kept forever.
// Writing discipline: each entry shows attempt, odds, actors, outcome, cost.
// Cause sits adjacent to effect. Nothing here could come from a random
// sentence generator.
import type { LogKind, Objective } from "../types";
import { doctrineById } from "./world";
import { getState } from "./state";

export function logAdd(text: string, kind?: LogKind, tick?: number, tone?: "good" | "bad"): void {
  const S = getState();
  S.log.push({ day: S.day, tick, text, kind: kind || "plain", tone });
}

// ASCII art entries (march maps) render preformatted in the diary stream.
export function logAscii(text: string): void {
  const S = getState();
  S.log.push({ day: S.day, text, kind: "plain", ascii: true });
}

export function logCampaignHeader(o: Objective): void {
  const S = getState();
  logAdd(
    "CAMPAIGN " +
      (S.campaignCount + 1) +
      ": " +
      o.name +
      " at " +
      o.place +
      ", " +
      o.ticks +
      " days under " +
      doctrineById(S.doctrine).name.toLowerCase() +
      " doctrine. " +
      o.why,
    "campaign"
  );
}
