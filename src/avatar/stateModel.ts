import type {
  ActivityVerb,
  AgentFacts,
  MarkState,
  TurnSettlement,
} from "./types";

export const SETTLEMENT_VISIBLE_MS = 8_000;

export const ACTIVITY_TO_STATE: Readonly<
  Record<ActivityVerb, MarkState>
> = {
  thinking: "thinking",
  searching: "searching",
  browsing: "reading",
  reading: "reading",
  connecting: "orbit",
  writing: "writing",
  coding: "coding",
  generating: "progress",
  "running-commands": "running",
  "on-its-computer": "computing",
  "on-your-computer": "controlling",
  working: "working",
  messaging: "sending",
  sending: "sending",
  waiting: "waiting",
};

const settlementState = (
  settlement: TurnSettlement | null | undefined,
  nowMs: number,
): MarkState | null => {
  if (settlement === null || settlement === undefined) return null;
  if (nowMs >= settlement.settledAtMs + SETTLEMENT_VISIBLE_MS) return null;
  if (settlement.outcome === "success") return "finished";
  if (settlement.outcome === "error") return "failed";
  return null;
};

/**
 * Behavioral reconstruction of the app's active mark state:
 * active work wins, then a recent settlement, then the fallback surface.
 */
export const deriveMarkState = (
  agent: AgentFacts | null | undefined,
  nowMs: number,
  surfaceFacts: AgentFacts | null = null,
): MarkState => {
  if (agent !== null && agent !== undefined) {
    if (agent.isRunning === true || agent.isComposingMessage === true) {
      if (agent.isStreaming === true) return "streaming";
      const verb = agent.currentActivity?.verb;
      return verb === undefined ? "working" : ACTIVITY_TO_STATE[verb];
    }
    if (agent.awaitingUserResponse === true) return "blocked";
    const settled = settlementState(agent.lastTurnSettlement, nowMs);
    if (settled !== null) return settled;
  }

  if (surfaceFacts !== null && surfaceFacts !== undefined) {
    if (surfaceFacts.isRunning === true || surfaceFacts.isComposingMessage === true) {
      if (surfaceFacts.isStreaming === true) return "streaming";
      const verb = surfaceFacts.currentActivity?.verb;
      return verb === undefined ? "working" : ACTIVITY_TO_STATE[verb];
    }
    if (surfaceFacts.awaitingUserResponse === true) return "blocked";
    const settled = settlementState(surfaceFacts.lastTurnSettlement, nowMs);
    if (settled !== null) return settled;
  }

  return "idle";
};

export const listMarkStates = (): MarkState[] => {
  const seen = new Set<MarkState>();
  // Keep this explicit so the order mirrors the observed UI groups.
  const values: MarkState[] = [
    "idle",
    "listening",
    "thinking",
    "streaming",
    "searching",
    "reading",
    "working",
    "coding",
    "running",
    "computing",
    "controlling",
    "waiting",
    "blocked",
    "finished",
    "failed",
    "sleeping",
    "waking",
    "happy",
    "excited",
    "laughing",
    "proud",
    "curious",
    "playful",
    "shy",
    "surprised",
    "suspicious",
    "angry",
    "confused",
    "sad",
    "drowsy",
    "bored",
    "scared",
    "celebrate",
    "approving",
    "orbit",
    "radar",
    "progress",
    "spawning",
    "loading",
    "dictating",
    "sending",
    "receiving",
    "uploading",
    "writing",
    "alerting",
    "bouncing",
    "powering-down",
    "humming",
    "notifying",
    "dragging",
    "logo",
    "showcase",
    "turntable",
  ];
  for (const state of values) seen.add(state);
  return [...seen];
};

