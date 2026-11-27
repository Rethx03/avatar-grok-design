import { describe, expect, it } from "vitest";
import * as vanilla from "./vanilla.js";

describe("vanilla entry point", () => {
  it("exports the React-free API", () => {
    expect(typeof vanilla.mountGrokBotMark).toBe("function");
    expect(typeof vanilla.createMarkEngine).toBe("function");
    expect(typeof vanilla.createAvatarActionRunner).toBe("function");
    expect(typeof vanilla.createAvatarConfig).toBe("function");
    expect(typeof vanilla.deriveMarkState).toBe("function");
    expect(vanilla.AVATAR_PRESETS.classic.shape).toBe("blob");
    expect(vanilla.MARK_STATE_GROUPS.length).toBeGreaterThan(0);
    expect(vanilla.SHAPE_OPTIONS).toHaveLength(28);
  });

  it("stays free of React exports", () => {
    expect("useGrokBotAvatar" in vanilla).toBe(false);
    expect("GrokBotMark" in vanilla).toBe(false);
    expect("SvgGrokBotMark" in vanilla).toBe(false);
  });

  it("fails with a clear message when there is no DOM", () => {
    expect(() => vanilla.mountGrokBotMark("#missing")).toThrow(/requires a DOM/);
  });
});
