export const TAU = Math.PI * 2;

export type Easing = readonly [number, number, number, number];

export interface SpringState {
  value: number;
  velocity: number;
  target: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

export const smoothstep = (value: number): number => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

const bezierCoordinate = (
  time: number,
  controlA: number,
  controlB: number,
): number => {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * controlA +
    3 * inverse * time * time * controlB +
    time * time * time
  );
};

const bezierDerivative = (
  time: number,
  controlA: number,
  controlB: number,
): number => {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * controlA +
    6 * inverse * time * (controlB - controlA) +
    3 * time * time * (1 - controlB)
  );
};

/**
 * Solves the x-axis of a CSS-style cubic-bezier curve, then evaluates y.
 * The shipped engine uses the same eight-step Newton strategy.
 */
export const cubicBezierEase = (
  progress: number,
  easing: Easing,
): number => {
  const x = clamp(progress, 0, 1);
  const [x1, y1, x2, y2] = easing;
  let parameter = x;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = bezierCoordinate(parameter, x1, x2) - x;
    const derivative = bezierDerivative(parameter, x1, x2);
    if (Math.abs(error) < 1e-6 || Math.abs(derivative) < 1e-6) break;
    parameter = clamp(parameter - error / derivative, 0, 1);
  }

  return bezierCoordinate(parameter, y1, y2);
};

export const shortestAngle = (from: number, to: number): number =>
  from + 360 * Math.round((to - from) / 360);

export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 1831565813) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^=
      value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
};

export const springStep = (
  spring: SpringState,
  stiffness: number,
  damping: number,
  deltaSeconds: number,
): void => {
  const velocity =
    spring.velocity +
    (-2 * damping * stiffness * spring.velocity -
      stiffness * stiffness * (spring.value - spring.target)) *
      deltaSeconds;
  const value = spring.value + velocity * deltaSeconds;

  if (!Number.isFinite(value) || !Number.isFinite(velocity)) {
    spring.value = spring.target;
    spring.velocity = 0;
    return;
  }

  spring.value = value;
  spring.velocity = velocity;
};

export const springSubsteps = (deltaSeconds: number): number =>
  Math.max(1, Math.ceil(deltaSeconds * 120));

export const createSpring = (value: number): SpringState => ({
  value,
  velocity: 0,
  target: value,
});

export const windowPulse = (
  progress: number,
  start: number,
  end: number,
): number => {
  if (progress <= start || progress >= end) return 0;
  return Math.sin((Math.PI * (progress - start)) / (end - start)) ** 2;
};
