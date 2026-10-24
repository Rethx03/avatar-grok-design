export interface ExactMarkAppearance {
  readonly ink: readonly [number, number, number];
  readonly spot: readonly [number, number, number];
  readonly cutout: boolean;
  readonly inkPaint: string;
  readonly spotPaint?: string;
}

export interface ExactMarkEngineInput {
  readonly body: string;
  readonly appearance: ExactMarkAppearance;
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

export interface ExactMarkEngine {
  attach(input: { readonly host: HTMLElement; readonly canvas: HTMLElement }): () => void;
  update(input: Partial<ExactMarkEngineInput>): void;
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

export function w(input: ExactMarkEngineInput): ExactMarkEngine;
export function T(shape: string): string;
export function E(ink: string, spot?: string): ExactMarkAppearance;
export const j: number;

