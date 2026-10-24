import { describe, expect, it } from "vitest";
import {
  ACTIVITY_TO_STATE,
  SETTLEMENT_VISIBLE_MS,
  deriveMarkState,
} from "./stateModel";

describe("deriveMarkState", () => {
  it("defaults to idle", () => {
    expect(deriveMarkState(null, 1_000)).toBe("idle");
    expect(deriveMarkState({}, 1_000)).toBe("idle");
  });

  it("gives streaming precedence over the activity verb", () => {
    expect(
      deriveMarkState(
        {
          isRunning: true,
          isStreaming: true,
          currentActivity: { verb: "coding" },
        },
        1_000,
      ),
    ).toBe("streaming");
  });

  it("maps observed activity verbs", () => {
    expect(ACTIVITY_TO_STATE.searching).toBe("searching");
    expect(ACTIVITY_TO_STATE.connecting).toBe("orbit");
    expect(ACTIVITY_TO_STATE["on-your-computer"]).toBe("controlling");
    expect(
      deriveMarkState(
        {
          isRunning: true,
          currentActivity: { verb: "reading" },
        },
        1_000,
      ),
    ).toBe("reading");
  });

  it("shows a recent successful settlement for eight seconds", () => {
    const settledAtMs = 10_000;
    expect(
      deriveMarkState(
        {
          lastTurnSettlement: { outcome: "success", settledAtMs },
        },
        settledAtMs + SETTLEMENT_VISIBLE_MS - 1,
      ),
    ).toBe("finished");
    expect(
      deriveMarkState(
        {
          lastTurnSettlement: { outcome: "success", settledAtMs },
        },
        settledAtMs + SETTLEMENT_VISIBLE_MS,
      ),
    ).toBe("idle");
  });

  it("uses surface facts only while the primary agent is idle", () => {
    expect(
      deriveMarkState(
        {},
        1_000,
        {
          isRunning: true,
          currentActivity: { verb: "thinking" },
        },
      ),
    ).toBe("thinking");
    expect(
      deriveMarkState(
        {
          isRunning: true,
          currentActivity: { verb: "coding" },
        },
        1_000,
        {
          isRunning: true,
          currentActivity: { verb: "thinking" },
        },
      ),
    ).toBe("coding");
  });
});

