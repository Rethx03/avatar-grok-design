import {
  canonicalBody,
  createAppearance,
  createMarkEngine,
  defaultFill,
  type MarkEngine,
  type MarkEngineInput,
} from "../engine/grok-bot-mark/mark-engine.js";
import type { BotColor, BotShape } from "./types";
import { COLOR_OPTIONS } from "./types";

export type {
  MarkAppearance,
  MarkEngine,
  MarkEngineInput,
} from "../engine/grok-bot-mark/mark-engine.js";

export interface MarkEngineOptions {
  readonly id: string;
  readonly shape: BotShape;
  readonly color: BotColor;
  readonly colorHex?: string;
  readonly state: string;
  readonly size: number;
  readonly paused: boolean;
  readonly followPointer: boolean;
  readonly reducedMotion: boolean;
  readonly maxFrameRate: number;
}

export const resolveColorHex = (
  color: BotColor,
  customColorHex?: string,
): string => {
  if (customColorHex !== undefined && /^#[0-9a-f]{6}$/i.test(customColorHex)) {
    return customColorHex;
  }
  return COLOR_OPTIONS.find(({ id }) => id === color)?.hex ?? "#1687ff";
};

const toEngineInput = (options: MarkEngineOptions): MarkEngineInput => ({
  id: options.id,
  body: canonicalBody(options.shape),
  appearance: createAppearance(resolveColorHex(options.color, options.colorHex)),
  state: options.state,
  size: options.size,
  fill: defaultFill,
  seed: `${options.shape}:${resolveColorHex(options.color, options.colorHex)}`,
  maxFrameRate: options.maxFrameRate,
  isPlaying: !options.paused && !options.reducedMotion,
  isEmphasized: false,
  isFollowingPointer: options.followPointer,
  isStatic: options.reducedMotion,
  isProof: false,
});

export const createMarkEngineForOptions = (
  options: MarkEngineOptions,
): MarkEngine => createMarkEngine(toEngineInput(options));

export const updateMarkEngine = (
  options: MarkEngineOptions,
): Partial<MarkEngineInput> => {
  const input = toEngineInput(options);
  return {
    body: input.body,
    appearance: input.appearance,
    state: input.state,
    size: input.size,
    fill: input.fill,
    maxFrameRate: input.maxFrameRate,
    isPlaying: input.isPlaying,
    isFollowingPointer: input.isFollowingPointer,
    isStatic: input.isStatic,
  };
};

