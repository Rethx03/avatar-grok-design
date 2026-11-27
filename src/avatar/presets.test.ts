import { describe, expect, it } from "vitest";
import { STATE_DEFINITIONS } from "./animationClips.js";
import {
  AVATAR_PRESETS,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_PRESET_ID,
  createAvatarConfig,
  listAvatarPresets,
  resolveAvatarPreset,
} from "./presets.js";
import { listMarkStates } from "./stateModel.js";
import { COLOR_OPTIONS, SHAPE_OPTIONS } from "./types.js";

const shapeIds = new Set<string>(SHAPE_OPTIONS.map((shape) => shape.id));
const colorIds = new Set<string>(COLOR_OPTIONS.map((color) => color.id));
const stateIds = new Set<string>(listMarkStates());

describe("avatar presets", () => {
  it("only reference known shapes, colors, and playable states", () => {
    for (const preset of listAvatarPresets()) {
      expect(shapeIds.has(preset.shape), `${preset.id}: shape`).toBe(true);
      expect(colorIds.has(preset.color), `${preset.id}: color`).toBe(true);
      expect(stateIds.has(preset.state), `${preset.id}: state`).toBe(true);
      expect(STATE_DEFINITIONS[preset.state], `${preset.id}: clips`).toBeDefined();
      if (preset.colorHex !== undefined) {
        expect(preset.colorHex, `${preset.id}: hex`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("has unique ids, bilingual copy, and a resolvable default", () => {
    const presets = listAvatarPresets();
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    for (const preset of presets) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.labelZh.length).toBeGreaterThan(0);
      expect(preset.descriptionZh.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_PRESET_ID in AVATAR_PRESETS).toBe(true);
    expect(resolveAvatarPreset("not-a-preset").id).toBe(DEFAULT_PRESET_ID);
  });

  it("merges optional preset values with explicit overrides", () => {
    const config = createAvatarConfig({
      preset: "neon",
      size: 64,
      shape: "star",
      state: "idle",
    });

    expect(config.color).toBe(AVATAR_PRESETS.neon.color);
    expect(config.shape).toBe("star");
    expect(config.state).toBe("idle");
    expect(config.size).toBe(64);
    expect(config.followPointer).toBe(DEFAULT_AVATAR_CONFIG.followPointer);
  });

  it("keeps custom ink colors from presets unless overridden", () => {
    const presetConfig = createAvatarConfig({ preset: "sunset" });
    expect(presetConfig.colorHex).toBe(AVATAR_PRESETS.sunset.colorHex);

    const overridden = createAvatarConfig({
      preset: "sunset",
      colorHex: "#123456",
    });
    expect(overridden.colorHex).toBe("#123456");
  });

  it("returns a complete config with no preset", () => {
    expect(createAvatarConfig()).toEqual(DEFAULT_AVATAR_CONFIG);
    expect(createAvatarConfig({ color: "red" })).toEqual({
      ...DEFAULT_AVATAR_CONFIG,
      color: "red",
    });
  });
});
