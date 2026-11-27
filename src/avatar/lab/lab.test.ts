import { describe, expect, it } from "vitest";
import type { MarkState } from "../types.js";
import { MOTION_CLIPS, STATE_DEFINITIONS } from "../animationClips.js";
import { MarkMotionEngine } from "../motionEngine.js";
import { LAB_FORMS, buildFormPath } from "./forms.js";

const LAB_STATES = ["sneeze", "shiver", "stretch", "doze", "pace", "wink"] as const;

const play = (state: (typeof LAB_STATES)[number], frames: number) => {
  const engine = new MarkMotionEngine({
    color: "blue",
    shape: "blob",
    state: state as MarkState,
    settleIdle: false,
  });
  const clips = new Set<string>();
  for (let index = 0; index < frames; index += 1) {
    engine.advance(1 / 60);
    clips.add(engine.frame().clip);
  }
  return { engine, clips };
};

describe("lab forms", () => {
  it("produces closed, finite paths for every form", () => {
    for (const form of LAB_FORMS) {
      const path = buildFormPath(form, 36);
      expect(path.startsWith("M")).toBe(true);
      expect(path.endsWith("Z")).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
      expect(path.length).toBeGreaterThan(1000);
    }
  });

  it("keeps every radius inside a sane envelope", () => {
    for (const form of LAB_FORMS) {
      for (let index = 0; index < 64; index += 1) {
        const radius = form.radius((index / 64) * Math.PI * 2);
        expect(radius).toBeGreaterThan(0.5);
        expect(radius).toBeLessThan(1.6);
      }
    }
  });

  it("keeps the cookie bite", () => {
    const cookie = LAB_FORMS.find((form) => form.id === "cookie")!;
    expect(cookie.radius(-0.5)).toBeLessThan(0.7);
    expect(cookie.radius(Math.PI)).toBeGreaterThan(0.9);
  });
});

describe("lab states", () => {
  it("defines clips for every lab state", () => {
    for (const state of LAB_STATES) {
      const definition = STATE_DEFINITIONS[state];
      expect(definition).toBeDefined();
      for (const clip of definition!.clips) {
        expect(MOTION_CLIPS[clip]).toBeDefined();
      }
    }
  });

  it("plays sneeze through its burst clip into idle", () => {
    const { engine, clips } = play("sneeze", 180);
    expect(clips.has("Sneeze_B")).toBe(true);
    expect(engine.frame().state).toBe("idle");
  });

  it("holds shiver for 2.4s before settling", () => {
    const early = play("shiver", 130);
    expect(early.engine.frame().state).toBe("shiver");
    const late = play("shiver", 165);
    expect(late.engine.frame().state).toBe("idle");
  });

  it("wakes up after dozing", () => {
    const { engine } = play("doze", 380);
    expect(engine.frame().state).toBe("waking");
  });

  it("archives backwards during stretch", () => {
    const { engine } = play("stretch", 60);
    expect(engine.frame().rotationX).toBeLessThan(0);
  });

  it("paces and settles", () => {
    expect(play("pace", 200).engine.frame().state).toBe("pace");
    expect(play("pace", 260).engine.frame().state).toBe("idle");
  });

  it("winks and returns to idle", () => {
    const { engine } = play("wink", 60);
    expect(engine.frame().state).toBe("idle");
  });
});
