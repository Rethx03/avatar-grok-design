export interface MarkAppearance {
  readonly ink: readonly [number, number, number];
  readonly spot: readonly [number, number, number];
  readonly cutout: boolean;
  readonly inkPaint: string;
  readonly spotPaint?: string;
}

export interface MarkEngineInput {
  readonly body: string;
  readonly appearance: MarkAppearance;
  readonly size: number;
  readonly fill: number;
  readonly resolution?: number;
  readonly id: string;
  readonly seed?: number | string;
  readonly state?: string;
  readonly clip?: unknown;
  readonly morph?: unknown;
  readonly maxFrameRate?: number;
  readonly isPlaying?: boolean;
  readonly isEmphasized?: boolean;
  readonly isFollowingPointer?: boolean;
  readonly isStatic?: boolean;
  readonly isProof?: boolean;
}

export interface MarkEngine {
  attach(input: {
    readonly host: HTMLElement;
    readonly canvas: HTMLElement;
  }): () => void;
  update(input: Partial<MarkEngineInput>): void;
  setState(state: string): void;
  setBody(body: string): void;
  setPlaying(isPlaying: boolean): void;
  setExpression(name: string, blend?: number): void;
  blink(): void;
  look(direction: "left" | "right" | "up" | "down" | "center"): void;
  restart(): void;
  poke(kind: "spin" | "bounce", options?: { readonly turns?: number }): void;
  gaze(direction: readonly [number, number] | null): void;
}

export function createMarkEngine(input: MarkEngineInput): MarkEngine;
export function canonicalBody(shape: string): string;
export function createAppearance(
  ink: string,
  spot?: string,
): MarkAppearance;
export const defaultFill: number;

export function createMotionCore(options?: {
  readonly body?: string;
  readonly zoomMul?: number;
  readonly isGazeAlways?: boolean;
}): unknown;
export function createStateGraph(
  core: unknown,
  state: string,
  options?: unknown,
): unknown;
export function renderMarkScene(
  frame: unknown,
  appearance: MarkAppearance,
  size: number,
  id: string,
  options?: unknown,
): unknown;
