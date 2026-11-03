export const SHAPE_OPTIONS = [
  { id: "blob", label: "Blob" },
  { id: "pebble", label: "Pebble" },
  { id: "bean", label: "Bean" },
  { id: "egg", label: "Egg" },
  { id: "squircle", label: "Squircle" },
  { id: "tablet", label: "Tablet" },
  { id: "capsule", label: "Capsule" },
  { id: "cylinder", label: "Cylinder" },
  { id: "hex", label: "Hex" },
  { id: "gem", label: "Gem" },
  { id: "crystal", label: "Crystal" },
  { id: "wedge", label: "Wedge" },
  { id: "shield", label: "Shield" },
  { id: "dome", label: "Dome" },
  { id: "arch", label: "Arch" },
  { id: "cloud", label: "Cloud" },
  { id: "teardrop", label: "Teardrop" },
  { id: "leaf", label: "Leaf" },
  { id: "square", label: "Square" },
  { id: "sparkle", label: "Sparkle" },
  { id: "clover", label: "Clover" },
  { id: "flower", label: "Flower" },
  { id: "heart", label: "Heart" },
  { id: "house", label: "House" },
  { id: "star", label: "Star" },
  { id: "pumpkin", label: "Pumpkin" },
] as const;

export type BotShape = (typeof SHAPE_OPTIONS)[number]["id"];

export const COLOR_OPTIONS = [
  { id: "black", label: "Black", hex: "#000000" },
  { id: "brown", label: "Brown", hex: "#936439" },
  { id: "red", label: "Red", hex: "#ff263c" },
  { id: "orange", label: "Orange", hex: "#ff6700" },
  { id: "yellow", label: "Yellow", hex: "#ff9800" },
  { id: "green", label: "Green", hex: "#00c972" },
  { id: "cyan", label: "Cyan", hex: "#00bca6" },
  { id: "blue", label: "Blue", hex: "#1084fe" },
  { id: "violet", label: "Violet", hex: "#9159fe" },
  { id: "magenta", label: "Magenta", hex: "#ff309b" },
  { id: "gray", label: "Gray", hex: "#777777" },
] as const;

export type BotColor = (typeof COLOR_OPTIONS)[number]["id"];

export const MARK_STATE_GROUPS = [
  {
    label: "Lifecycle",
    states: [
      "idle",
      "listening",
      "thinking",
      "streaming",
      "searching",
      "reading",
      "working",
      "coding",
      "running",
      "computing",
      "controlling",
      "waiting",
      "blocked",
      "finished",
      "failed",
      "sleeping",
      "waking",
    ],
  },
  {
    label: "Reactions",
    states: [
      "happy",
      "excited",
      "laughing",
      "proud",
      "curious",
      "playful",
      "shy",
      "surprised",
      "suspicious",
      "angry",
      "confused",
      "sad",
      "drowsy",
      "bored",
      "scared",
      "celebrate",
      "approving",
    ],
  },
  {
    label: "Morphs",
    states: [
      "orbit",
      "radar",
      "progress",
      "spawning",
      "loading",
      "dictating",
      "sending",
      "receiving",
      "uploading",
      "writing",
      "alerting",
      "bouncing",
      "powering-down",
    ],
  },
  {
    label: "Product",
    states: ["humming", "notifying", "dragging"],
  },
  {
    label: "Brand",
    states: ["logo", "showcase", "turntable"],
  },
] as const;

export type MarkState = (typeof MARK_STATE_GROUPS)[number]["states"][number];

export type Face =
  | "neutral"
  | "happy"
  | "calm"
  | "sleepy"
  | "surprised"
  | "inspecting"
  | "squinted";

export type Morph =
  | "thinking"
  | "orbit"
  | "radar"
  | "progress"
  | "spawning"
  | "dictating"
  | "sending"
  | "receiving"
  | "uploading"
  | "writing"
  | "alerting"
  | "bouncing"
  | "powering-down";

export type ActivityVerb =
  | "thinking"
  | "searching"
  | "browsing"
  | "reading"
  | "connecting"
  | "writing"
  | "coding"
  | "generating"
  | "running-commands"
  | "on-its-computer"
  | "on-your-computer"
  | "working"
  | "messaging"
  | "sending"
  | "waiting";

export interface TurnSettlement {
  readonly outcome: "success" | "error" | "cancelled";
  readonly settledAtMs: number;
}

export interface AgentFacts {
  readonly isRunning?: boolean;
  readonly isComposingMessage?: boolean;
  readonly isStreaming?: boolean;
  readonly awaitingUserResponse?: boolean;
  readonly currentActivity?: { readonly verb: ActivityVerb } | null;
  readonly lastTurnSettlement?: TurnSettlement | null;
}

export interface MarkVisualState {
  readonly color: BotColor;
  readonly shape: BotShape;
  readonly previousShape?: BotShape | null;
  readonly shapeBlend: number;
  readonly state: MarkState;
  readonly face: Face;
  readonly previousFace: Face;
  readonly faceBlend: number;
  readonly morph: Morph | null;
  readonly morphAmount: number;
  readonly morphClock: number;
  readonly morphActive: boolean;
  readonly clip: string;
  readonly motionTime: number;
  readonly spin: number;
  readonly blink: number;
  readonly gazeX: number;
  readonly gazeY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly zoom: number;
  readonly isPaused: boolean;
}

