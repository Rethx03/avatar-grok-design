import { describe, expect, it } from "vitest";
import * as api from "./index.js";

describe("package surface", () => {
  it("exports components, hook, catalogs, presets, and actions", () => {
    expect(api.BlobMark).toBeDefined();
    expect(api.MarkCanvas).toBe(api.BlobMark);
    expect(api.SvgMark).toBeDefined();
    expect(api.SvgBlobMark).toBe(api.SvgMark);
    expect(typeof api.useBlobMark).toBe("function");
    expect(typeof api.mountBlobMark).toBe("function");
    expect(typeof api.createAvatarConfig).toBe("function");
    expect(typeof api.createAvatarActionRunner).toBe("function");
  });

  it("ships the full shape, color, and state catalogs", () => {
    expect(api.SHAPE_OPTIONS).toHaveLength(28);
    expect(api.COLOR_OPTIONS).toHaveLength(11);
    expect(api.MARK_STATE_GROUPS.flatMap((group) => group.states)).toHaveLength(59);
    expect(Object.keys(api.AVATAR_PRESETS).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(api.AVATAR_ACTIONS).length).toBeGreaterThanOrEqual(12);
  });

  it("exposes the state derivation and the engine primitives", () => {
    const state = api.deriveMarkState(
      { isRunning: true, currentActivity: { verb: "coding" } },
      Date.now(),
    );
    expect(state).toBe("coding");
    expect(typeof api.createMarkEngine).toBe("function");
    expect(typeof api.canonicalBody).toBe("function");
    expect(api.defaultFill).toBeGreaterThan(0);
  });
});
