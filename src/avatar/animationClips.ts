import type { Face, MarkState, Morph } from "./types.js";

export type Ease = readonly [number, number, number, number];

export interface MotionClip {
  readonly name: string;
  readonly duration: number;
  readonly bob: number;
  readonly tilt: number;
  readonly spin: number;
  readonly squash: number;
  readonly wobble: number;
  readonly ease: Ease;
  /** Constant lean on the X axis (degrees), blended in by the clip bridge. */
  readonly pitch?: number;
  /** Constant lean on the Z axis (degrees), blended in by the clip bridge. */
  readonly roll?: number;
  /** Repeats the motion pattern this many times per clip (default 1). */
  readonly cycles?: number;
  /** Blinks per clip (default 2). */
  readonly blinks?: number;
}

export interface StateDefinition {
  readonly clips: readonly string[];
  readonly compactClips?: readonly string[];
  readonly face?: Face;
  readonly morph?: Morph;
  readonly next?: MarkState;
  readonly holdSeconds?: number;
}

export const STANDARD_EASE: Ease = [0.42, 0, 0.58, 1];

interface ClipExtras {
  readonly pitch?: number;
  readonly roll?: number;
  readonly cycles?: number;
  readonly blinks?: number;
}

const clip = (
  name: string,
  duration: number,
  bob: number,
  tilt: number,
  spin: number,
  squash: number,
  wobble: number,
  extras: ClipExtras = {},
): MotionClip => ({
  name,
  duration,
  bob,
  tilt,
  spin,
  squash,
  wobble,
  ease: STANDARD_EASE,
  ...extras,
});

export const MOTION_CLIPS: Readonly<Record<string, MotionClip>> = {
  Idle_A: clip("Idle_A", 6, 0.9, 2.4, 0.15, 0.015, 0.45),
  Idle_B: clip("Idle_B", 4, 1.5, 5.6, 0.45, 0.035, 0.8),
  Idle_D: clip("Idle_D", 6, 0.5, 11, 0.8, 0.02, 0.55),
  Streaming_A: clip("Streaming_A", 2.6, 2.2, 8, 1.2, 0.055, 1.3),
  Streaming_B: clip("Streaming_B", 2.6, 2.8, 6, 1.5, 0.07, 1.1),
  Streaming_C: clip("Streaming_C", 2.4, 2.4, 10, 1.8, 0.06, 1.5),
  Working_A: clip("Working_A", 3.5, 1.4, 7, 0.8, 0.04, 0.9),
  Working_B: clip("Working_B", 3.8, 2, 9, 1.1, 0.05, 1.1),
  Working_C: clip("Working_C", 3.2, 1.8, 6, 0.9, 0.045, 1.2),
  Working_D: clip("Working_D", 4.2, 1.2, 10, 1.3, 0.035, 0.8),
  Working_E: clip("Working_E", 3.6, 2.2, 8, 1.5, 0.06, 1.1),
  Working_F: clip("Working_F", 3.1, 1.7, 5, 0.7, 0.04, 0.95),
  Blocked_A: clip("Blocked_A", 3.8, 0.6, 3.5, 0.25, 0.015, 0.35),
  Blocked_B: clip("Blocked_B", 4.2, 0.45, 2.4, 0.1, 0.01, 0.25),
  Blocked_C: clip("Blocked_C", 5.4, 0.3, 1.4, 0.08, 0.012, 0.18),
  Done_A: clip("Done_A", 3.7, 3.1, 8, 3.6, 0.1, 1.6),
  Done_B: clip("Done_B", 3.3, 2.7, 10, 3, 0.085, 1.4),
  Done_C: clip("Done_C", 3.1, 3.4, 12, 4, 0.11, 1.8),
  Rotation_A: clip("Rotation_A", 5.4, 1.2, 6, 6.28, 0.04, 0.9),
  Rotation_B: clip("Rotation_B", 10, 0.5, 4, 6.28, 0.02, 0.4),
  Rotation_C: clip("Rotation_C", 4, 1.4, 7, 3.14, 0.035, 0.7),
  Marketing_A: clip("Marketing_A", 4.4, 2.8, 12, 2.5, 0.08, 1.6),
  Marketing_B: clip("Marketing_B", 4.1, 2.4, 8, 2, 0.07, 1.2),
  Marketing_C: clip("Marketing_C", 4.8, 3, 14, 3, 0.09, 1.7),
  Marketing_D: clip("Marketing_D", 4.5, 2.2, 9, 2.4, 0.075, 1.3),
  Logo_A: clip("Logo_A", 4, 0.8, 5, 3.8, 0.025, 0.55),
  Logo_B: clip("Logo_B", 4, 1, 7, 4.2, 0.03, 0.65),
  Bodymoves_A: clip("Bodymoves_A", 3.6, 3.5, 13, 2.8, 0.1, 1.9),

  // ---- Lab clips: new behaviours built from the same clip model ----
  // Sneeze: slow lean back, sharp forward jolt, settle. Pitch is bridged
  // between clips (0.28 s), so the snap comes from the clip switch itself.
  Sneeze_A: clip("Sneeze_A", 0.55, 0.6, 4, 0, 0.03, 0.7, {
    pitch: -10,
    blinks: 0,
  }),
  Sneeze_B: clip("Sneeze_B", 0.22, 2.2, 8, 0, 0.13, 1.4, {
    pitch: 22,
    blinks: 1,
  }),
  Sneeze_C: clip("Sneeze_C", 0.5, 0.9, 3, 0, 0.02, 0.55, {
    pitch: 3,
    blinks: 0,
  }),
  // Shiver: six compressed motion cycles per second, no blinks.
  Shiver_A: clip("Shiver_A", 1, 0.3, 2, 0, 0.012, 1.3, {
    pitch: 1.5,
    cycles: 6,
    blinks: 0,
  }),
  // Stretch: long slow arch backwards with a deep squash.
  Stretch_A: clip("Stretch_A", 1.5, 1.7, 5, 0, 0.09, 0.6, {
    pitch: -8,
    blinks: 1,
  }),
  // Doze: almost still, very slow breathing, no blinking.
  Doze_A: clip("Doze_A", 4.5, 0.35, 1.2, 0, 0.008, 0.18, {
    pitch: 1.2,
    blinks: 0,
  }),
  Pace_A: clip("Pace_A", 2.4, 0.9, 2, 0, 0.02, 0.5, {
    cycles: 2,
    blinks: 1,
  }),
  Wink_A: clip("Wink_A", 0.8, 1.2, 6, 0, 0.02, 0.8, {
    blinks: 0,
  }),
};

const WORKING: readonly string[] = [
  "Working_A",
  "Working_B",
  "Working_C",
  "Working_D",
  "Working_E",
  "Working_F",
];

export const STATE_DEFINITIONS: Readonly<
  Record<string, StateDefinition>
> = {
  idle: {
    clips: ["Idle_B", "Idle_B", "Idle_D", "Idle_B", "Idle_A"],
    compactClips: ["Idle_B"],
  },
  listening: { clips: ["Idle_D"], face: "calm" },
  thinking: { clips: ["Idle_B"], morph: "thinking" },
  streaming: { clips: ["Streaming_A", "Streaming_B", "Streaming_C"] },
  searching: { clips: ["Idle_B"], morph: "radar" },
  reading: { clips: WORKING },
  working: { clips: WORKING },
  coding: { clips: WORKING },
  running: { clips: WORKING },
  computing: { clips: WORKING },
  controlling: { clips: WORKING },
  waiting: { clips: ["Idle_B"], morph: "orbit" },
  blocked: {
    clips: ["Blocked_A"],
    next: "drowsy",
    holdSeconds: 120,
  },
  finished: {
    clips: ["Done_B", "Done_A"],
    face: "happy",
    next: "idle",
  },
  failed: { clips: ["Blocked_B"], next: "idle" },
  sleeping: { clips: ["Idle_B"], face: "sleepy" },
  waking: {
    clips: ["Idle_B"],
    face: "surprised",
    next: "idle",
    holdSeconds: 1.6,
  },
  happy: { clips: ["Done_A"] },
  excited: { clips: ["Done_C"] },
  laughing: { clips: ["Done_B"] },
  proud: { clips: ["Marketing_B"] },
  curious: { clips: ["Working_B"], face: "inspecting" },
  playful: { clips: ["Bodymoves_A"] },
  shy: { clips: ["Idle_D"], face: "calm" },
  surprised: { clips: ["Idle_B"], face: "surprised" },
  suspicious: { clips: ["Idle_D"], face: "squinted" },
  angry: { clips: ["Blocked_A"], face: "squinted" },
  confused: { clips: ["Blocked_A"] },
  sad: { clips: ["Blocked_B"] },
  drowsy: { clips: ["Blocked_C"] },
  bored: { clips: ["Idle_B"], face: "sleepy" },
  scared: { clips: ["Idle_D"], face: "surprised" },
  celebrate: { clips: ["Rotation_A"], face: "happy" },
  approving: { clips: ["Rotation_C"], next: "idle" },
  orbit: { clips: ["Idle_B"], morph: "orbit" },
  radar: { clips: ["Idle_B"], morph: "radar" },
  progress: { clips: ["Idle_B"], morph: "progress" },
  spawning: { clips: ["Idle_B"], morph: "spawning" },
  loading: { clips: ["Idle_B"], morph: "progress" },
  dictating: { clips: ["Idle_B"], morph: "dictating" },
  sending: { clips: ["Idle_B"], morph: "sending" },
  receiving: { clips: ["Idle_B"], morph: "receiving" },
  uploading: { clips: ["Idle_B"], morph: "uploading" },
  writing: { clips: ["Idle_B"], morph: "writing" },
  alerting: { clips: ["Idle_B"], morph: "alerting" },
  bouncing: { clips: ["Idle_B"], morph: "bouncing" },
  "powering-down": { clips: ["Idle_B"], morph: "powering-down" },
  humming: { clips: ["Idle_B"], face: "calm" },
  notifying: { clips: ["Done_B"], face: "surprised" },
  dragging: { clips: ["Idle_B"], face: "surprised" },
  logo: { clips: ["Logo_A", "Logo_B"] },
  showcase: {
    clips: ["Marketing_A", "Marketing_B", "Marketing_C", "Marketing_D"],
  },
  turntable: { clips: ["Rotation_B"] },

  // ---- Lab states: not listed in MARK_STATE_GROUPS, so the app UI and the
  // mark engine never receive them. They are playable by MarkMotionEngine. ----
  sneeze: {
    clips: ["Sneeze_A", "Sneeze_B", "Sneeze_C"],
    face: "squinted",
    next: "idle",
  },
  shiver: {
    clips: ["Shiver_A"],
    face: "surprised",
    next: "idle",
    holdSeconds: 2.4,
  },
  stretch: {
    clips: ["Stretch_A", "Idle_B"],
    face: "sleepy",
    next: "idle",
  },
  doze: {
    clips: ["Doze_A"],
    face: "sleepy",
    next: "waking",
    holdSeconds: 5.5,
  },
  pace: {
    clips: ["Pace_A"],
    face: "calm",
    next: "idle",
    holdSeconds: 4,
  },
  wink: {
    clips: ["Wink_A"],
    face: "wink",
    next: "idle",
  },
};

export const clipProfile = (name: string): MotionClip =>
  MOTION_CLIPS[name] ?? MOTION_CLIPS.Idle_B!;

