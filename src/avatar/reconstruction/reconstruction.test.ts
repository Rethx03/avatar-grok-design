import { describe, expect, it } from "vitest";
import { MarkMotionEngine } from "../motionEngine";
import { ClipBag } from "./clipBag";
import {
  createClipSection,
  samplePose,
  sampleVectorTrack,
} from "./keyframes";
import {
  cubicBezierEase,
  createSpring,
  springStep,
  windowPulse,
} from "./math";
import { MOTION_CLIPS } from "../animationClips";

describe("reconstruction math", () => {
  it("solves cubic-bezier timing curves", () => {
    expect(cubicBezierEase(0, [0.42, 0, 0.58, 1])).toBeCloseTo(0, 5);
    expect(cubicBezierEase(1, [0.42, 0, 0.58, 1])).toBeCloseTo(1, 5);
    expect(cubicBezierEase(0.5, [0, 0, 1, 1])).toBeCloseTo(0.5, 5);
  });

  it("integrates a stable spring toward its target", () => {
    const spring = createSpring(0);
    spring.target = 1;
    for (let index = 0; index < 240; index += 1) {
      springStep(spring, 14, 1, 1 / 120);
    }
    expect(spring.value).toBeCloseTo(1, 2);
    expect(Math.abs(spring.velocity)).toBeLessThan(0.05);
  });

  it("creates a smooth closed pulse window", () => {
    expect(windowPulse(0.1, 0.1, 0.2)).toBe(0);
    expect(windowPulse(0.15, 0.1, 0.2)).toBeCloseTo(1, 5);
    expect(windowPulse(0.2, 0.1, 0.2)).toBe(0);
  });
});

describe("reconstruction keyframes", () => {
  const track = [
    { time: 0, value: [0, 10] as const, easing: [0, 0, 1, 1] as const },
    { time: 1, value: [10, 20] as const, easing: [0, 0, 1, 1] as const },
  ];

  it("holds boundary values and interpolates vector tracks", () => {
    expect(sampleVectorTrack<readonly number[]>(track, -1)).toEqual([0, 10]);
    expect(sampleVectorTrack<readonly number[]>(track, 0.5)).toEqual([5, 15]);
    expect(sampleVectorTrack<readonly number[]>(track, 2)).toEqual([10, 20]);
  });

  it("expands every observed clip into a sampled pose", () => {
    for (const profile of Object.values(MOTION_CLIPS)) {
      const section = createClipSection(profile);
      const start = samplePose(section, 0);
      const end = samplePose(section, section.duration);
      expect(start.position).toEqual([0, 0]);
      expect(end.position).toEqual([0, 0]);
      expect(end.rotation).toEqual([0, 0, 0]);
      expect(Number.isFinite(section.spinRadians)).toBe(true);
    }
  });
});

describe("reconstruction scheduler", () => {
  it("uses a deterministic shuffle bag without immediate repeats", () => {
    const clips = ["A", "B", "C", "D"];
    const first = new ClipBag(42);
    first.reset(clips);
    const firstPass = clips.map(() => first.next());
    expect(new Set(firstPass)).toEqual(new Set(clips));

    const repeated = first.next();
    expect(repeated).not.toBe(firstPass.at(-1));

    const second = new ClipBag(42);
    second.reset(clips);
    expect(clips.map(() => second.next())).toEqual(firstPass);
  });
});

describe("reconstructed motion engine", () => {
  it("moves a one-shot state through all clips into its next state", () => {
    const engine = new MarkMotionEngine(
      {
        color: "blue",
        shape: "blob",
        state: "finished",
        settleIdle: false,
      },
      "finished-test",
    );

    expect(engine.frame().state).toBe("finished");
    for (let index = 0; index < 120; index += 1) engine.advance(0.1);
    expect(engine.frame().state).toBe("idle");
  });

  it("smooths gaze input and freezes it while paused", () => {
    const engine = new MarkMotionEngine({
      color: "blue",
      shape: "blob",
      state: "working",
      settleIdle: false,
    });
    engine.setGaze(1, -0.5, true);
    for (let index = 0; index < 20; index += 1) engine.advance(1 / 60);
    expect(engine.frame().gazeX).toBeGreaterThan(0.9);

    engine.setInputs({
      color: "blue",
      shape: "blob",
      state: "working",
      paused: true,
      settleIdle: false,
    });
    const frozen = engine.frame();
    engine.advance(1);
    expect(engine.frame()).toEqual(frozen);
  });

  it("bridges shape changes and completes the blend", () => {
    const engine = new MarkMotionEngine({
      color: "violet",
      shape: "blob",
      state: "working",
      settleIdle: false,
    });
    engine.setInputs({
      color: "violet",
      shape: "star",
      state: "working",
      settleIdle: false,
    });
    expect(engine.frame().previousShape).toBe("blob");
    expect(engine.frame().shapeBlend).toBe(0);

    engine.advance(0.1);
    expect(engine.frame().shapeBlend).toBeGreaterThan(0);
    expect(engine.frame().shapeBlend).toBeLessThan(1);
    engine.advance(0.1);
    engine.advance(0.1);
    expect(engine.frame().shapeBlend).toBe(1);
    expect(engine.frame().previousShape).toBeNull();
  });

  it("applies pokes and lets a settled idle mark wake", () => {
    const engine = new MarkMotionEngine({
      color: "blue",
      shape: "blob",
      state: "idle",
      settleIdle: true,
    });
    for (let index = 0; index < 15; index += 1) engine.advance(0.1);
    expect(engine.frame().isPaused).toBe(true);

    engine.poke("bounce");
    engine.advance(0.1);
    const bouncing = engine.frame();
    expect(bouncing.isPaused).toBe(false);
    expect(bouncing.offsetY).toBeLessThan(0);
  });
});
