/**
 * React-free entry point.
 *
 * Use it for vanilla DOM mounting, for other frameworks, or to read the
 * catalogs and presets without pulling React into the bundle.
 *
 * ```ts
 * import { mountGrokBotMark, AVATAR_PRESETS } from "avatar-grok-design/vanilla";
 * import "avatar-grok-design/style.css";
 * ```
 */

// ---- Vanilla DOM mounting --------------------------------------------------
export { mountGrokBotMark } from "./avatar/vanilla.js";
export type {
  MountAvatarOptions,
  MountedGrokBotMark,
} from "./avatar/vanilla.js";

// ---- Presets and configuration --------------------------------------------
export {
  AVATAR_PRESETS,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_PRESET_ID,
  createAvatarConfig,
  listAvatarPresets,
  resolveAvatarPreset,
} from "./avatar/presets.js";
export type {
  AvatarConfig,
  AvatarConfigInput,
  AvatarPreset,
  AvatarPresetDefinition,
  AvatarPresetId,
} from "./avatar/presets.js";

// ---- Behaviour actions -----------------------------------------------------
export {
  AVATAR_ACTIONS,
  DEFAULT_ACTION_ID,
  DEFAULT_ACTION_STEP_MS,
  actionDurationMs,
  createAvatarActionRunner,
  listAvatarActions,
  resolveAvatarAction,
} from "./avatar/actions.js";
export type {
  AvatarAction,
  AvatarActionDefinition,
  AvatarActionEffect,
  AvatarActionId,
  AvatarActionRunner,
  AvatarActionRunnerOptions,
  AvatarActionStep,
} from "./avatar/actions.js";

// ---- State derivation ------------------------------------------------------
export {
  ACTIVITY_TO_STATE,
  SETTLEMENT_VISIBLE_MS,
  deriveMarkState,
  listMarkStates,
} from "./avatar/stateModel.js";

// ---- Catalogs and types ----------------------------------------------------
export { COLOR_OPTIONS, MARK_STATE_GROUPS, SHAPE_OPTIONS } from "./avatar/types.js";
export type {
  ActivityVerb,
  AgentFacts,
  BotColor,
  BotShape,
  Face,
  MarkState,
  MarkVisualState,
  Morph,
  TurnSettlement,
} from "./avatar/types.js";
export {
  MOTION_CLIPS,
  STANDARD_EASE,
  STATE_DEFINITIONS,
  clipProfile,
} from "./avatar/animationClips.js";
export type {
  Ease,
  MotionClip,
  StateDefinition,
} from "./avatar/animationClips.js";

// ---- Engine, motion, and geometry primitives ------------------------------
export {
  canonicalBody,
  createAppearance,
  createMarkEngine,
  defaultFill,
} from "./engine/mark-engine.js";
export type {
  MarkAppearance,
  MarkEngine,
  MarkEngineInput,
} from "./engine/mark-engine.js";
export {
  createMarkEngineForOptions,
  resolveColorHex,
  updateMarkEngine,
} from "./avatar/markEngine.js";
export type { MarkEngineOptions } from "./avatar/markEngine.js";
export { MarkMotionEngine } from "./avatar/motionEngine.js";
export type { MarkMotionInput } from "./avatar/motionEngine.js";
export { getShapeExtent, getShapeGeometry } from "./avatar/shapeGeometry.js";
export type { ShapeGeometry } from "./avatar/shapeGeometry.js";
export {
  LAB_FORMS,
  buildFormPath,
  getLabForm,
  sampleLabRadius,
} from "./avatar/lab/forms.js";
export type {
  LabForm,
  LabFormEngine,
  LabFormMetrics,
} from "./avatar/lab/forms.js";
