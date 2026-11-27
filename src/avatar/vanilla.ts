import {
  createAvatarActionRunner,
  type AvatarAction,
  type AvatarActionId,
  type AvatarActionRunner,
} from "./actions.js";
import {
  createMarkEngineForOptions,
  updateMarkEngine,
  type MarkEngine,
  type MarkEngineOptions,
} from "./markEngine.js";
import {
  createAvatarConfig,
  type AvatarConfig,
  type AvatarConfigInput,
} from "./presets.js";
import type { BotColor, BotShape, MarkState } from "./types.js";

const IDLE_SETTLE_MS = 1_400;
const HOST_CLASS = "blob-mark blob-mark--canvas";
const CANVAS_CLASS = "blob-mark__canvas";

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mountCounter = 0;

export interface MountAvatarOptions extends AvatarConfigInput {
  readonly ariaLabel?: string;
  /** Extra class names appended to the host element. */
  readonly className?: string;
}

export interface MountedBlobMark {
  /** Host element that was appended to the target. */
  readonly element: HTMLSpanElement;
  /** The underlying mark engine, for advanced control. */
  readonly engine: MarkEngine;
  readonly config: AvatarConfig;
  setState(state: MarkState): void;
  setShape(shape: BotShape): void;
  setColor(color: BotColor, colorHex?: string): void;
  /** Merges a partial config and re-applies it to the engine. */
  setConfig(patch: Partial<AvatarConfig>): void;
  /** Plays a named behaviour action, then returns to the resting state. */
  play(action: AvatarActionId | AvatarAction | string): void;
  stop(): void;
  poke(kind: "spin" | "bounce", turns?: number): void;
  blink(): void;
  look(direction: "left" | "right" | "up" | "down" | "center"): void;
  gaze(direction: readonly [number, number] | null): void;
  restart(): void;
  destroy(): void;
}

/**
 * Mounts a Blobmark avatar into any DOM element without React.
 *
 * ```ts
 * import { mountBlobMark } from "blobmark/vanilla";
 * import "blobmark/style.css";
 *
 * const mark = mountBlobMark("#stage", { preset: "ghost", size: 160 });
 * mark.play("greet");
 * ```
 */
export const mountBlobMark = (
  target: HTMLElement | string,
  input: MountAvatarOptions = {},
): MountedBlobMark => {
  if (typeof document === "undefined") {
    throw new Error(
      "mountBlobMark requires a DOM; render the React component on the server instead.",
    );
  }

  const host =
    typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (host === null) {
    throw new Error(`mountBlobMark: no element matches "${String(target)}".`);
  }

  let config = createAvatarConfig({
    reducedMotion: input.reducedMotion ?? prefersReducedMotion(),
    ...input,
  });
  const id = `motion-vanilla-${++mountCounter}`;
  const ariaLabel = (): string => input.ariaLabel ?? `Blobmark avatar, ${config.state}`;

  const element = document.createElement("span");
  element.className = [HOST_CLASS, input.className].filter(Boolean).join(" ");
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", ariaLabel());
  element.style.width = `${config.size}px`;
  element.style.height = `${config.size}px`;

  const canvas = document.createElement("span");
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  element.appendChild(canvas);
  host.appendChild(element);

  const engineOptions = (): MarkEngineOptions => ({
    id,
    shape: config.shape,
    color: config.color,
    colorHex: config.colorHex,
    state: config.state,
    size: config.size,
    paused: config.paused,
    followPointer: config.followPointer,
    reducedMotion: config.reducedMotion,
    maxFrameRate: config.maxFrameRate,
  });

  const engine = createMarkEngineForOptions(engineOptions());
  const detach = engine.attach({ host: element, canvas });

  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSettle = (): void => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const wake = (): void => {
    clearSettle();
    engine.setPlaying(!config.paused && !config.reducedMotion);
  };

  const scheduleSettle = (): void => {
    clearSettle();
    if (
      !config.settleIdle ||
      config.state !== "idle" ||
      config.paused ||
      config.reducedMotion
    ) {
      return;
    }
    settleTimer = setTimeout(() => {
      settleTimer = null;
      engine.setPlaying(false);
    }, IDLE_SETTLE_MS);
  };

  const applyConfig = (patch: Partial<AvatarConfig>): void => {
    config = { ...config, ...patch };
    engine.update(updateMarkEngine(engineOptions()));
    element.dataset.markState = config.state;
    element.setAttribute("aria-label", ariaLabel());
    element.style.width = `${config.size}px`;
    element.style.height = `${config.size}px`;
  };

  // Apply the resolved config once so the DOM reflects the preset (including
  // `data-mark-state`) before the first frame.
  applyConfig({});

  const runner: AvatarActionRunner = createAvatarActionRunner({
    getBaseState: () => config.state,
    setState: (next) => {
      applyConfig({ state: next });
    },
    onEffect: (effect) => {
      engine.poke(effect);
    },
    onStart: () => {
      wake();
    },
    onFinish: () => {
      wake();
      scheduleSettle();
    },
  });

  const handleClick = (): void => {
    wake();
    engine.poke("bounce");
    scheduleSettle();
  };

  element.addEventListener("click", handleClick);

  let destroyed = false;

  return {
    element,
    engine,
    get config() {
      return config;
    },
    setState(state) {
      runner.stop(false);
      applyConfig({ state });
      wake();
      scheduleSettle();
    },
    setShape(shape) {
      applyConfig({ shape });
    },
    setColor(color, colorHex) {
      applyConfig({ color, colorHex });
    },
    setConfig(patch) {
      applyConfig(patch);
      wake();
      scheduleSettle();
    },
    play(action) {
      runner.play(action);
    },
    stop() {
      runner.stop();
      scheduleSettle();
    },
    poke(kind, turns) {
      wake();
      engine.poke(kind, { turns });
      scheduleSettle();
    },
    blink() {
      engine.blink();
    },
    look(direction) {
      engine.look(direction);
    },
    gaze(direction) {
      engine.gaze(direction);
    },
    restart() {
      wake();
      engine.restart();
      scheduleSettle();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runner.dispose();
      clearSettle();
      engine.setPlaying(false);
      element.removeEventListener("click", handleClick);
      detach();
      element.remove();
    },
  };
};
