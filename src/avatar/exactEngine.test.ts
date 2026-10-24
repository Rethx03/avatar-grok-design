import { describe, expect, it } from "vitest";
import {
  E as exactAppearance,
  T as exactBody,
} from "../vendor/grok-bot-mark/index.eager-common-F4Y1-gMW.js";
import { resolveColorHex } from "./exactEngine";

describe("exact engine adapter", () => {
  it("uses the shipped shape-name mapping", () => {
    expect(exactBody("blob")).toBe("sphere");
    expect(exactBody("star")).toBe("star6");
    expect(exactBody("heart")).toBe("heartChubby");
    expect(exactBody("flower")).toBe("starFlower");
    expect(exactBody("gem")).toBe("gem");
  });

  it("creates the shipped cutout appearance", () => {
    const appearance = exactAppearance("#1084fe");
    expect(appearance.cutout).toBe(true);
    expect(appearance.inkPaint).toBe("#1084fe");
  });

  it("prefers a valid custom color and otherwise uses the preset", () => {
    expect(resolveColorHex("blue", "#12ab9f")).toBe("#12ab9f");
    expect(resolveColorHex("blue", "invalid")).toBe("#1084fe");
    expect(resolveColorHex("violet")).toBe("#9159fe");
  });
});
