import { describe, expect, it } from "vitest";
import { getShapeGeometry } from "./shapeGeometry";
import { SHAPE_OPTIONS } from "./types";

describe("shape geometry", () => {
  it.each(SHAPE_OPTIONS)("generates a closed SVG path for $id", ({ id }) => {
    const geometry = getShapeGeometry(id, 34);
    expect(geometry.bodyPath.startsWith("M")).toBe(true);
    expect(geometry.bodyPath.endsWith("Z")).toBe(true);
    expect(geometry.bodyPath).not.toContain("NaN");
    expect(geometry.bodyPath.length).toBeGreaterThan(120);
  });

  it("only gives the seasonal pumpkin a stem", () => {
    expect(getShapeGeometry("pumpkin", 34).stemPath).not.toBeNull();
    expect(getShapeGeometry("blob", 34).stemPath).toBeNull();
  });
});

