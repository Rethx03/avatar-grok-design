import {
  E as createAppearance,
  T as canonicalBody,
  j as DEFAULT_FILL,
  w as createEngine,
  type ExactMarkEngine,
  type ExactMarkEngineInput,
} from "../vendor/grok-bot-mark/index.eager-common-F4Y1-gMW.js";
import type { BotColor, BotShape } from "./types";
import { COLOR_OPTIONS } from "./types";

export interface ExactEngineOptions {
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

const exactInput = (options: ExactEngineOptions): ExactMarkEngineInput => ({
  id: options.id,
  body: canonicalBody(options.shape),
  appearance: createAppearance(resolveColorHex(options.color, options.colorHex)),
  state: options.state,
  size: options.size,
  fill: DEFAULT_FILL,
  seed: `${options.shape}:${resolveColorHex(options.color, options.colorHex)}`,
  maxFrameRate: options.maxFrameRate,
  isPlaying: !options.paused && !options.reducedMotion,
  isEmphasized: false,
  isFollowingPointer: options.followPointer,
  isStatic: options.reducedMotion,
  isProof: false,
});

export const createExactMarkEngine = (
  options: ExactEngineOptions,
): ExactMarkEngine => createEngine(exactInput(options));

export const exactEngineUpdate = (
  options: ExactEngineOptions,
): Partial<ExactMarkEngineInput> => {
  const input = exactInput(options);
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

