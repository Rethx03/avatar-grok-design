import { describe, expect, it } from "vitest";
import { COPY } from "./i18n";

describe("interface translations", () => {
  it("covers every localizable domain identity", () => {
    for (const language of ["en", "zh"] as const) {
      expect(Object.keys(COPY[language].groups)).toEqual(Object.keys(COPY.en.groups));
      expect(Object.keys(COPY[language].states)).toEqual(Object.keys(COPY.en.states));
      expect(Object.keys(COPY[language].shapes)).toEqual(Object.keys(COPY.en.shapes));
      expect(Object.keys(COPY[language].colors)).toEqual(Object.keys(COPY.en.colors));
      expect(Object.keys(COPY[language].faces)).toEqual(Object.keys(COPY.en.faces));
      expect(Object.keys(COPY[language].morphs)).toEqual(Object.keys(COPY.en.morphs));
    }
  });

  it("provides Chinese labels for state, shape, and color controls", () => {
    expect(COPY.zh.states["powering-down"]).toBe("关机");
    expect(COPY.zh.shapes.squircle).toBe("圆角方形");
    expect(COPY.zh.colors.violet).toBe("紫色");
  });
});
