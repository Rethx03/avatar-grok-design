import { describe, expect, it } from "vitest";
import * as vanilla from "./vanilla.js";

describe("vanilla entry point", () => {
  it("exports the React-free API", () => {
    expect(typeof vanilla.mountBlobMark).toBe("function");
    expect(typeof vanilla.createMarkEngine).toBe("function");
    expect(typeof vanilla.createAvatarActionRunner).toBe("function");
    expect(typeof vanilla.createAvatarConfig).toBe("function");
    expect(typeof vanilla.deriveMarkState).toBe("function");
    expect(vanilla.AVATAR_PRESETS.classic.shape).toBe("blob");
    expect(vanilla.MARK_STATE_GROUPS.length).toBeGreaterThan(0);
    expect(vanilla.SHAPE_OPTIONS).toHaveLength(28);
  });

  it("stays free of React exports", () => {
    expect("useBlobMark" in vanilla).toBe(false);
    expect("BlobMark" in vanilla).toBe(false);
    expect("SvgBlobMark" in vanilla).toBe(false);
  });

  it("fails with a clear message when there is no DOM", () => {
    expect(() => vanilla.mountBlobMark("#missing")).toThrow(/requires a DOM/);
  });
});
