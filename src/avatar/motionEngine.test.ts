import { describe, expect, it } from "vitest";
import { MOTION_CLIPS, STATE_DEFINITIONS } from "./animationClips";
import { MarkMotionEngine } from "./motionEngine";
import { listMarkStates } from "./stateModel";

describe("motion state definitions", () => {
  it("defines a valid clip for every state", () => {
    for (const state of listMarkStates()) {
      const definition = STATE_DEFINITIONS[state];
      expect(definition.clips.length).toBeGreaterThan(0);
      for (const clip of definition.clips) {
        expect(MOTION_CLIPS[clip]).toBeDefined();
      }
      for (const clip of definition.compactClips ?? []) {
        expect(MOTION_CLIPS[clip]).toBeDefined();
      }
    }
  });

  it("moves through the waking hold into idle", () => {
    const engine = new MarkMotionEngine({
      color: "blue",
      shape: "blob",
      state: "waking",
      settleIdle: false,
    });
    for (let index = 0; index < 18; index += 1) engine.advance(0.1);
    expect(engine.frame().state).toBe("idle");
  });

  it("freezes a settled idle mark", () => {
    const engine = new MarkMotionEngine({
      color: "blue",
      shape: "blob",
      state: "idle",
      settleIdle: true,
    });
    for (let index = 0; index < 16; index += 1) engine.advance(0.1);
    expect(engine.frame().isPaused).toBe(true);
  });
});

