import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATE_DEFINITIONS } from "./animationClips.js";
import {
  AVATAR_ACTIONS,
  DEFAULT_ACTION_ID,
  DEFAULT_ACTION_STEP_MS,
  actionDurationMs,
  createAvatarActionRunner,
  listAvatarActions,
  resolveAvatarAction,
} from "./actions.js";
import type { MarkState } from "./types.js";

describe("avatar actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only reference states the renderer knows", () => {
    for (const action of listAvatarActions()) {
      expect(action.steps.length, action.id).toBeGreaterThan(0);
      expect(action.labelZh.length, action.id).toBeGreaterThan(0);
      for (const step of action.steps) {
        expect(STATE_DEFINITIONS[step.state], `${action.id}: ${step.state}`).toBeDefined();
        expect(step.durationMs ?? DEFAULT_ACTION_STEP_MS).toBeGreaterThan(0);
      }
    }
  });

  it("resolves unknown ids to the default action", () => {
    expect(resolveAvatarAction("not-an-action").id).toBe(DEFAULT_ACTION_ID);
    expect(resolveAvatarAction("greet").id).toBe("greet");
  });

  it("computes the total playback duration", () => {
    expect(actionDurationMs(resolveAvatarAction("greet"))).toBe(1_600);
    expect(actionDurationMs(resolveAvatarAction("celebrate"))).toBe(3_100);
  });

  it("plays steps in order and restores the resting state", () => {
    const states: MarkState[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: (state) => states.push(state),
    });

    expect(runner.isPlaying()).toBe(false);
    const action = runner.play("greet");
    expect(action.id).toBe("greet");
    expect(runner.isPlaying()).toBe(true);
    expect(states).toEqual(["happy"]);

    vi.advanceTimersByTime(900);
    expect(states).toEqual(["happy", "approving"]);

    vi.advanceTimersByTime(700);
    expect(states).toEqual(["happy", "approving", "idle"]);
    expect(runner.isPlaying()).toBe(false);
    expect(runner.active()).toBeNull();
  });

  it("runs imperative effects for the steps that ask for them", () => {
    const effects: string[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: () => {},
      onEffect: (effect) => effects.push(effect),
    });

    runner.play("spin");
    expect(effects).toEqual(["spin"]);
  });

  it("notifies start and finish callbacks", () => {
    const events: string[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: () => {},
      onStart: (action) => events.push(`start:${action.id}`),
      onFinish: (action) => events.push(`finish:${action.id}`),
    });

    runner.play("nod");
    vi.advanceTimersByTime(AVATAR_ACTIONS.nod.steps[0].durationMs ?? 0);
    expect(events).toEqual(["start:nod", "finish:nod"]);
  });

  it("chains actions back to the state before the first action", () => {
    const states: MarkState[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "working",
      setState: (state) => states.push(state),
    });

    runner.play("nod");
    vi.advanceTimersByTime(200);
    runner.play("spin");
    vi.advanceTimersByTime(1_100);

    // The interrupted "nod" action must not resume after "spin" finishes.
    expect(states).toEqual(["approving", "playful", "working"]);
    expect(runner.isPlaying()).toBe(false);
  });

  it("stops on request, restoring the base state by default", () => {
    const states: MarkState[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: (state) => states.push(state),
    });

    runner.play("think");
    vi.advanceTimersByTime(500);
    runner.stop();
    expect(states).toEqual(["thinking", "idle"]);

    vi.advanceTimersByTime(5_000);
    expect(states).toEqual(["thinking", "idle"]);
    expect(runner.isPlaying()).toBe(false);
  });

  it("keeps the current state when stopped without restoring", () => {
    const states: MarkState[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: (state) => states.push(state),
    });

    runner.play("think");
    runner.stop(false);
    vi.advanceTimersByTime(5_000);

    expect(states).toEqual(["thinking"]);
    expect(runner.isPlaying()).toBe(false);
  });

  it("disposes without touching the state", () => {
    const states: MarkState[] = [];
    const runner = createAvatarActionRunner({
      getBaseState: () => "idle",
      setState: (state) => states.push(state),
    });

    runner.play("think");
    runner.dispose();
    vi.advanceTimersByTime(5_000);

    expect(states).toEqual(["thinking"]);
    expect(runner.active()).toBeNull();
  });
});
