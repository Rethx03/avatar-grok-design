/**
 * Public API of the Grok Bot mark package.
 *
 * The React entry point re-exports everything here, plus the presets, hooks,
 * and behaviour actions that live next to this file.
 */

// ---- React components -------------------------------------------------------
export { MarkCanvas, MarkCanvas as GrokBotMark } from "./MarkCanvas.js";
export type { MarkCanvasProps } from "./MarkCanvas.js";
export {
  GrokBotMark as SvgGrokBotMark,
  GrokBotMark as BehavioralGrokBotMark,
  GrokBotMark as ApproximateGrokBotMark,
} from "./GrokBotMark.js";
export type { GrokBotMarkHandle, GrokBotMarkProps } from "./GrokBotMark.js";

// ---- React hook ------------------------------------------------------------
export { useGrokBotAvatar } from "./useGrokBotAvatar.js";
export type {
  GrokBotAvatarController,
  UseGrokBotAvatarOptions,
} from "./useGrokBotAvatar.js";

// ---- Presets and configuration --------------------------------------------
export {
  AVATAR_PRESETS,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_PRESET_ID,
  createAvatarConfig,
  listAvatarPresets,
  resolveAvatarPreset,
} from "./presets.js";
export type {
  AvatarConfig,
  AvatarConfigInput,
  AvatarPreset,
  AvatarPresetDefinition,
  AvatarPresetId,
} from "./presets.js";

// ---- Behaviour actions -----------------------------------------------------
export {
  AVATAR_ACTIONS,
  DEFAULT_ACTION_ID,
  DEFAULT_ACTION_STEP_MS,
  actionDurationMs,
  createAvatarActionRunner,
  listAvatarActions,
  resolveAvatarAction,
} from "./actions.js";
export type {
  AvatarAction,
  AvatarActionDefinition,
  AvatarActionEffect,
  AvatarActionId,
  AvatarActionRunner,
  AvatarActionRunnerOptions,
  AvatarActionStep,
} from "./actions.js";

// ---- Vanilla DOM mounting --------------------------------------------------
export { mountGrokBotMark } from "./vanilla.js";
export type { MountAvatarOptions, MountedGrokBotMark } from "./vanilla.js";

// ---- State derivation ------------------------------------------------------
export {
  ACTIVITY_TO_STATE,
  SETTLEMENT_VISIBLE_MS,
  deriveMarkState,
  listMarkStates,
} from "./stateModel.js";

// ---- Catalogs and types ----------------------------------------------------
export { COLOR_OPTIONS, MARK_STATE_GROUPS, SHAPE_OPTIONS } from "./types.js";
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
} from "./types.js";
export {
  MOTION_CLIPS,
  STANDARD_EASE,
  STATE_DEFINITIONS,
  clipProfile,
} from "./animationClips.js";
export type {
  Ease,
  MotionClip,
  StateDefinition,
} from "./animationClips.js";

// ---- Engine and geometry primitives ---------------------------------------
export {
  canonicalBody,
  createAppearance,
  createMarkEngine,
  defaultFill,
} from "../engine/mark-engine.js";
export type {
  MarkAppearance,
  MarkEngine,
  MarkEngineInput,
} from "../engine/mark-engine.js";
export {
  createMarkEngineForOptions,
  resolveColorHex,
  updateMarkEngine,
} from "./markEngine.js";
export type { MarkEngineOptions } from "./markEngine.js";
export { MarkMotionEngine } from "./motionEngine.js";
export type { MarkMotionInput } from "./motionEngine.js";
export { getShapeExtent, getShapeGeometry } from "./shapeGeometry.js";
export type { ShapeGeometry } from "./shapeGeometry.js";
export {
  LAB_FORMS,
  buildFormPath,
  getLabForm,
  sampleLabRadius,
} from "./lab/forms.js";
export type {
  LabForm,
  LabFormEngine,
  LabFormMetrics,
} from "./lab/forms.js";
