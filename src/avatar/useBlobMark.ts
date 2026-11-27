import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAvatarActionRunner,
  type AvatarAction,
  type AvatarActionId,
  type AvatarActionRunner,
} from "./actions.js";
import type { BlobMarkHandle } from "./SvgMark.js";
import type { MarkCanvasProps } from "./MarkCanvas.js";
import {
  createAvatarConfig,
  type AvatarConfig,
  type AvatarConfigInput,
} from "./presets.js";
import { deriveMarkState } from "./stateModel.js";
import type { AgentFacts, MarkState } from "./types.js";
import type { RefObject } from "react";

export interface UseBlobMarkOptions extends AvatarConfigInput {
  /**
   * Agent facts to derive the state from. When provided, the hook follows the
   * regular `deriveMarkState` rules instead of a fixed `state`.
   */
  readonly facts?: AgentFacts | null;
  /** Surface-level facts used when the roster facts are not available. */
  readonly surfaceFacts?: AgentFacts | null;
  /** How often derived state is recomputed, in milliseconds. Defaults to 1000. */
  readonly factsIntervalMs?: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export interface BlobMarkController {
  /** Attach to the mark: `<BlobMark {...avatar.props} ref={avatar.ref} />`. */
  readonly props: MarkCanvasProps;
  readonly ref: RefObject<BlobMarkHandle | null>;
  /** The resolved configuration, including the preset values. */
  readonly config: AvatarConfig;
  readonly state: MarkState;
  /** Manually overrides the state and cancels a running action. */
  readonly setState: (state: MarkState) => void;
  /** Plays a named action sequence, then returns to the resting state. */
  readonly play: (action: AvatarActionId | AvatarAction | string) => void;
  /** Cancels the running action and restores the resting state. */
  readonly stop: () => void;
  readonly activeAction: AvatarAction | null;
  readonly poke: (kind: "spin" | "bounce", turns?: number) => void;
  readonly restart: () => void;
}

const resolveInitialState = (input: UseBlobMarkOptions): MarkState =>
  createAvatarConfig(input).state;

/**
 * Manages the state, presets, and behaviour actions of one mark.
 *
 * ```tsx
 * const avatar = useBlobMark({ preset: "mint", facts: agentFacts });
 * return <BlobMark {...avatar.props} ref={avatar.ref} />;
 * ```
 *
 * State precedence, from strongest to weakest:
 * 1. a running behaviour action (it returns to the state below when done);
 * 2. the `facts`-derived state, when facts are provided;
 * 3. the `state` option, re-applied whenever it changes;
 * 4. the preset entrance state, or `idle`.
 */
export const useBlobMark = (
  options: UseBlobMarkOptions = {},
): BlobMarkController => {
  const {
    className,
    ariaLabel,
    facts,
    surfaceFacts,
    factsIntervalMs,
    ...configInput
  } = options;

  const config = useMemo(
    () => createAvatarConfig(configInput),
    // The config input is a flat bag of primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      configInput.preset,
      configInput.state,
      configInput.shape,
      configInput.color,
      configInput.colorHex,
      configInput.size,
      configInput.paused,
      configInput.followPointer,
      configInput.settleIdle,
      configInput.maxFrameRate,
      configInput.reducedMotion,
    ],
  );

  const [state, setState] = useState<MarkState>(() => resolveInitialState(options));
  const [activeAction, setActiveAction] = useState<AvatarAction | null>(null);
  const ref = useRef<BlobMarkHandle | null>(null);
  const stateRef = useRef(state);
  const actionRef = useRef<AvatarAction | null>(null);
  const factsRef = useRef(facts);
  const surfaceFactsRef = useRef(surfaceFacts);
  const runnerRef = useRef<AvatarActionRunner | null>(null);

  stateRef.current = state;
  factsRef.current = facts;
  surfaceFactsRef.current = surfaceFacts;

  if (runnerRef.current === null) {
    runnerRef.current = createAvatarActionRunner({
      getBaseState: () => stateRef.current,
      setState: (next) => {
        stateRef.current = next;
        setState(next);
      },
      onEffect: (effect) => {
        ref.current?.poke(effect);
      },
      onStart: (action) => {
        actionRef.current = action;
        setActiveAction(action);
      },
      onFinish: () => {
        actionRef.current = null;
        setActiveAction(null);
      },
    });
  }

  useEffect(
    () => () => {
      runnerRef.current?.dispose();
    },
    [],
  );

  const cancelActiveAction = useCallback(() => {
    runnerRef.current?.stop(false);
    actionRef.current = null;
    setActiveAction(null);
  }, []);

  const setStateManually = useCallback(
    (next: MarkState) => {
      cancelActiveAction();
      stateRef.current = next;
      setState(next);
    },
    [cancelActiveAction],
  );

  const play = useCallback((action: AvatarActionId | AvatarAction | string) => {
    runnerRef.current?.play(action);
  }, []);

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    actionRef.current = null;
    setActiveAction(null);
  }, []);

  const poke = useCallback((kind: "spin" | "bounce", turns?: number) => {
    ref.current?.poke(kind, turns);
  }, []);

  const restart = useCallback(() => {
    ref.current?.restart();
  }, []);

  const hasFacts = facts !== undefined || surfaceFacts !== undefined;
  const explicitState = options.state;

  // Keep the hook usable as a controlled state manager: a changed `state`
  // option is applied and cancels any action that was running.
  useEffect(() => {
    if (explicitState === undefined) return;
    cancelActiveAction();
    stateRef.current = explicitState;
    setState(explicitState);
  }, [cancelActiveAction, explicitState]);

  const derive = useCallback(() => {
    if (actionRef.current !== null) return;
    const next = deriveMarkState(
      factsRef.current,
      Date.now(),
      surfaceFactsRef.current ?? null,
    );
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (hasFacts) derive();
  }, [derive, facts, surfaceFacts, hasFacts]);

  useEffect(() => {
    if (!hasFacts) return;
    const interval = Math.max(250, factsIntervalMs ?? 1000);
    const timer = setInterval(derive, interval);
    return () => clearInterval(timer);
  }, [derive, factsIntervalMs, hasFacts]);

  const props = useMemo<MarkCanvasProps>(
    () => ({ ...config, state, className, ariaLabel }),
    [ariaLabel, className, config, state],
  );

  return {
    props,
    ref,
    config,
    state,
    setState: setStateManually,
    play,
    stop,
    activeAction,
    poke,
    restart,
  };
};
