import { describe, expect, it } from "vitest";
import {
  canonicalBody,
  createAppearance,
  createMarkEngine,
  defaultFill,
} from "../engine/grok-bot-mark/mark-engine.js";
import {
  createMarkEngineForOptions,
  resolveColorHex,
  updateMarkEngine,
  type MarkEngineOptions,
} from "./markEngine";

const options: MarkEngineOptions = {
  id: "mark-engine-test",
  shape: "star",
  color: "blue",
  state: "working",
  size: 240,
  paused: false,
  followPointer: true,
  reducedMotion: false,
  maxFrameRate: 60,
};

describe("Mark engine", () => {
  it("maps the public shape names to engine bodies", () => {
    expect(canonicalBody("blob")).toBe("sphere");
    expect(canonicalBody("star")).toBe("star6");
    expect(canonicalBody("heart")).toBe("heartChubby");
    expect(canonicalBody("flower")).toBe("starFlower");
    expect(canonicalBody("gem")).toBe("gem");
  });

  it("creates solid and cutout appearances", () => {
    expect(createAppearance("#1084fe").cutout).toBe(true);
    expect(createAppearance("#1084fe").inkPaint).toBe("#1084fe");
    expect(createAppearance("#1084fe", "#ffffff").cutout).toBe(false);
    expect(createAppearance("#1084fe", "#ffffff").spotPaint).toBe("#ffffff");
  });

  it("resolves preset and custom ink colors", () => {
    expect(resolveColorHex("blue", "#12ab9f")).toBe("#12ab9f");
    expect(resolveColorHex("blue", "invalid")).toBe("#1084fe");
    expect(resolveColorHex("violet")).toBe("#9159fe");
  });

  it("creates and updates the public engine contract", () => {
    const engine = createMarkEngineForOptions(options);
    expect(typeof engine.attach).toBe("function");
    expect(typeof engine.update).toBe("function");
    expect(typeof engine.poke).toBe("function");
    expect(defaultFill).toBe(0.92);

    const input = updateMarkEngine({ ...options, state: "finished" });
    expect(input.state).toBe("finished");
    expect(input.body).toBe("star6");
    expect(input.fill).toBe(defaultFill);

    const direct = createMarkEngine({
      id: "direct",
      body: canonicalBody("blob"),
      appearance: createAppearance("#1084fe"),
      size: 120,
      fill: defaultFill,
      state: "idle",
    });
    expect(Object.keys(direct).sort()).toEqual(Object.keys(engine).sort());
  });
});
