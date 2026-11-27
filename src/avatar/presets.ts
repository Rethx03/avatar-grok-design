import type { BotColor, BotShape, MarkState } from "./types.js";

/**
 * A named look for the mark: body shape, ink color, and the state it starts in.
 *
 * Presets are plain data, so they can be used for menus, galleries, or to seed
 * a config without importing any React code.
 */
export interface AvatarPresetDefinition {
  /** English label suitable for a picker. */
  readonly label: string;
  /** Simplified Chinese label. */
  readonly labelZh: string;
  /** One-line English description. */
  readonly description: string;
  /** One-line Simplified Chinese description. */
  readonly descriptionZh: string;
  readonly shape: BotShape;
  readonly color: BotColor;
  /** Optional custom ink color that overrides the palette color. */
  readonly colorHex?: string;
  /** Initial motion state. */
  readonly state: MarkState;
}

export const AVATAR_PRESETS = {
  classic: {
    label: "Classic blue",
    labelZh: "经典蓝",
    description: "The default blob with the signature blue ink.",
    descriptionZh: "默认水滴形与标志性蓝色墨水。",
    shape: "blob",
    color: "blue",
    state: "idle",
  },
  midnight: {
    label: "Midnight ink",
    labelZh: "午夜墨黑",
    description: "Monochrome blob for light surfaces and quiet interfaces.",
    descriptionZh: "单色水滴形，适合浅色背景和安静的界面。",
    shape: "blob",
    color: "black",
    state: "idle",
  },
  ember: {
    label: "Ember bean",
    labelZh: "熔岩豆",
    description: "A warm bean that looks busy while it works.",
    descriptionZh: "温暖的豆形，工作时显得很有干劲。",
    shape: "bean",
    color: "orange",
    state: "working",
  },
  mint: {
    label: "Mint squircle",
    labelZh: "薄荷方圆",
    description: "A calm squircle in fresh green.",
    descriptionZh: "清爽绿色的平静方圆造型。",
    shape: "squircle",
    color: "green",
    state: "idle",
  },
  neon: {
    label: "Neon gem",
    labelZh: "霓虹宝石",
    description: "A faceted gem in electric violet, thinking.",
    descriptionZh: "电光紫的宝石造型，正在思考。",
    shape: "gem",
    color: "violet",
    state: "thinking",
  },
  ghost: {
    label: "Shy ghost",
    labelZh: "害羞幽灵",
    description: "The lab ghost body with a bashful face.",
    descriptionZh: "实验室幽灵形态，配上害羞的表情。",
    shape: "ghost",
    color: "gray",
    state: "shy",
  },
  cookie: {
    label: "Happy cookie",
    labelZh: "开心曲奇",
    description: "A cookie body for playful product moments.",
    descriptionZh: "曲奇形态，适合轻松俏皮的产品场景。",
    shape: "cookie",
    color: "brown",
    state: "happy",
  },
  starlight: {
    label: "Starlight",
    labelZh: "星光闪耀",
    description: "A star body that celebrates on arrival.",
    descriptionZh: "星形造型，出场即庆祝。",
    shape: "star",
    color: "yellow",
    state: "celebrate",
  },
  sunset: {
    label: "Sunset glow",
    labelZh: "落日晚霞",
    description: "Custom coral ink on the bean body.",
    descriptionZh: "豆形搭配自定义珊瑚色墨水。",
    shape: "bean",
    color: "red",
    colorHex: "#ff5f6d",
    state: "happy",
  },
  brand: {
    label: "Brand logo",
    labelZh: "品牌标志",
    description: "The blue blob playing its logo rotation.",
    descriptionZh: "蓝色水滴形播放品牌标志旋转。",
    shape: "blob",
    color: "blue",
    state: "logo",
  },
} as const satisfies Record<string, AvatarPresetDefinition>;

export type AvatarPresetId = keyof typeof AVATAR_PRESETS;

export type AvatarPreset = { readonly id: AvatarPresetId } & AvatarPresetDefinition;

export const DEFAULT_PRESET_ID: AvatarPresetId = "classic";

const isPresetId = (value: string): value is AvatarPresetId =>
  Object.prototype.hasOwnProperty.call(AVATAR_PRESETS, value);

/** Returns every preset as an array, with its id included. */
export const listAvatarPresets = (): AvatarPreset[] =>
  (Object.keys(AVATAR_PRESETS) as AvatarPresetId[]).map((id) => ({
    id,
    ...AVATAR_PRESETS[id],
  }));

/** Looks a preset up by id; unknown ids fall back to the default preset. */
export const resolveAvatarPreset = (id: string): AvatarPreset => {
  const resolved = isPresetId(id) ? id : DEFAULT_PRESET_ID;
  return { id: resolved, ...AVATAR_PRESETS[resolved] };
};

/**
 * The complete, resolved appearance and playback configuration.
 * Every key maps 1:1 onto a prop of `GrokBotMark`, so it can be spread directly.
 */
export interface AvatarConfig {
  readonly state: MarkState;
  readonly shape: BotShape;
  readonly color: BotColor;
  readonly colorHex?: string;
  readonly size: number;
  readonly paused: boolean;
  readonly followPointer: boolean;
  readonly settleIdle: boolean;
  readonly maxFrameRate: 30 | 60;
  readonly reducedMotion: boolean;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  state: "idle",
  shape: "blob",
  color: "blue",
  size: 240,
  paused: false,
  followPointer: true,
  settleIdle: true,
  maxFrameRate: 60,
  reducedMotion: false,
};

export interface AvatarConfigInput extends Partial<AvatarConfig> {
  /** Preset id used for any field that is not overridden. */
  readonly preset?: AvatarPresetId | (string & {});
}

/**
 * Builds a fully resolved config from a preset and/or explicit overrides.
 *
 * ```ts
 * const config = createAvatarConfig({ preset: "ghost", size: 96 });
 * ```
 */
export const createAvatarConfig = (
  input: AvatarConfigInput = {},
): AvatarConfig => {
  const preset =
    input.preset === undefined ? null : resolveAvatarPreset(input.preset);

  return {
    state: input.state ?? preset?.state ?? DEFAULT_AVATAR_CONFIG.state,
    shape: input.shape ?? preset?.shape ?? DEFAULT_AVATAR_CONFIG.shape,
    color: input.color ?? preset?.color ?? DEFAULT_AVATAR_CONFIG.color,
    colorHex: input.colorHex ?? preset?.colorHex,
    size: input.size ?? DEFAULT_AVATAR_CONFIG.size,
    paused: input.paused ?? DEFAULT_AVATAR_CONFIG.paused,
    followPointer:
      input.followPointer ?? DEFAULT_AVATAR_CONFIG.followPointer,
    settleIdle: input.settleIdle ?? DEFAULT_AVATAR_CONFIG.settleIdle,
    maxFrameRate: input.maxFrameRate ?? DEFAULT_AVATAR_CONFIG.maxFrameRate,
    reducedMotion:
      input.reducedMotion ?? DEFAULT_AVATAR_CONFIG.reducedMotion,
  };
};
