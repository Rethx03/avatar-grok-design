import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import { STATE_DEFINITIONS } from "./avatar/animationClips";
import type { GrokBotMarkHandle } from "./avatar/GrokBotMark";
import { MarkCanvas } from "./avatar/MarkCanvas";
import type { BotColor, BotShape, MarkState } from "./avatar/types";
import {
  COLOR_OPTIONS,
  MARK_STATE_GROUPS,
  SHAPE_OPTIONS,
} from "./avatar/types";
import {
  COPY,
  getInitialLanguage,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "./i18n";

const ShapeGlyph = ({
  ariaLabel,
  colorHex,
  shape,
  color,
}: {
  readonly ariaLabel: string;
  readonly colorHex?: string;
  readonly shape: BotShape;
  readonly color: BotColor;
}) => (
  <MarkCanvas
    ariaLabel={ariaLabel}
    color={color}
    colorHex={colorHex}
    followPointer={false}
    paused
    reducedMotion
    settleIdle={false}
    shape={shape}
    size={44}
    state="idle"
  />
);

const initialPaused = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("paused") === "1";

const initialReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [state, setState] = useState<MarkState>("working");
  const [shape, setShape] = useState<BotShape>("blob");
  const [color, setColor] = useState<BotColor>("blue");
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [paused, setPaused] = useState(initialPaused);
  const [followPointer, setFollowPointer] = useState(true);
  const [settleIdle, setSettleIdle] = useState(true);
  const [maxFrameRate, setMaxFrameRate] = useState<30 | 60>(60);
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [activeGroup, setActiveGroup] = useState(0);
  const markRef = useRef<GrokBotMarkHandle>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (): void => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const copy = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = copy.documentTitle;

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The selected language still applies for the current session.
    }
  }, [copy.documentTitle, language]);

  const definition = STATE_DEFINITIONS[state];
  const paletteColorHex =
    COLOR_OPTIONS.find(({ id }) => id === color)?.hex ?? "#1084fe";
  const effectiveColorHex = customColor ?? paletteColorHex;
  const activeStates = MARK_STATE_GROUPS[activeGroup]?.states ?? MARK_STATE_GROUPS[0].states;
  const runtimeStatus = reducedMotion
    ? copy.runtimeStatus.static
    : paused
      ? copy.runtimeStatus.paused
      : copy.runtimeStatus.playing;

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div className="brand-lockup">
          <div>
            <h1>Grok Bot Mark</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-meta">
            <span>{copy.svgProjection}</span>
            <span className="dot" />
            <span>{copy.stateDriven}</span>
          </div>
          <div
            aria-label={copy.language.label}
            className="language-switch"
            role="group"
          >
            <button
              aria-label={copy.language.english}
              aria-pressed={language === "en"}
              className={language === "en" ? "active" : undefined}
              onClick={() => setLanguage("en")}
              type="button"
            >
              EN
            </button>
            <button
              aria-label={copy.language.chinese}
              aria-pressed={language === "zh"}
              className={language === "zh" ? "active" : undefined}
              onClick={() => setLanguage("zh")}
              type="button"
            >
              中文
            </button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="hero-column">
          <section className="stage-card">
            <div className="stage-noise" />
            <div className="stage-caption">
              <span className="live-dot" />
              {copy.liveComposite}
              <span>{copy.maxFrameRate(maxFrameRate)}</span>
            </div>
            <div className="stage-avatar">
              <MarkCanvas
                ariaLabel={`${copy.markLabel}: ${copy.states[state]}`}
                color={color}
                colorHex={customColor ?? undefined}
                followPointer={followPointer}
                maxFrameRate={maxFrameRate}
                paused={paused}
                reducedMotion={reducedMotion}
                ref={markRef}
                settleIdle={settleIdle}
                shape={shape}
                size={310}
                state={state}
              />
            </div>
            <div className="stage-footer">
              <div>
                <span className="micro-label">{copy.currentState}</span>
                <strong>{copy.states[state]}</strong>
              </div>
              <div>
                <span className="micro-label">{copy.clip}</span>
                <strong>{definition.clips[0]}</strong>
              </div>
              <button
                className="poke-button"
                onClick={() => markRef.current?.poke("bounce")}
                type="button"
              >
                {copy.poke}
              </button>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <span className="micro-label">{copy.runtime}</span>
              <span>{runtimeStatus}</span>
            </div>
            <label className="toggle-row">
              <span>
                <strong>{copy.pauseMotion}</strong>
                <small>{copy.pauseMotionDescription}</small>
              </span>
              <input
                checked={paused}
                onChange={(event) => setPaused(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>{copy.followPointer}</strong>
                <small>{copy.followPointerDescription}</small>
              </span>
              <input
                checked={followPointer}
                onChange={(event) => setFollowPointer(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>{copy.idleSleep}</strong>
                <small>{copy.idleSleepDescription}</small>
              </span>
              <input
                checked={settleIdle}
                onChange={(event) => setSettleIdle(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
            <div className="range-row">
              <span>
                <strong>{copy.frameCap}</strong>
                <small>{copy.frameCapDescription}</small>
              </span>
              <div className="segmented">
                <button
                  className={maxFrameRate === 30 ? "active" : undefined}
                  onClick={() => setMaxFrameRate(30)}
                  type="button"
                >
                  30
                </button>
                <button
                  className={maxFrameRate === 60 ? "active" : undefined}
                  onClick={() => setMaxFrameRate(60)}
                  type="button"
                >
                  60
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="control-column">
          <section className="panel">
            <div className="panel-heading">
              <span className="micro-label">{copy.stateLibrary}</span>
              <span>{copy.stateCount(activeStates.length)}</span>
            </div>
            <div className="tabs" role="tablist">
              {MARK_STATE_GROUPS.map((group, index) => (
                <button
                  aria-selected={activeGroup === index}
                  className={activeGroup === index ? "active" : undefined}
                  key={group.label}
                  onClick={() => setActiveGroup(index)}
                  role="tab"
                  type="button"
                >
                  {copy.groups[group.label]}
                </button>
              ))}
            </div>
            <div className="state-grid">
              {activeStates.map((candidate) => (
                <button
                  className={state === candidate ? "active" : undefined}
                  key={candidate}
                  onClick={() => setState(candidate)}
                  type="button"
                >
                  {copy.states[candidate]}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <span className="micro-label">{copy.bodyShape}</span>
              <span>{copy.variantCount(SHAPE_OPTIONS.length)}</span>
            </div>
            <div className="shape-grid">
              {SHAPE_OPTIONS.map((candidate) => (
                <button
                  aria-label={copy.shapes[candidate.id]}
                  aria-pressed={shape === candidate.id}
                  className={shape === candidate.id ? "active" : undefined}
                  key={candidate.id}
                  onClick={() => setShape(candidate.id)}
                  title={copy.shapes[candidate.id]}
                  type="button"
                >
                  <ShapeGlyph
                    ariaLabel={`${copy.markLabel}: ${copy.states.idle}`}
                    color={color}
                    colorHex={customColor ?? undefined}
                    shape={candidate.id}
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <span className="micro-label">{copy.ink}</span>
              <span>{customColor?.toUpperCase() ?? copy.colors[color]}</span>
            </div>
            <div className="palette">
              {COLOR_OPTIONS.map((candidate) => (
                <button
                  aria-label={copy.colors[candidate.id]}
                  aria-pressed={customColor === null && color === candidate.id}
                  className={
                    customColor === null && color === candidate.id
                      ? "active"
                      : undefined
                  }
                  key={candidate.id}
                  onClick={() => {
                    setColor(candidate.id);
                    setCustomColor(null);
                  }}
                  style={{ "--swatch": candidate.hex } as CSSProperties}
                  title={copy.colors[candidate.id]}
                  type="button"
                />
              ))}
              <label
                className={`color-picker${customColor ? " active" : ""}`}
                title={`${copy.customColor}: ${effectiveColorHex.toUpperCase()}`}
              >
                <span aria-hidden="true">+</span>
                <input
                  aria-label={copy.customColor}
                  onChange={(event) => setCustomColor(event.currentTarget.value)}
                  type="color"
                  value={effectiveColorHex}
                />
              </label>
            </div>
          </section>

        </aside>
      </section>

      <footer className="footer">
        <span>avatar-grok-design · v0.1</span>
      </footer>
    </main>
  );
}

