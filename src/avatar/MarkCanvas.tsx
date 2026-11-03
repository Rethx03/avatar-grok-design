import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import {
  createMarkEngineForOptions,
  updateMarkEngine,
  type MarkEngineOptions,
} from "./markEngine";
import type { GrokBotMarkHandle, GrokBotMarkProps } from "./GrokBotMark";

const IDLE_SETTLE_MS = 1_400;

export interface MarkCanvasProps
  extends Omit<GrokBotMarkProps, "onFrame" | "settleIdle"> {
  readonly settleIdle?: boolean;
  readonly ariaLabel?: string;
  readonly colorHex?: string;
}

const makeId = (rawId: string): string =>
  `motion-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

export const MarkCanvas = forwardRef<
  GrokBotMarkHandle,
  MarkCanvasProps
>(function MarkCanvas(
  {
    state,
    shape = "blob",
    color = "blue",
    colorHex,
    size = 240,
    paused = false,
    followPointer = true,
    settleIdle = true,
    maxFrameRate = 60,
    reducedMotion = false,
    className,
    ariaLabel,
  },
  forwardedRef,
) {
  const rawId = useId();
  const id = makeId(rawId);
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<ReturnType<typeof createMarkEngineForOptions> | null>(
    null,
  );
  const settleTimerRef = useRef<number | null>(null);
  const latestRef = useRef<MarkEngineOptions | null>(null);

  const currentOptions: MarkEngineOptions = {
    id,
    shape,
    color,
    colorHex,
    state,
    size,
    paused: paused || reducedMotion,
    followPointer,
    reducedMotion,
    maxFrameRate,
  };
  latestRef.current = currentOptions;

  if (engineRef.current === null) {
    engineRef.current = createMarkEngineForOptions(currentOptions);
  }

  const updateEngine = (): void => {
    engineRef.current?.update(updateMarkEngine(currentOptions));
  };

  const wake = (): void => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    const engine = engineRef.current;
    const options = latestRef.current;
    if (engine === null || options === null) return;
    engine.setPlaying(!options.paused);
  };

  const scheduleIdleSettle = (): void => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (!settleIdle || state !== "idle" || paused || reducedMotion) return;
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      engineRef.current?.setPlaying(false);
    }, IDLE_SETTLE_MS);
  };

  useImperativeHandle(
    forwardedRef,
    () => ({
      poke(kind, turns) {
        wake();
        engineRef.current?.poke(kind, { turns });
        scheduleIdleSettle();
      },
      restart() {
        wake();
        engineRef.current?.restart();
        scheduleIdleSettle();
      },
    }),
    // `wake` and `scheduleIdleSettle` intentionally read current refs.
    [paused, reducedMotion, settleIdle, state],
  );

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (host === null || canvas === null || engine === null) return;
    const detach = engine.attach({ host, canvas });
    return detach;
  }, []);

  useEffect(() => {
    updateEngine();
    wake();
    scheduleIdleSettle();
    // The engine receives primitives plus appearance/body objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    color,
    colorHex,
    followPointer,
    maxFrameRate,
    paused,
    reducedMotion,
    settleIdle,
    shape,
    size,
    state,
  ]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  return (
    <span
      aria-label={ariaLabel ?? `Grok Bot mark, ${state}`}
      className={["grok-bot-mark", "grok-bot-mark--canvas", className]
        .filter(Boolean)
        .join(" ")}
      data-grok-state={state}
      onClick={() => {
        wake();
        engineRef.current?.poke("bounce");
        scheduleIdleSettle();
      }}
      ref={hostRef}
      role="img"
      style={{ height: size, width: size }}
    >
      <span aria-hidden="true" className="grok-bot-mark__canvas" ref={canvasRef} />
    </span>
  );
});


