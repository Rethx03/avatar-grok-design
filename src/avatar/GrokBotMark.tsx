import {
  forwardRef,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { MarkMotionEngine } from "./motionEngine";
import { getShapeGeometry, getShapeExtent } from "./shapeGeometry";
import type {
  BotColor,
  BotShape,
  MarkState,
  MarkVisualState,
} from "./types";
import { COLOR_OPTIONS } from "./types";

const VIEWBOX = 120;
const TAU = Math.PI * 2;

const colorHex = (color: BotColor): string =>
  COLOR_OPTIONS.find(({ id }) => id === color)?.hex ?? "#1687ff";

const clampByte = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const mixHex = (hex: string, target: [number, number, number], amount: number): string => {
  const source = hexToRgb(hex);
  const mixed = source.map((channel, index) =>
    clampByte(channel + (target[index]! - channel) * amount),
  );
  return `rgb(${mixed.join(" ")})`;
};

const lighten = (hex: string, amount: number): string =>
  mixHex(hex, [255, 255, 255], amount);

const darken = (hex: string, amount: number): string =>
  mixHex(hex, [8, 10, 16], amount);

const normalizedPointer = (
  element: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } => {
  const rect = element.getBoundingClientRect();
  const reach = Math.max(rect.width, rect.height, 1) * 0.5;
  return {
    x: Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / reach)),
    y: Math.max(-1, Math.min(1, -(clientY - (rect.top + rect.height / 2)) / reach)),
  };
};

export interface GrokBotMarkProps {
  readonly state: MarkState;
  readonly shape?: BotShape;
  readonly color?: BotColor;
  readonly size?: number;
  readonly paused?: boolean;
  readonly followPointer?: boolean;
  readonly settleIdle?: boolean;
  readonly maxFrameRate?: 30 | 60;
  readonly reducedMotion?: boolean;
  readonly className?: string;
  readonly onFrame?: (frame: MarkVisualState) => void;
}

export interface GrokBotMarkHandle {
  poke(kind: "spin" | "bounce", turns?: number): void;
  restart(): void;
}

const EyeLayer = ({
  frame,
  eyeColor,
  radius,
  eyeGap,
  eyeY,
}: {
  readonly frame: MarkVisualState;
  readonly eyeColor: string;
  readonly radius: number;
  readonly eyeGap: number;
  readonly eyeY: number;
}) => {
  const turn = Math.cos(frame.rotationY);
  const gap = eyeGap * Math.max(0.56, Math.abs(turn));
  const lookX = frame.gazeX * 2.4;
  const lookY = frame.gazeY * 1.8;
  const blinkScale = Math.max(0.06, 1 - frame.blink);
  const faceScale =
    frame.face === "surprised"
      ? 1.2
      : frame.face === "squinted"
        ? 0.62
        : frame.face === "sleepy"
          ? 0.52
          : frame.face === "calm"
            ? 0.82
            : frame.face === "happy"
              ? 0.76
              : 1;
  const highlightOffsetX = frame.gazeX * 0.6 + 1.2;
  const highlightOffsetY = frame.gazeY * 0.4 - 2;
  const eyeWidth = radius * 0.15;
  const eyeHeight = radius * 0.28 * faceScale * blinkScale;

  if (frame.face === "happy" && frame.blink < 0.4) {
    return (
      <g fill="none" stroke={eyeColor} strokeLinecap="round" strokeWidth={radius * 0.055}>
        <path d={`M${-gap - eyeWidth / 2} ${eyeY + lookY} Q${-gap} ${eyeY - radius * 0.09 + lookY} ${-gap + eyeWidth / 2} ${eyeY + lookY}`} />
        <path d={`M${gap - eyeWidth / 2} ${eyeY + lookY} Q${gap} ${eyeY - radius * 0.09 + lookY} ${gap + eyeWidth / 2} ${eyeY + lookY}`} />
      </g>
    );
  }

  return (
    <g fill={eyeColor}>
      {[-1, 1].map((side) => {
        const cx = side * gap + lookX;
        const cy = eyeY + lookY;
        return (
          <g key={side}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={eyeWidth / 2}
              ry={Math.max(0.8, eyeHeight / 2)}
            />
            {frame.face !== "sleepy" && frame.face !== "squinted" && frame.blink < 0.55 ? (
              <circle
                cx={cx + highlightOffsetX}
                cy={cy + highlightOffsetY}
                fill="rgba(255,255,255,.82)"
                r={radius * 0.034}
              />
            ) : null}
          </g>
        );
      })}
      {frame.face === "sleepy" || frame.face === "calm" ? (
        <g stroke={eyeColor} strokeLinecap="round" strokeWidth={radius * 0.045}>
          <path d={`M${-gap - eyeWidth / 2} ${eyeY - eyeHeight * 0.1} h${eyeWidth}`} />
          <path d={`M${gap - eyeWidth / 2} ${eyeY - eyeHeight * 0.1} h${eyeWidth}`} />
        </g>
      ) : null}
    </g>
  );
};

const MorphLayer = ({
  frame,
  color,
  radius,
}: {
  readonly frame: MarkVisualState;
  readonly color: string;
  readonly radius: number;
}) => {
  const phase = frame.motionTime;
  const ringRadius = radius + 9;
  const soft = lighten(color, 0.18);
  const faint = lighten(color, 0.45);

  switch (frame.morph) {
    case "thinking":
      return (
        <g fill={faint}>
          {[0, 1, 2].map((index) => {
            const wave = 0.45 + 0.55 * ((Math.sin(phase * 4 - index * 0.8) + 1) / 2);
            return (
              <circle
                key={index}
                cx={-7 + index * 7}
                cy={-radius - 7 - wave * 3}
                opacity={wave}
                r={1.8}
              />
            );
          })}
        </g>
      );
    case "orbit":
      return (
        <g fill="none" stroke={soft}>
          <ellipse cx="0" cy="0" opacity="0.2" rx={ringRadius + 2} ry={ringRadius * 0.43} />
          {[0, 1, 2].map((index) => {
            const angle = phase * 1.25 + (index / 3) * TAU;
            const x = Math.cos(angle) * (ringRadius + 2);
            const y = Math.sin(angle) * (ringRadius * 0.43);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                fill={index === 0 ? faint : soft}
                opacity={index === 0 ? 1 : 0.7}
                r={index === 0 ? 2.4 : 1.5}
                stroke="none"
              />
            );
          })}
        </g>
      );
    case "radar": {
      const sweep = (phase * 1.35) % TAU;
      return (
        <g transform="translate(0 -1)">
          <circle cx="0" cy="0" fill="none" opacity="0.18" r={ringRadius} stroke={soft} />
          <circle cx="0" cy="0" fill="none" opacity="0.1" r={ringRadius * 0.7} stroke={soft} />
          <line
            stroke={faint}
            strokeLinecap="round"
            strokeWidth="2"
            x1="0"
            x2={Math.cos(sweep) * ringRadius}
            y1="0"
            y2={Math.sin(sweep) * ringRadius}
          />
          <circle
            cx={Math.cos(sweep - 0.28) * ringRadius * 0.75}
            cy={Math.sin(sweep - 0.28) * ringRadius * 0.75}
            fill={faint}
            r="2"
          />
        </g>
      );
    }
    case "progress": {
      const circumference = TAU * ringRadius;
      const dash = ((phase * 0.63) % 1) * circumference;
      return (
        <circle
          cx="0"
          cy="0"
          fill="none"
          r={ringRadius}
          stroke={soft}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="2"
          transform="rotate(-90)"
        />
      );
    }
    case "spawning": {
      const pulse = (phase * 0.82) % 1;
      return (
        <g fill="none" stroke={faint}>
          <circle cx="0" cy="0" opacity={1 - pulse} r={radius + pulse * 18} strokeWidth="1.5" />
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * TAU;
            const reach = radius + 6 + pulse * 12;
            return (
              <circle
                key={index}
                cx={Math.cos(angle) * reach}
                cy={Math.sin(angle) * reach}
                fill={faint}
                opacity={0.8 - pulse * 0.7}
                r="1.5"
                stroke="none"
              />
            );
          })}
        </g>
      );
    }
    case "sending":
    case "receiving":
    case "uploading":
    case "dictating":
      return (
        <g fill={faint}>
          {Array.from({ length: 5 }, (_, index) => {
            const travel = ((phase * 0.85 + index / 5) % 1) * 18;
            const direction = frame.morph === "receiving" ? -1 : 1;
            const isVertical =
              frame.morph === "uploading" || frame.morph === "dictating";
            const x = isVertical ? (index - 2) * 4 : direction * (radius + 7 + travel);
            const y = isVertical ? -radius - 7 - travel : (index - 2) * 3;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                opacity={1 - travel / 25}
                r={1.6}
              />
            );
          })}
        </g>
      );
    case "writing":
      return (
        <path
          d={`M${-18} ${-radius - 6} Q${-8} ${-radius - 12} 0 ${-radius - 6} T${18} ${-radius - 6}`}
          fill="none"
          opacity="0.85"
          stroke={faint}
          strokeDasharray={`${Math.max(3, ((phase * 20) % 36) + 2)} 40`}
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      );
    case "alerting": {
      const pulse = (phase * 1.4) % 1;
      return (
        <g fill="none" stroke={faint}>
          <circle cx="0" cy="0" opacity={1 - pulse} r={radius + pulse * 12} strokeWidth="1.4" />
          <circle cx="0" cy="0" opacity={0.45 - pulse * 0.4} r={radius + 6 + pulse * 12} strokeWidth="1" />
        </g>
      );
    }
    case "bouncing":
      return (
        <g fill="none" stroke={faint} strokeLinecap="round">
          <path d={`M${-radius - 3} 8 q${radius * 0.35} 10 ${radius * 0.75} 0`} opacity="0.3" />
          <path d={`M${-radius - 1} -11 q${radius * 0.33} -8 ${radius * 0.7} 0`} opacity="0.2" />
        </g>
      );
    case "powering-down": {
      const amount = (Math.sin(phase * 1.4) + 1) / 2;
      return (
        <g fill="none" stroke={faint}>
          <circle cx="0" cy="0" opacity={0.25 + amount * 0.45} r={ringRadius} strokeDasharray="2 7" />
          <path d={`M0 ${-ringRadius - 7} v8`} strokeLinecap="round" strokeWidth="2" />
        </g>
      );
    }
    default:
      return null;
  }
};

const MarkSvg = ({
  frame,
  size,
}: {
  readonly frame: MarkVisualState;
  readonly size: number;
}) => {
  const rawId = useId().replaceAll(":", "");
  const radius = 34;
  const geometry = useMemo(() => getShapeGeometry(frame.shape, radius), [frame.shape]);
  const extent = getShapeExtent(frame.shape, radius);
  const base = colorHex(frame.color);
  const isDark = frame.color === "black" || frame.color === "gray";
  const eyeColor = isDark ? "rgba(255,255,255,.9)" : "rgba(12,15,23,.92)";
  const turnScale = 0.86 + Math.max(0, Math.cos(frame.rotationY)) * 0.14;
  const turnShift = Math.sin(frame.rotationY) * radius * 0.055;
  const bodyTransform = [
    `translate(${VIEWBOX / 2 + frame.offsetX + turnShift} ${VIEWBOX / 2 + frame.offsetY})`,
    `rotate(${frame.rotationZ})`,
    `scale(${frame.scaleX * turnScale} ${frame.scaleY})`,
  ].join(" ");
  const highlightX = -radius * 0.3 + Math.sin(frame.rotationY) * -3;
  const highlightY = -radius * 0.35;

  return (
    <svg
      aria-label={`Grok Bot mark, ${frame.state}`}
      className="mark-svg"
      height={size}
      role="img"
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
    >
      <defs>
        <radialGradient id={`${rawId}-body`} cx="32%" cy="23%" r="78%">
          <stop offset="0%" stopColor={lighten(base, 0.44)} />
          <stop offset="38%" stopColor={lighten(base, 0.12)} />
          <stop offset="78%" stopColor={base} />
          <stop offset="100%" stopColor={darken(base, 0.28)} />
        </radialGradient>
        <linearGradient id={`${rawId}-rim`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={lighten(base, 0.62)} stopOpacity="0.68" />
          <stop offset="42%" stopColor={base} stopOpacity="0" />
          <stop offset="100%" stopColor={darken(base, 0.5)} stopOpacity="0.34" />
        </linearGradient>
        <filter id={`${rawId}-glow`} height="170%" width="170%" x="-35%" y="-35%">
          <feGaussianBlur result="blur" stdDeviation="4.5" />
          <feColorMatrix
            in="blur"
            result="color"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 .34 0"
          />
          <feMerge>
            <feMergeNode in="color" />
          </feMerge>
        </filter>
        <radialGradient id={`${rawId}-shadow`}>
          <stop offset="0%" stopColor="#000" stopOpacity=".42" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        cx={VIEWBOX / 2}
        cy={VIEWBOX / 2 + radius + 8}
        fill={`url(#${rawId}-shadow)`}
        rx={extent * 0.8}
        ry={extent * 0.18}
      />
      <ellipse
        cx={VIEWBOX / 2}
        cy={VIEWBOX / 2}
        fill={base}
        filter={`url(#${rawId}-glow)`}
        opacity=".18"
        rx={extent * 0.98}
        ry={extent * 0.92}
      />
      <g transform={`translate(${VIEWBOX / 2} ${VIEWBOX / 2})`}>
        <MorphLayer color={base} frame={frame} radius={radius} />
      </g>

      <g transform={bodyTransform}>
        <path
          d={geometry.bodyPath}
          fill={`url(#${rawId}-body)`}
          stroke={`url(#${rawId}-rim)`}
          strokeWidth="1.2"
        />
        {geometry.stemPath === null ? null : (
          <path
            d={geometry.stemPath}
            fill="none"
            stroke={darken(base, 0.68)}
            strokeLinecap="round"
            strokeWidth={radius * 0.12}
          />
        )}
        <ellipse
          cx={highlightX}
          cy={highlightY}
          fill="rgba(255,255,255,.2)"
          opacity=".72"
          rx={radius * 0.21}
          ry={radius * 0.12}
          transform={`rotate(-24 ${highlightX} ${highlightY})`}
        />
        <EyeLayer
          eyeColor={eyeColor}
          eyeGap={geometry.metrics.eyeGap * radius}
          eyeY={geometry.metrics.eyeY * radius + geometry.metrics.shiftY * radius * 0.2}
          frame={frame}
          radius={radius}
        />
      </g>
    </svg>
  );
};

export const GrokBotMark = forwardRef<GrokBotMarkHandle, GrokBotMarkProps>(
  function GrokBotMark(
    {
      state,
      shape = "blob",
      color = "blue",
      size = 240,
      paused = false,
      followPointer = true,
      settleIdle = true,
      maxFrameRate = 60,
      reducedMotion = false,
      className,
      onFrame,
    },
    forwardedRef,
  ) {
    const hostRef = useRef<HTMLSpanElement>(null);
    const engineRef = useRef<MarkMotionEngine | null>(null);
    const frameListenerRef = useRef(onFrame);
    const [frame, setFrame] = useState<MarkVisualState | null>(null);

    frameListenerRef.current = onFrame;

    if (engineRef.current === null) {
      engineRef.current = new MarkMotionEngine(
        {
          color,
          shape,
          state,
          paused: paused || reducedMotion,
          compact: size < 48,
          settleIdle,
        },
        `${shape}:${color}:${size}`,
      );
      if (reducedMotion) {
        for (let index = 0; index < 60; index += 1) engineRef.current.advance(0.1);
      }
    }

    useImperativeHandle(
      forwardedRef,
      () => ({
        poke(kind, turns) {
          engineRef.current?.poke(kind, turns);
        },
        restart() {
          const engine = engineRef.current;
          if (engine === null) return;
          engine.setInputs({
            color,
            shape,
            state,
            paused: paused || reducedMotion,
            compact: size < 48,
            settleIdle,
          });
        },
      }),
      [color, paused, reducedMotion, settleIdle, shape, size, state],
    );

    useEffect(() => {
      engineRef.current?.setInputs({
        color,
        shape,
        state,
        paused: paused || reducedMotion,
        compact: size < 48,
        settleIdle,
      });
    }, [color, paused, reducedMotion, settleIdle, shape, size, state]);

    useEffect(() => {
      let animationFrame = 0;
      let last = performance.now();
      let visible = true;
      let lastPublish = 0;
      const frameDuration = 1000 / maxFrameRate;

      if (paused || reducedMotion) {
        setFrame(engineRef.current?.frame() ?? null);
        return;
      }

      const tick = (now: number): void => {
        const engine = engineRef.current;
        if (engine === null) return;
        const delta = Math.min(0.1, (now - last) / 1000);
        last = now;

        if (
          visible &&
          document.visibilityState !== "hidden" &&
          now - lastPublish >= frameDuration
        ) {
          engine.advance(delta);
          const nextFrame = engine.frame();
          lastPublish = now;
          setFrame(nextFrame);
          frameListenerRef.current?.(nextFrame);
        }

        animationFrame = requestAnimationFrame(tick);
      };

      let observer: IntersectionObserver | null = null;
      if (hostRef.current !== null && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver((entries) => {
          visible = entries.at(-1)?.isIntersecting ?? true;
        });
        observer.observe(hostRef.current);
      }

      animationFrame = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(animationFrame);
        observer?.disconnect();
      };
    }, [maxFrameRate, paused, reducedMotion]);

    const handlePointerMove = (event: ReactPointerEvent<HTMLSpanElement>): void => {
      if (!followPointer || hostRef.current === null) return;
      const gaze = normalizedPointer(hostRef.current, event.clientX, event.clientY);
      engineRef.current?.setGaze(gaze.x, gaze.y, true);
    };

    const handlePointerLeave = (): void => {
      engineRef.current?.releaseGaze();
    };

    const handleClick = (): void => {
      engineRef.current?.poke("bounce");
    };

    return (
      <span
        className={["grok-bot-mark", className].filter(Boolean).join(" ")}
        data-grok-state={state}
        data-paused={frame?.isPaused === true ? "true" : undefined}
        onClick={handleClick}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        ref={hostRef}
        style={{ height: size, width: size }}
      >
        <MarkSvg
          frame={
            frame ?? {
              color,
              shape,
              state,
              face: "neutral",
              morph: null,
              clip: "Idle_B",
              motionTime: 0,
              spin: 0,
              blink: 0,
              gazeX: 0,
              gazeY: 0,
              offsetX: 0,
              offsetY: 0,
              rotationX: 0,
              rotationY: 0,
              rotationZ: 0,
              scaleX: 1,
              scaleY: 1,
              isPaused: paused || reducedMotion,
            }
          }
          size={size}
        />
      </span>
    );
  },
);

