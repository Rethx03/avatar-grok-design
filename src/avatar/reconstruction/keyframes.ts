import type { MotionClip } from "../animationClips";
import type { Face } from "../types";
import {
  clamp,
  cubicBezierEase,
  shortestAngle,
  smoothstep,
  type Easing,
} from "./math";

export type Vector2 = readonly [number, number];
export type Vector3 = readonly [number, number, number];

export interface VectorKeyframe<T extends readonly number[]> {
  readonly time: number;
  readonly value: T;
  readonly easing: Easing;
}

export interface ExpressionKeyframe {
  readonly time: number;
  readonly value: Face | "blink";
}

export interface RecipePose {
  readonly rotation: Vector3;
  readonly position: Vector2;
  readonly scale: Vector2;
  readonly zoom: number;
}

export interface RecipeSection {
  readonly name: string;
  readonly duration: number;
  readonly rotation: readonly VectorKeyframe<Vector3>[];
  readonly position: readonly VectorKeyframe<Vector2>[];
  readonly scale: readonly VectorKeyframe<Vector2>[];
  readonly zoom: readonly VectorKeyframe<readonly [number]>[];
  readonly expressions: readonly ExpressionKeyframe[];
  readonly spinRadians: number;
}

export const DEFAULT_EASING: Easing = [0.42, 0, 0.58, 1];
export const BRIDGE_EASING: Easing = [0.4, 0, 0.2, 1];
export const DEFAULT_ZOOM = 0.6;

const vectorTrack = <T extends readonly number[]>(
  entries: ReadonlyArray<readonly [number, T, Easing?]>,
): readonly VectorKeyframe<T>[] =>
  entries.map(([time, value, easing = DEFAULT_EASING]) => ({
    time,
    value,
    easing,
  }));

export const sampleVectorTrack = <T extends readonly number[]>(
  track: readonly VectorKeyframe<T>[],
  time: number,
): T | null => {
  if (track.length === 0) return null;

  const first = track[0]!;
  if (time <= first.time) return first.value;

  const last = track[track.length - 1]!;
  if (time >= last.time) return last.value;

  let leftIndex = 0;
  while (
    leftIndex < track.length - 2 &&
    track[leftIndex + 1]!.time <= time
  ) {
    leftIndex += 1;
  }

  const left = track[leftIndex]!;
  const right = track[leftIndex + 1]!;
  const progress =
    (time - left.time) / Math.max(right.time - left.time, 1e-9);
  const eased = cubicBezierEase(progress, left.easing);

  return left.value.map((value, index) =>
    value + (right.value[index]! - value) * eased,
  ) as unknown as T;
};

export const samplePose = (
  section: RecipeSection,
  time: number,
): RecipePose => ({
  rotation: sampleVectorTrack(section.rotation, time) ?? [0, 0, 0],
  position: sampleVectorTrack(section.position, time) ?? [0, 0],
  scale: sampleVectorTrack(section.scale, time) ?? [1, 1],
  zoom:
    sampleVectorTrack(section.zoom, time)?.[0] ?? DEFAULT_ZOOM,
});

export interface GeneratedClipSection extends RecipeSection {
  readonly sourceClip: MotionClip;
}

/**
 * Expands the compact clip profile into real keyframe tracks. These curves are
 * authored for this reconstruction; they approximate the observed rhythm while
 * keeping the runtime data readable and independently tunable.
 */
export const createClipSection = (
  profile: MotionClip,
): GeneratedClipSection => {
  const duration = profile.duration;
  const travel = clamp(profile.bob * 0.018, 0.012, 0.074);
  const tilt = profile.tilt;
  const wobble = profile.wobble;
  const squash = clamp(profile.squash, 0.008, 0.12);

  return {
    name: profile.name,
    duration,
    sourceClip: profile,
    spinRadians: profile.spin,
    position: vectorTrack([
      [0, [0, 0]],
      [duration * 0.18, [travel * 0.18, travel], BRIDGE_EASING],
      [duration * 0.42, [-travel * 0.62, -travel * 0.22]],
      [duration * 0.7, [travel * 0.56, travel * 0.33], BRIDGE_EASING],
      [duration * 0.88, [0, -travel * 0.16]],
      [duration, [0, 0]],
    ]),
    rotation: vectorTrack([
      [0, [0, 0, 0]],
      [
        duration * 0.16,
        [-tilt * 0.16, tilt * 0.34, -wobble * 2.4],
        BRIDGE_EASING,
      ],
      [duration * 0.39, [tilt * 0.34, -tilt * 0.72, wobble * 2.7]],
      [duration * 0.67, [-tilt * 0.25, tilt * 0.58, -wobble * 2.1]],
      [duration * 0.85, [tilt * 0.08, -tilt * 0.17, wobble * 0.5]],
      [duration, [0, 0, 0]],
    ]),
    scale: vectorTrack([
      [0, [1, 1]],
      [
        duration * 0.23,
        [1 + squash * 0.72, 1 - squash * 0.84],
        BRIDGE_EASING,
      ],
      [duration * 0.48, [1 - squash * 0.48, 1 + squash * 0.68]],
      [duration * 0.71, [1 + squash * 0.22, 1 - squash * 0.26]],
      [duration * 0.9, [1 - squash * 0.08, 1 + squash * 0.1]],
      [duration, [1, 1]],
    ]),
    zoom: vectorTrack([
      [0, [DEFAULT_ZOOM]],
      [duration * 0.48, [DEFAULT_ZOOM * 1.025], BRIDGE_EASING],
      [duration, [DEFAULT_ZOOM]],
    ]),
    expressions: [
      { time: duration * 0.37, value: "blink" },
      { time: duration * 0.76, value: "blink" },
    ],
  };
};

export const createBridgeSection = (
  name: string,
  from: RecipePose,
  to: RecipePose,
  duration = 0.28,
): RecipeSection => {
  const endRotation: Vector3 = [
    shortestAngle(from.rotation[0], to.rotation[0]),
    shortestAngle(from.rotation[1], to.rotation[1]),
    shortestAngle(from.rotation[2], to.rotation[2]),
  ];

  return {
    name,
    duration,
    spinRadians: 0,
    position: vectorTrack([
      [0, from.position, BRIDGE_EASING],
      [duration, to.position],
    ]),
    rotation: vectorTrack([
      [0, from.rotation, BRIDGE_EASING],
      [duration, endRotation],
    ]),
    scale: vectorTrack([
      [0, from.scale, BRIDGE_EASING],
      [duration, to.scale],
    ]),
    zoom: vectorTrack([
      [0, [from.zoom], BRIDGE_EASING],
      [duration, [to.zoom]],
    ]),
    expressions: [],
  };
};

export const sampleExpression = (
  expressions: readonly ExpressionKeyframe[],
  fromTime: number,
  toTime: number,
): readonly ExpressionKeyframe[] => {
  const start = Math.min(fromTime, toTime);
  const end = Math.max(fromTime, toTime);
  return expressions.filter(
    ({ time }) =>
      time > start + 1e-9 &&
      time <= end + 1e-9 &&
      time >= 0,
  );
};

export const bridgeProgress = (
  elapsed: number,
  duration: number,
): number => smoothstep(elapsed / Math.max(duration, 1e-6));
