import { clipProfile, STATE_DEFINITIONS } from "./animationClips";
import type {
  BotColor,
  BotShape,
  Face,
  MarkState,
  MarkVisualState,
  Morph,
} from "./types";

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const easeInOutSine = (value: number): number =>
  0.5 - Math.cos(clamp(value, 0, 1) * Math.PI) / 2;

export interface MarkMotionInput {
  readonly color: BotColor;
  readonly shape: BotShape;
  readonly state: MarkState;
  readonly paused?: boolean;
  readonly compact?: boolean;
  readonly settleIdle?: boolean;
  readonly motionTime?: number;
}

interface Pulse {
  readonly kind: "spin" | "bounce";
  elapsed: number;
  readonly duration: number;
  readonly turns: number;
}

/**
 * Small deterministic motion controller extracted from the shipped behavior.
 * It is not the original bundle code; it preserves the observed state and clip
 * mapping while keeping the runtime readable and testable.
 */
export class MarkMotionEngine {
  #color: BotColor;
  #shape: BotShape;
  #state: MarkState;
  #face: Face;
  #morph: Morph | null;
  #clipName: string;
  #clipIndex = 0;
  #clipTime = 0;
  #motionTime = 0;
  #loopCount = 0;
  #stateAge = 0;
  #idleAge = 0;
  #paused: boolean;
  #compact: boolean;
  #settleIdle: boolean;
  #gazeX = 0;
  #gazeY = 0;
  #gazeHold = false;
  #pulses: Pulse[] = [];
  #seed: number;

  constructor(
    input: MarkMotionInput,
    seed = `${input.shape}:${input.color}`,
  ) {
    this.#color = input.color;
    this.#shape = input.shape;
    this.#state = input.state;
    this.#paused = input.paused === true;
    this.#compact = input.compact === true;
    this.#settleIdle = input.settleIdle !== false;
    this.#seed = hash(seed);
    const initial = this.#definition();
    this.#face = initial.face ?? "neutral";
    this.#morph = initial.morph ?? null;
    this.#clipName = this.#clipNames()[0] ?? "Idle_B";
  }

  #definition() {
    return STATE_DEFINITIONS[this.#state];
  }

  #clipNames(): readonly string[] {
    const definition = this.#definition();
    return this.#compact && definition.compactClips !== undefined
      ? definition.compactClips
      : definition.clips;
  }

  setInputs(input: MarkMotionInput): void {
    this.#paused = input.paused === true;
    this.#compact = input.compact === true;
    this.#settleIdle = input.settleIdle !== false;
    this.#color = input.color;

    const shapeChanged = input.shape !== this.#shape;
    if (shapeChanged) this.#shape = input.shape;

    if (input.state !== this.#state) {
      this.#state = input.state;
      const definition = this.#definition();
      this.#face = definition.face ?? "neutral";
      this.#morph = definition.morph ?? null;
      this.#clipIndex = 0;
      this.#clipTime = 0;
      this.#loopCount = 0;
      this.#stateAge = 0;
      this.#idleAge = 0;
      this.#clipName = this.#clipNames()[0] ?? "Idle_B";
      if (this.#state === "happy") {
        this.poke("spin", 2);
        this.poke("bounce");
      }
    } else if (shapeChanged) {
      this.#idleAge = 0;
    }
  }

  setGaze(x: number, y: number, held = true): void {
    this.#gazeX = clamp(x, -1, 1);
    this.#gazeY = clamp(y, -1, 1);
    this.#gazeHold = held;
  }

  releaseGaze(): void {
    this.#gazeHold = false;
  }

  poke(kind: "spin" | "bounce", turns = 1): void {
    this.#pulses = [
      ...this.#pulses,
      {
        kind,
        elapsed: 0,
        duration: kind === "spin" ? 0.8 : 0.45,
        turns,
      },
    ];
  }

  advance(deltaSeconds: number): void {
    if (this.#paused) return;
    const dt = clamp(deltaSeconds, 0, 0.1);
    this.#motionTime += dt;
    this.#stateAge += dt;
    if (this.#state === "idle") this.#idleAge += dt;

    for (const pulse of this.#pulses) pulse.elapsed += dt;
    this.#pulses = this.#pulses.filter((pulse) => pulse.elapsed < pulse.duration);

    if (!this.#gazeHold) {
      const driftSpeed = this.#state === "idle" ? 0.34 : 0.62;
      this.#gazeX = Math.sin(this.#motionTime * driftSpeed + this.#seed * 0.001) * 0.32;
      this.#gazeY = Math.cos(this.#motionTime * driftSpeed * 0.73 + 0.7) * 0.16;
    }

    const definition = this.#definition();
    if (definition.holdSeconds !== undefined && this.#stateAge >= definition.holdSeconds) {
      if (definition.next !== undefined) {
        this.#setNextState(definition.next);
        return;
      }
    }

    this.#clipTime += dt;
    let profile = clipProfile(this.#clipName);
    let guard = 0;
    while (this.#clipTime >= profile.duration && guard < 6) {
      this.#clipTime -= profile.duration;
      this.#loopCount += 1;
      this.#clipIndex += 1;
      const clips = this.#clipNames();
      if (this.#clipIndex >= clips.length) {
        if (definition.next !== undefined && definition.holdSeconds === undefined) {
          this.#setNextState(definition.next);
          return;
        }
        this.#clipIndex = 0;
      }
      this.#clipName = clips[this.#clipIndex] ?? clips[0] ?? "Idle_B";
      profile = clipProfile(this.#clipName);
      guard += 1;
    }
  }

  #setNextState(state: MarkState): void {
    const definition = STATE_DEFINITIONS[state];
    this.#state = state;
    this.#face = definition.face ?? "neutral";
    this.#morph = definition.morph ?? null;
    this.#clipIndex = 0;
    this.#clipTime = 0;
    this.#loopCount = 0;
    this.#stateAge = 0;
    this.#idleAge = 0;
    this.#clipName = this.#clipNames()[0] ?? "Idle_B";
  }

  frame(): MarkVisualState {
    const profile = clipProfile(this.#clipName);
    const phase = profile.duration <= 0 ? 0 : this.#clipTime / profile.duration;
    const smooth = easeInOutSine(phase);
    const wave = Math.sin(phase * TAU);
    const waveDouble = Math.sin(phase * TAU * 2);
    const spinPulse = this.#pulses
      .filter((pulse) => pulse.kind === "spin")
      .reduce(
        (value, pulse) =>
          value + easeInOutSine(pulse.elapsed / pulse.duration) * TAU * pulse.turns,
        0,
      );
    const bouncePulse = this.#pulses
      .filter((pulse) => pulse.kind === "bounce")
      .reduce(
        (value, pulse) =>
          value - Math.sin((pulse.elapsed / pulse.duration) * Math.PI) * 5.5,
        0,
      );

    const idleSettled =
      this.#settleIdle && this.#state === "idle" && this.#idleAge >= 1.4;
    const blink = this.#blinkAmount(profile.duration);
    const rotationY =
      wave * profile.tilt +
      phase * TAU * profile.spin +
      (this.#state === "turntable" ? phase * TAU : 0) +
      spinPulse;
    const rotationX = Math.cos(phase * TAU + 0.7) * profile.tilt * 0.28;
    const rotationZ = waveDouble * profile.wobble * 0.35;
    const squash = waveDouble * profile.squash;

    return {
      color: this.#color,
      shape: this.#shape,
      state: this.#state,
      face: this.#face,
      morph: this.#morph,
      clip: this.#clipName,
      motionTime: this.#motionTime,
      spin: phase * TAU + spinPulse,
      blink,
      gazeX: this.#gazeX,
      gazeY: this.#gazeY,
      offsetX: wave * profile.bob * 0.35 + smooth * 0.1,
      offsetY: wave * profile.bob + bouncePulse,
      scaleX: 1 + squash,
      scaleY: 1 - squash * 0.82,
      rotationX,
      rotationY,
      rotationZ,
      isPaused: this.#paused || idleSettled,
    };
  }

  #blinkAmount(duration: number): number {
    const cycle = 3.7 + (this.#seed % 90) / 100;
    const local = this.#motionTime % cycle;
    const blinkStart = duration * 0.42;
    if (local < blinkStart || local > blinkStart + 0.18) return 0;
    return Math.sin(((local - blinkStart) / 0.18) * Math.PI);
  }
}

const hash = (value: string): number => {
  let hashValue = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = Math.imul(hashValue ^ value.charCodeAt(index), 16777619);
  }
  return hashValue >>> 0;
};

