import type { MarkState } from "./types.js";

/** Imperative accent that can be attached to a step. */
export type AvatarActionEffect = "bounce" | "spin";

export interface AvatarActionStep {
  readonly state: MarkState;
  /** Time spent in this state before the next step starts. */
  readonly durationMs?: number;
  /** Optional poke applied when the step begins. */
  readonly effect?: AvatarActionEffect;
}

export interface AvatarActionDefinition {
  readonly label: string;
  readonly labelZh: string;
  readonly description: string;
  readonly descriptionZh: string;
  readonly steps: readonly AvatarActionStep[];
  /** State to return to when the action ends. Defaults to the state before it started. */
  readonly returnState?: MarkState;
}

export const DEFAULT_ACTION_STEP_MS = 900;

const step = (
  state: MarkState,
  durationMs: number,
  effect?: AvatarActionEffect,
): AvatarActionStep =>
  effect === undefined
    ? { state, durationMs }
    : { state, durationMs, effect };

/**
 * Ready-made behaviour actions.
 *
 * Each action is a short sequence of motion states with timing, which the
 * action runner (or the `useBlobMark` hook) plays back on top of the
 * regular agent-driven state.
 */
export const AVATAR_ACTIONS = {
  greet: {
    label: "Greet",
    labelZh: "打招呼",
    description: "A quick happy greeting followed by a nod.",
    descriptionZh: "开心地打招呼，然后点头示意。",
    steps: [step("happy", 900), step("approving", 700)],
  },
  nod: {
    label: "Nod",
    labelZh: "点头",
    description: "Approving nod with a small bounce.",
    descriptionZh: "带轻微弹跳的认可点头。",
    steps: [step("approving", 850, "bounce")],
  },
  celebrate: {
    label: "Celebrate",
    labelZh: "庆祝",
    description: "Bounce, spin, and land on a happy face.",
    descriptionZh: "弹跳旋转，最后露出开心表情。",
    steps: [
      step("celebrate", 1400, "bounce"),
      step("excited", 1000),
      step("happy", 700),
    ],
  },
  spin: {
    label: "Spin",
    labelZh: "旋转",
    description: "One playful spin around the vertical axis.",
    descriptionZh: "俏皮地绕竖轴旋转一圈。",
    steps: [step("playful", 1100, "spin")],
  },
  think: {
    label: "Think",
    labelZh: "思考",
    description: "Hold the thinking morph for a moment.",
    descriptionZh: "短暂停留在思考形态。",
    steps: [step("thinking", 2200)],
  },
  search: {
    label: "Search",
    labelZh: "搜索",
    description: "Radar search that settles into reading.",
    descriptionZh: "雷达搜索后进入阅读状态。",
    steps: [step("searching", 1500), step("reading", 1600)],
  },
  code: {
    label: "Code",
    labelZh: "写代码",
    description: "A focused coding burst.",
    descriptionZh: "专注写代码的短动作。",
    steps: [step("coding", 2400)],
  },
  success: {
    label: "Success",
    labelZh: "成功",
    description: "Finish, then react with a happy face.",
    descriptionZh: "完成动作，接着露出开心表情。",
    steps: [step("finished", 1400), step("happy", 900)],
  },
  failure: {
    label: "Failure",
    labelZh: "失败",
    description: "Show the failed state before calming down.",
    descriptionZh: "先显示失败状态，然后平静下来。",
    steps: [step("failed", 1500), step("sad", 1000)],
  },
  sleep: {
    label: "Sleep",
    labelZh: "入睡",
    description: "Drift off, then briefly wake up.",
    descriptionZh: "渐渐入睡，然后短暂醒来。",
    steps: [step("sleeping", 2800), step("waking", 900)],
  },
  wake: {
    label: "Wake",
    labelZh: "唤醒",
    description: "Wake up and greet the user.",
    descriptionZh: "醒过来并向用户问好。",
    steps: [step("waking", 900), step("happy", 700)],
  },
  alert: {
    label: "Alert",
    labelZh: "提醒",
    description: "Notification pulse with a surprised face.",
    descriptionZh: "通知脉冲，配惊讶表情。",
    steps: [step("alerting", 1100), step("surprised", 900)],
  },
  dance: {
    label: "Dance",
    labelZh: "跳舞",
    description: "A short brand showcase, then a playful beat.",
    descriptionZh: "短促的展示动作，再来一段俏皮节奏。",
    steps: [step("showcase", 2200), step("playful", 1200)],
  },
  listen: {
    label: "Listen",
    labelZh: "倾听",
    description: "Attentive listening pose.",
    descriptionZh: "专注倾听的姿态。",
    steps: [step("listening", 2400)],
  },
} as const satisfies Record<string, AvatarActionDefinition>;

export type AvatarActionId = keyof typeof AVATAR_ACTIONS;

export type AvatarAction = { readonly id: AvatarActionId } & AvatarActionDefinition;

export const DEFAULT_ACTION_ID: AvatarActionId = "greet";

const isActionId = (value: string): value is AvatarActionId =>
  Object.prototype.hasOwnProperty.call(AVATAR_ACTIONS, value);

/** Returns every action as an array, with its id included. */
export const listAvatarActions = (): AvatarAction[] =>
  (Object.keys(AVATAR_ACTIONS) as AvatarActionId[]).map((id) => ({
    id,
    ...AVATAR_ACTIONS[id],
  }));

/** Looks an action up by id; unknown ids fall back to the default action. */
export const resolveAvatarAction = (id: string): AvatarAction => {
  const resolved = isActionId(id) ? id : DEFAULT_ACTION_ID;
  return { id: resolved, ...AVATAR_ACTIONS[resolved] };
};

/** Total playback time of an action in milliseconds. */
export const actionDurationMs = (action: AvatarAction): number =>
  action.steps.reduce(
    (total, current) => total + (current.durationMs ?? DEFAULT_ACTION_STEP_MS),
    0,
  );

const toAction = (input: AvatarActionId | AvatarAction | string): AvatarAction =>
  typeof input === "string" ? resolveAvatarAction(input) : input;

export interface AvatarActionRunnerOptions {
  /** State the mark should return to when an action ends. */
  readonly getBaseState: () => MarkState;
  readonly setState: (state: MarkState) => void;
  /** Called for steps that ask for an imperative accent. */
  readonly onEffect?: (effect: AvatarActionEffect) => void;
  readonly onStart?: (action: AvatarAction) => void;
  readonly onFinish?: (action: AvatarAction) => void;
}

export interface AvatarActionRunner {
  /** Starts an action, cancelling any action already running. */
  play(action: AvatarActionId | AvatarAction | string): AvatarAction;
  /** Stops the active action; restores the base state unless told otherwise. */
  stop(restore?: boolean): void;
  readonly active: () => AvatarAction | null;
  readonly isPlaying: () => boolean;
  /** Clears timers without touching the mark state. */
  dispose(): void;
}

/**
 * Framework-agnostic scheduler for behaviour actions.
 *
 * It only depends on callbacks, so it works with React, Vue, Svelte, or plain
 * DOM code. The runner keeps the state that was active when the first action
 * started, which makes chained actions return to the right resting state.
 */
export const createAvatarActionRunner = (
  options: AvatarActionRunnerOptions,
): AvatarActionRunner => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let token = 0;
  let active: AvatarAction | null = null;
  let baseState: MarkState | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reset = (state: MarkState | null): void => {
    clearTimer();
    token += 1;
    active = null;
    baseState = null;
    if (state !== null) options.setState(state);
  };

  const runStep = (action: AvatarAction, index: number, runToken: number): void => {
    if (runToken !== token) return;
    const currentStep = action.steps[index];
    if (currentStep === undefined) {
      const returnState = action.returnState ?? baseState ?? options.getBaseState();
      reset(returnState);
      options.onFinish?.(action);
      return;
    }
    options.setState(currentStep.state);
    if (currentStep.effect !== undefined) options.onEffect?.(currentStep.effect);
    timer = setTimeout(() => {
      timer = null;
      runStep(action, index + 1, runToken);
    }, currentStep.durationMs ?? DEFAULT_ACTION_STEP_MS);
  };

  return {
    play(input) {
      const action = toAction(input);
      clearTimer();
      token += 1;
      if (baseState === null) baseState = options.getBaseState();
      active = action;
      options.onStart?.(action);
      runStep(action, 0, token);
      return action;
    },
    stop(restore = true) {
      if (active === null && timer === null) return;
      const fallback = restore ? (baseState ?? options.getBaseState()) : null;
      reset(fallback);
    },
    active: () => active,
    isPlaying: () => active !== null,
    dispose() {
      clearTimer();
      token += 1;
      active = null;
      baseState = null;
    },
  };
};
