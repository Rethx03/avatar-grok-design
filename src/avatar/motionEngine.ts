import { clipProfile, STATE_DEFINITIONS } from "./animationClips";
import { ClipBag } from "./reconstruction/clipBag";
import {
  DEFAULT_ZOOM,
  createBridgeSection,
  createClipSection,
  sampleExpression,
  samplePose,
  type GeneratedClipSection,
  type RecipePose,
  type RecipeSection,
} from "./reconstruction/keyframes";
import {
  clamp,
  createSpring,
  hashString,
  smoothstep,
  springStep,
  springSubsteps,
  type SpringState,
  windowPulse,
} from "./reconstruction/math";
import type {
  BotColor,
  BotShape,
  Face,
  MarkState,
  MarkVisualState,
  Morph,
} from "./types";

const MAX_DELTA_SECONDS = 0.1;
const BRIDGE_DURATION_SECONDS = 0.28;
const BLINK_DURATION_SECONDS = 0.26;
const FACE_DURATION_SECONDS = 0.28;
const IDLE_SETTLE_SECONDS = 1.4;
const SHAPE_BLEND_SECONDS = 0.22;
const GAZE_FRAME_SECONDS = 1 / 60;
const POSITION_TO_VIEWBOX = 82;
const POSE_ROTATION_TO_RADIANS = Math.PI / 180;

export interface MarkMotionInput {
  readonly color: BotColor;
  readonly shape: BotShape;
  readonly state: MarkState;
  readonly paused?: boolean;
  readonly compact?: boolean;
  readonly settleIdle?: boolean;
  readonly motionTime?: number;
}

interface ClipInstance {
  readonly name: string;
  readonly section: GeneratedClipSection;
  readonly phase: number;
  time: number;
}

interface BridgeInstance {
  elapsed: number;
  readonly section: RecipeSection;
  readonly next: ClipInstance;
}

interface Pulse {
  readonly kind: "spin" | "bounce";
  elapsed: number;
  readonly duration: number;
  readonly turns: number;
}

const clipSections = new Map<string, GeneratedClipSection>();

const sectionFor = (name: string): GeneratedClipSection => {
  const existing = clipSections.get(name);
  if (existing !== undefined) return existing;
  const created = createClipSection(clipProfile(name));
  clipSections.set(name, created);
  return created;
};

const createClipInstance = (
  name: string,
  phase: number,
): ClipInstance => {
  const section = sectionFor(name);
  const normalizedPhase = ((phase % 1) + 1) % 1;
  return {
    name,
    section,
    phase: normalizedPhase,
    time: normalizedPhase * section.duration,
  };
};

const interpolate = (
  from: number,
  to: number,
  amount: number,
): number => from + (to - from) * amount;

const pulseDuration = (pulse: Pulse): number => pulse.duration;

/**
 * Readable behavioral reconstruction of the shipped mark animation pipeline.
 *
 * The implementation keeps the observed system boundaries: clip sampling,
 * bridge transitions, state scheduling, gaze smoothing, facial timing, spring
 * morphs, pokes, and idle settling. The clip curves themselves are authored
 * approximations used by the simplified behavioral renderer.
 */
export class MarkMotionEngine {
  #color: BotColor;
  #shape: BotShape;
  #previousShape: BotShape | null = null;
  #shapeBlend = 1;
  #state: MarkState;
  #face: Face;
  #previousFace: Face;
  #faceBlend = 1;
  #faceElapsed = FACE_DURATION_SECONDS;
  #heldFace: Face | null;
  #pendingFace: Face | null = null;
  #blinkElapsed: number | null = null;
  #morphKind: Morph | null;
  #morphTarget: Morph | null;
  #morphAmount: SpringState;
  #morphClock = 0;
  #morphRenderClock = 0;
  #morphPaused = false;
  #morphPauseStarted = 0;
  #morphPauseElapsed = 0;
  #paused: boolean;
  #compact: boolean;
  #settleIdle: boolean;
  #motionTime = 0;
  #stateElapsed = 0;
  #idleElapsed = 0;
  #idleSettled = false;
  #currentClip: ClipInstance;
  #bridge: BridgeInstance | null = null;
  #sequenceIndex = 0;
  #lastClipName: string | null = null;
  #clipBag: ClipBag;
  #pulses: Pulse[] = [];
  #gazeTargetX = 0;
  #gazeTargetY = 0;
  #gazeX = 0;
  #gazeY = 0;
  #gazeHoldTarget = 0;
  #gazeHold = 0;
  #random: () => number;

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

    const definition = STATE_DEFINITIONS[this.#state];
    this.#face = definition.face ?? "neutral";
    this.#previousFace = this.#face;
    this.#heldFace = definition.face ?? null;
    this.#morphKind = definition.morph ?? null;
    this.#morphTarget = definition.morph ?? null;
    this.#morphAmount = createSpring(this.#morphKind === null ? 0 : 1);

    const seedHash = hashString(seed);
    this.#clipBag = new ClipBag(seedHash);
    this.#random = (() => {
      let value = seedHash;
      return () => {
        value = Math.imul(value ^ (value >>> 16), 2246822507);
        value = Math.imul(value ^ (value >>> 13), 3266489909);
        value ^= value >>> 16;
        return (value >>> 0) / 4294967296;
      };
    })();
    this.#currentClip = createClipInstance(
      this.#clipsForState()[0] ?? "Idle_B",
      0,
    );
    this.#lastClipName = this.#currentClip.name;
    this.#applyExpressionsThrough(this.#currentClip, -1, 0);
  }

  #definition() {
    return STATE_DEFINITIONS[this.#state];
  }

  #clipsForState(): readonly string[] {
    const definition = this.#definition();
    return this.#compact && definition.compactClips !== undefined
      ? definition.compactClips
      : definition.clips;
  }

  #isOneShotState(): boolean {
    const definition = this.#definition();
    return definition.next !== undefined && definition.holdSeconds === undefined;
  }

  #nextClipName(): string {
    const clips = this.#clipsForState();
    if (this.#isOneShotState()) {
      return clips[Math.min(this.#sequenceIndex, clips.length - 1)] ?? "Idle_B";
    }
    return this.#clipBag.next() ?? clips[0] ?? "Idle_B";
  }

  #wake(): void {
    this.#idleSettled = false;
    this.#idleElapsed = 0;
  }

  #setFace(face: Face, immediate = false): void {
    if (face === this.#face) return;
    if (this.#blinkElapsed !== null && !immediate) {
      this.#pendingFace = face;
      return;
    }
    this.#previousFace = this.#face;
    this.#face = face;
    this.#faceElapsed = immediate ? FACE_DURATION_SECONDS : 0;
    this.#faceBlend = immediate ? 1 : 0;
  }

  #setHeldFace(face: Face | null): void {
    this.#heldFace = face;
    if (face !== null) this.#setFace(face);
  }

  #setMorphKind(kind: Morph | null, immediate = false): void {
    if (kind === this.#morphTarget) {
      if (immediate) {
        this.#morphKind = kind;
        this.#morphAmount.value = kind === null ? 0 : 1;
        this.#morphAmount.velocity = 0;
        this.#morphAmount.target = kind === null ? 0 : 1;
      }
      return;
    }

    this.#morphTarget = kind;
    if (kind !== null) {
      this.#morphKind = kind;
      this.#morphClock = 0;
      this.#morphRenderClock = 0;
      this.#morphPaused = false;
      this.#morphPauseStarted = 0;
      this.#morphPauseElapsed = 0;
    }
    this.#morphAmount.target = kind === null ? 0 : 1;
    if (immediate) {
      this.#morphAmount.value = this.#morphAmount.target;
      this.#morphAmount.velocity = 0;
      if (kind === null) this.#morphKind = null;
    }
  }

  #enterState(state: MarkState, initial = false): void {
    this.#state = state;
    this.#stateElapsed = 0;
    this.#idleElapsed = 0;
    this.#idleSettled = false;
    this.#sequenceIndex = 0;
    this.#clipBag.reset(this.#clipsForState());

    const definition = this.#definition();
    this.#setHeldFace(definition.face ?? null);
    this.#setMorphKind(definition.morph ?? null, initial);

    const clipName = this.#nextClipName();
    const phase = initial ? 0 : this.#random();
    this.#loadClip(clipName, phase, !initial);
  }

  #loadClip(
    name: string,
    phase: number,
    useBridge: boolean,
  ): void {
    const next = createClipInstance(name, phase);

    if (
      useBridge &&
      this.#currentClip !== undefined &&
      (this.#bridge !== null || next.name !== this.#currentClip.name)
    ) {
      const from = this.#currentPose();
      const to = samplePose(next.section, next.time);
      this.#bridge = {
        elapsed: 0,
        section: createBridgeSection(
          `Bridge:${this.#currentClip.name}->${next.name}`,
          from,
          to,
          BRIDGE_DURATION_SECONDS,
        ),
        next,
      };
    } else {
      this.#currentClip = next;
      this.#bridge = null;
      this.#applyExpressionsThrough(next, -1, next.time);
    }

    this.#lastClipName = name;
  }

  #applyExpressionsThrough(
    clip: ClipInstance,
    fromTime: number,
    toTime: number,
  ): void {
    for (const event of sampleExpression(
      clip.section.expressions,
      fromTime,
      toTime,
    )) {
      if (event.value === "blink") {
        this.#blinkElapsed = 0;
        continue;
      }
      if (this.#heldFace === null) this.#setFace(event.value);
    }
  }

  #currentPose(): RecipePose {
    if (this.#bridge !== null) {
      return samplePose(this.#bridge.section, this.#bridge.elapsed);
    }
    return samplePose(this.#currentClip.section, this.#currentClip.time);
  }

  #advanceState(deltaSeconds: number): void {
    this.#stateElapsed += deltaSeconds;
    if (this.#state === "idle") this.#idleElapsed += deltaSeconds;

    const definition = this.#definition();
    if (
      definition.next !== undefined &&
      definition.holdSeconds !== undefined &&
      this.#stateElapsed >= definition.holdSeconds
    ) {
      this.#enterState(definition.next);
      return;
    }

    if (this.#bridge !== null) {
      const bridge = this.#bridge;
      bridge.elapsed += deltaSeconds;
      if (bridge.elapsed < bridge.section.duration) return;

      const overflow = bridge.elapsed - bridge.section.duration;
      this.#bridge = null;
      this.#currentClip = bridge.next;
      this.#lastClipName = bridge.next.name;
      this.#applyExpressionsThrough(
        bridge.next,
        -1,
        bridge.next.time,
      );
      if (overflow > 0) {
        this.#advanceClip(overflow);
      }
      return;
    }

    this.#advanceClip(deltaSeconds);
  }

  #advanceClip(deltaSeconds: number): void {
    const clip = this.#currentClip;
    const previousTime = clip.time;
    const timeScale = 1 - clamp(this.#morphAmount.value, 0, 1) * 0.82;
    const nextTime = clip.time + deltaSeconds * timeScale;

    if (nextTime < clip.section.duration) {
      clip.time = nextTime;
      this.#applyExpressionsThrough(clip, previousTime, nextTime);
      return;
    }

    clip.time = clip.section.duration;
    this.#applyExpressionsThrough(clip, previousTime, clip.time);
    this.#completeClipLoop();
  }

  #completeClipLoop(): void {
    const definition = this.#definition();
    const clips = this.#clipsForState();

    if (this.#isOneShotState() && definition.next !== undefined) {
      this.#sequenceIndex += 1;
      if (this.#sequenceIndex >= clips.length) {
        this.#enterState(definition.next);
        return;
      }
    } else {
      this.#sequenceIndex = 0;
    }

    const nextName = this.#nextClipName();
    this.#loadClip(nextName, 0, nextName !== this.#lastClipName);
  }

  #advanceFace(deltaSeconds: number): void {
    if (this.#faceBlend < 1) {
      this.#faceElapsed += deltaSeconds;
      this.#faceBlend = smoothstep(
        this.#faceElapsed / FACE_DURATION_SECONDS,
      );
    }

    if (this.#blinkElapsed !== null) {
      this.#blinkElapsed += deltaSeconds;
      if (this.#blinkElapsed >= BLINK_DURATION_SECONDS) {
        this.#blinkElapsed = null;
        const pending = this.#pendingFace;
        this.#pendingFace = null;
        if (pending !== null) this.#setFace(pending);
      }
    }
  }

  #advanceGaze(deltaSeconds: number): void {
    const alpha =
      1 - 0.86 ** (deltaSeconds / GAZE_FRAME_SECONDS);
    this.#gazeX = interpolate(this.#gazeX, this.#gazeTargetX, alpha);
    this.#gazeY = interpolate(this.#gazeY, this.#gazeTargetY, alpha);
    this.#gazeHold = interpolate(
      this.#gazeHold,
      this.#gazeHoldTarget,
      alpha,
    );

    if (Math.abs(this.#gazeX - this.#gazeTargetX) < 0.001) {
      this.#gazeX = this.#gazeTargetX;
    }
    if (Math.abs(this.#gazeY - this.#gazeTargetY) < 0.001) {
      this.#gazeY = this.#gazeTargetY;
    }
    if (Math.abs(this.#gazeHold - this.#gazeHoldTarget) < 0.001) {
      this.#gazeHold = this.#gazeHoldTarget;
    }
  }

  #morphHoldSeconds(): number | null {
    if (this.#morphKind === "progress") return 2.5;
    if (this.#morphKind === "spawning") return 2;
    return null;
  }

  #advanceMorph(deltaSeconds: number): void {
    if (this.#morphTarget !== null) {
      this.#morphClock += deltaSeconds;
      const holdAt = this.#morphHoldSeconds();
      if (holdAt !== null) {
        if (!this.#morphPaused && this.#morphClock >= holdAt) {
          this.#morphPaused = true;
          this.#morphPauseStarted = this.#morphClock;
          this.#morphPauseElapsed = 0;
        } else if (this.#morphPaused) {
          this.#morphPauseElapsed += deltaSeconds;
          if (this.#morphPauseElapsed >= 1.5) {
            this.#morphPaused = false;
            this.#morphClock =
              this.#morphPauseStarted +
              1.5 +
              (this.#morphClock - this.#morphPauseStarted - 1.5);
          }
        }
      }
      if (!this.#morphPaused) {
        this.#morphRenderClock += deltaSeconds;
      }
    }

    const substeps = springSubsteps(deltaSeconds);
    const step = deltaSeconds / substeps;
    for (let index = 0; index < substeps; index += 1) {
      springStep(this.#morphAmount, 14, 1, step);
    }
    this.#morphAmount.value = clamp(this.#morphAmount.value, 0, 1.08);

    if (
      this.#morphTarget === null &&
      Math.abs(this.#morphAmount.value - this.#morphAmount.target) < 0.004
    ) {
      this.#morphAmount.value = 0;
      this.#morphAmount.velocity = 0;
      this.#morphKind = null;
      this.#morphClock = 0;
      this.#morphRenderClock = 0;
      this.#morphPaused = false;
    }
  }

  #advanceShape(deltaSeconds: number): void {
    if (this.#previousShape === null || this.#shapeBlend >= 1) return;
    this.#shapeBlend = Math.min(
      1,
      this.#shapeBlend + deltaSeconds / SHAPE_BLEND_SECONDS,
    );
    if (this.#shapeBlend >= 1) this.#previousShape = null;
  }

  #advancePulses(deltaSeconds: number): void {
    for (const pulse of this.#pulses) pulse.elapsed += deltaSeconds;
    this.#pulses = this.#pulses.filter(
      (pulse) => pulse.elapsed < pulseDuration(pulse),
    );
  }

  #blinkAmount(): number {
    if (this.#blinkElapsed === null) return 0;
    const progress = clamp(
      this.#blinkElapsed / BLINK_DURATION_SECONDS,
      0,
      1,
    );
    const closeWindow = Math.min(
      0.28,
      2 / 60 / Math.max(BLINK_DURATION_SECONDS, 0.05),
    );
    const closeStart = (1 - closeWindow) * 0.42;
    const closeEnd = closeStart + closeWindow;
    if (progress < closeStart) {
      return smoothstep(progress / Math.max(closeStart, 1e-6));
    }
    if (progress <= closeEnd) return 1;
    return (
      1 -
      smoothstep(
        (progress - closeEnd) / Math.max(1 - closeEnd, 1e-6),
      )
    );
  }

  #pokePose(): {
    pitch: number;
    yaw: number;
    lift: number;
    squashX: number;
    squashY: number;
  } {
    let pitch = 0;
    let yaw = 0;
    let lift = 0;
    let squashX = 1;
    let squashY = 1;

    for (const pulse of this.#pulses) {
      const progress = clamp(pulse.elapsed / pulse.duration, 0, 1);
      if (pulse.kind === "spin") {
        yaw +=
          180 * pulse.turns * (1 - Math.cos(Math.PI * progress));
        continue;
      }

      const edge =
        windowPulse(progress, 0, 0.18) +
        windowPulse(progress, 0.82, 1);
      const middle = windowPulse(progress, 0.18, 0.82);
      lift +=
        0.3 *
        Math.sin(
          Math.PI * clamp((progress - 0.14) / 0.72, 0, 1),
        );
      squashX *= 1 + 0.08 * edge - 0.04 * middle;
      squashY *= 1 - 0.1 * edge + 0.06 * middle;
    }

    return { pitch, yaw, lift, squashX, squashY };
  }

  #gazePose(): {
    rx: number;
    ry: number;
    px: number;
    py: number;
  } {
    const nonSphere = this.#shape !== "blob";
    const scale =
      this.#shape === "heart"
        ? 0.6
        : this.#shape === "wedge"
          ? 0.55
          : 1;
    return {
      rx: -(nonSphere ? 19 : 14) * scale * this.#gazeY,
      ry: (nonSphere ? 26 : 18) * scale * this.#gazeX,
      px: (nonSphere ? 0.07 : 0.03) * this.#gazeX,
      py: (nonSphere ? 0.055 : 0.024) * this.#gazeY,
    };
  }

  setInputs(input: MarkMotionInput): void {
    this.#paused = input.paused === true;
    this.#compact = input.compact === true;
    this.#settleIdle = input.settleIdle !== false;
    this.#color = input.color;

    if (input.shape !== this.#shape) {
      this.#previousShape = this.#shape;
      this.#shape = input.shape;
      this.#shapeBlend = 0;
      this.#wake();
    }

    if (input.state !== this.#state) {
      this.#enterState(input.state);
    }

    if (!this.#paused && !this.#idleSettled) {
      this.#wake();
    }
  }

  setGaze(x: number, y: number, held = true): void {
    this.#gazeTargetX = clamp(x, -1, 1);
    this.#gazeTargetY = clamp(y, -1, 1);
    this.#gazeHoldTarget = held ? 1 : 0;
    this.#wake();
  }

  releaseGaze(): void {
    this.#gazeHoldTarget = 0;
    this.#wake();
  }

  poke(kind: "spin" | "bounce", turns = 1): void {
    const normalizedTurns = Math.max(1, Math.round(turns));
    this.#pulses = [
      ...this.#pulses,
      {
        kind,
        elapsed: 0,
        duration:
          kind === "spin" ? 0.9 + 0.4 * (normalizedTurns - 1) : 0.62,
        turns: normalizedTurns,
      },
    ];
    this.#wake();
  }

  restart(): void {
    this.#currentClip = createClipInstance(
      this.#clipsForState()[0] ?? "Idle_B",
      0,
    );
    this.#bridge = null;
    this.#sequenceIndex = 0;
    this.#clipBag.reset(this.#clipsForState());
    this.#wake();
  }

  advance(deltaSeconds: number): void {
    if (this.#paused || this.#idleSettled) return;
    const delta = clamp(deltaSeconds, 0, MAX_DELTA_SECONDS);
    if (delta <= 0) return;

    this.#motionTime += delta;
    this.#advanceGaze(delta);
    this.#advanceFace(delta);
    this.#advanceMorph(delta);
    this.#advanceState(delta);
    this.#advanceShape(delta);
    this.#advancePulses(delta);

    if (
      this.#settleIdle &&
      this.#state === "idle" &&
      this.#idleElapsed >= IDLE_SETTLE_SECONDS &&
      this.#pulses.length === 0
    ) {
      this.#idleSettled = true;
    }
  }

  frame(): MarkVisualState {
    const pose = this.#currentPose();
    const poke = this.#pokePose();
    const gaze = this.#gazePose();
    const hold = 0.55 * this.#gazeHold;
    const spinProgress =
      this.#bridge === null
        ? this.#currentClip.time /
          Math.max(this.#currentClip.section.duration, 1e-6)
        : 0;
    const spin =
      this.#currentClip.section.spinRadians * spinProgress;
    const rotationX =
      (pose.rotation[0] + poke.pitch) *
      POSE_ROTATION_TO_RADIANS;
    const rotationY =
      (pose.rotation[1] +
        gaze.ry * hold +
        poke.yaw) *
        POSE_ROTATION_TO_RADIANS +
      spin;
    const rotationZ =
      pose.rotation[2] * POSE_ROTATION_TO_RADIANS;
    const face =
      this.#faceBlend >= 0.5 ? this.#face : this.#previousFace;

    return {
      color: this.#color,
      shape: this.#shape,
      previousShape: this.#previousShape,
      shapeBlend: smoothstep(this.#shapeBlend),
      state: this.#state,
      face,
      previousFace: this.#previousFace,
      faceBlend: this.#faceBlend,
      morph: this.#morphKind,
      morphAmount: clamp(this.#morphAmount.value, 0, 1),
      morphClock: this.#morphRenderClock,
      morphActive: this.#morphTarget !== null && !this.#morphPaused,
      clip: this.#bridge?.next.name ?? this.#currentClip.name,
      motionTime: this.#motionTime,
      spin,
      blink: this.#blinkAmount(),
      gazeX: this.#gazeX,
      gazeY: this.#gazeY,
      offsetX:
        (pose.position[0] +
          gaze.px * hold) *
        POSITION_TO_VIEWBOX,
      offsetY:
        -(
          pose.position[1] +
          gaze.py * hold +
          poke.lift
        ) * POSITION_TO_VIEWBOX,
      scaleX:
        pose.scale[0] * poke.squashX,
      scaleY:
        pose.scale[1] * poke.squashY,
      rotationX:
        rotationX + gaze.rx * hold * POSE_ROTATION_TO_RADIANS,
      rotationY,
      rotationZ,
      zoom: pose.zoom / DEFAULT_ZOOM,
      isPaused: this.#paused || this.#idleSettled,
    };
  }
}
