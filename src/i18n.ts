import {
  MARK_STATE_GROUPS,
  type BotColor,
  type BotShape,
  type Face,
  type MarkState,
  type Morph,
} from "./avatar/types";

export type Language = "en" | "zh";

type StateGroup = (typeof MARK_STATE_GROUPS)[number]["label"];

interface CopySet {
  readonly documentTitle: string;
  readonly svgProjection: string;
  readonly stateDriven: string;
  readonly markLabel: string;
  readonly language: {
    readonly label: string;
    readonly english: string;
    readonly chinese: string;
  };
  readonly liveComposite: string;
  readonly maxFrameRate: (rate: number) => string;
  readonly currentState: string;
  readonly clip: string;
  readonly poke: string;
  readonly stateLibrary: string;
  readonly stateCount: (count: number) => string;
  readonly bodyShape: string;
  readonly variantCount: (count: number) => string;
  readonly ink: string;
  readonly customColor: string;
  readonly runtime: string;
  readonly runtimeStatus: {
    readonly static: string;
    readonly paused: string;
    readonly playing: string;
  };
  readonly pauseMotion: string;
  readonly pauseMotionDescription: string;
  readonly followPointer: string;
  readonly followPointerDescription: string;
  readonly idleSleep: string;
  readonly idleSleepDescription: string;
  readonly frameCap: string;
  readonly frameCapDescription: string;
  readonly groups: Readonly<Record<StateGroup, string>>;
  readonly states: Readonly<Record<MarkState, string>>;
  readonly shapes: Readonly<Record<BotShape, string>>;
  readonly colors: Readonly<Record<BotColor, string>>;
  readonly faces: Readonly<Record<Face, string>>;
  readonly morphs: Readonly<Record<Morph, string>>;
}

const EN: CopySet = {
  documentTitle: "Grok Bot Motion Study",
  svgProjection: "SVG projection",
  stateDriven: "State-driven",
  markLabel: "Grok Bot mark",
  language: {
    label: "Language",
    english: "English",
    chinese: "Chinese",
  },
  liveComposite: "LIVE COMPOSITE",
  maxFrameRate: (rate) => `${rate} FPS MAX`,
  currentState: "CURRENT STATE",
  clip: "CLIP",
  poke: "Poke",
  stateLibrary: "STATE LIBRARY",
  stateCount: (count) => `${count} states`,
  bodyShape: "BODY SHAPE",
  variantCount: (count) => `${count} variants`,
  ink: "INK",
  customColor: "Custom color",
  runtime: "RUNTIME",
  runtimeStatus: {
    static: "static",
    paused: "paused",
    playing: "playing",
  },
  pauseMotion: "Pause motion",
  pauseMotionDescription: "Freeze the current pose.",
  followPointer: "Follow pointer",
  followPointerDescription: "Eyes track the pointer inside the stage.",
  idleSleep: "Idle sleep",
  idleSleepDescription: "Idle settles for 1.4 seconds, then freezes.",
  frameCap: "Frame cap",
  frameCapDescription: "Adaptive rendering target.",
  groups: {
    Lifecycle: "Lifecycle",
    Reactions: "Reactions",
    Morphs: "Morphs",
    Product: "Product",
    Brand: "Brand",
  },
  states: {
    idle: "Idle",
    listening: "Listening",
    thinking: "Thinking",
    streaming: "Streaming",
    searching: "Searching",
    reading: "Reading",
    working: "Working",
    coding: "Coding",
    running: "Running",
    computing: "Computing",
    controlling: "Controlling",
    waiting: "Waiting",
    blocked: "Blocked",
    finished: "Finished",
    failed: "Failed",
    sleeping: "Sleeping",
    waking: "Waking",
    happy: "Happy",
    excited: "Excited",
    laughing: "Laughing",
    proud: "Proud",
    curious: "Curious",
    playful: "Playful",
    shy: "Shy",
    surprised: "Surprised",
    suspicious: "Suspicious",
    angry: "Angry",
    confused: "Confused",
    sad: "Sad",
    drowsy: "Drowsy",
    bored: "Bored",
    scared: "Scared",
    celebrate: "Celebrate",
    approving: "Approving",
    orbit: "Orbit",
    radar: "Radar",
    progress: "Progress",
    spawning: "Spawning",
    loading: "Loading",
    dictating: "Dictating",
    sending: "Sending",
    receiving: "Receiving",
    uploading: "Uploading",
    writing: "Writing",
    alerting: "Alerting",
    bouncing: "Bouncing",
    "powering-down": "Powering Down",
    humming: "Humming",
    notifying: "Notifying",
    dragging: "Dragging",
    logo: "Logo",
    showcase: "Showcase",
    turntable: "Turntable",
  },
  shapes: {
    blob: "Blob",
    pebble: "Pebble",
    bean: "Bean",
    egg: "Egg",
    squircle: "Squircle",
    tablet: "Tablet",
    capsule: "Capsule",
    cylinder: "Cylinder",
    hex: "Hex",
    gem: "Gem",
    crystal: "Crystal",
    wedge: "Wedge",
    shield: "Shield",
    dome: "Dome",
    arch: "Arch",
    cloud: "Cloud",
    teardrop: "Teardrop",
    leaf: "Leaf",
    square: "Square",
    sparkle: "Sparkle",
    clover: "Clover",
    flower: "Flower",
    heart: "Heart",
    house: "House",
    star: "Star",
    pumpkin: "Pumpkin",
  },
  colors: {
    black: "Black",
    brown: "Brown",
    red: "Red",
    orange: "Orange",
    yellow: "Yellow",
    green: "Green",
    cyan: "Cyan",
    blue: "Blue",
    violet: "Violet",
    magenta: "Magenta",
    gray: "Gray",
  },
  faces: {
    neutral: "Neutral",
    happy: "Happy",
    calm: "Calm",
    sleepy: "Sleepy",
    surprised: "Surprised",
    inspecting: "Inspecting",
    squinted: "Squinted",
  },
  morphs: {
    thinking: "Thinking",
    orbit: "Orbit",
    radar: "Radar",
    progress: "Progress",
    spawning: "Spawning",
    dictating: "Dictating",
    sending: "Sending",
    receiving: "Receiving",
    uploading: "Uploading",
    writing: "Writing",
    alerting: "Alerting",
    bouncing: "Bouncing",
    "powering-down": "Powering Down",
  },
};

const ZH: CopySet = {
  documentTitle: "Grok Bot 动作研究",
  svgProjection: "SVG 投影",
  stateDriven: "状态驱动",
  markLabel: "Grok Bot 标志",
  language: {
    label: "语言",
    english: "英文",
    chinese: "中文",
  },
  liveComposite: "实时合成",
  maxFrameRate: (rate) => `最高 ${rate} FPS`,
  currentState: "当前状态",
  clip: "动画片段",
  poke: "戳一下",
  stateLibrary: "状态库",
  stateCount: (count) => `共 ${count} 个状态`,
  bodyShape: "身体形状",
  variantCount: (count) => `共 ${count} 种`,
  ink: "墨水",
  customColor: "自定义颜色",
  runtime: "运行时",
  runtimeStatus: {
    static: "静态",
    paused: "已暂停",
    playing: "播放中",
  },
  pauseMotion: "暂停动画",
  pauseMotionDescription: "冻结当前姿态。",
  followPointer: "跟随指针",
  followPointerDescription: "眼睛跟随舞台内的指针。",
  idleSleep: "空闲休眠",
  idleSleepDescription: "空闲 1.4 秒后稳定并暂停。",
  frameCap: "帧率上限",
  frameCapDescription: "自适应渲染目标。",
  groups: {
    Lifecycle: "生命周期",
    Reactions: "情绪反应",
    Morphs: "形态效果",
    Product: "产品行为",
    Brand: "品牌展示",
  },
  states: {
    idle: "空闲",
    listening: "聆听",
    thinking: "思考",
    streaming: "流式响应",
    searching: "搜索",
    reading: "阅读",
    working: "工作中",
    coding: "编程",
    running: "运行中",
    computing: "计算中",
    controlling: "控制中",
    waiting: "等待",
    blocked: "等待用户",
    finished: "完成",
    failed: "失败",
    sleeping: "睡眠",
    waking: "唤醒",
    happy: "开心",
    excited: "兴奋",
    laughing: "大笑",
    proud: "自豪",
    curious: "好奇",
    playful: "俏皮",
    shy: "害羞",
    surprised: "惊讶",
    suspicious: "怀疑",
    angry: "生气",
    confused: "困惑",
    sad: "难过",
    drowsy: "困倦",
    bored: "无聊",
    scared: "害怕",
    celebrate: "庆祝",
    approving: "认可",
    orbit: "环绕",
    radar: "雷达",
    progress: "进度",
    spawning: "生成中",
    loading: "加载中",
    dictating: "听写",
    sending: "发送",
    receiving: "接收",
    uploading: "上传",
    writing: "书写",
    alerting: "提示",
    bouncing: "弹跳",
    "powering-down": "关机",
    humming: "轻哼",
    notifying: "通知",
    dragging: "拖拽",
    logo: "标志",
    showcase: "展示",
    turntable: "转台",
  },
  shapes: {
    blob: "团块",
    pebble: "卵石",
    bean: "豆形",
    egg: "蛋形",
    squircle: "圆角方形",
    tablet: "药片形",
    capsule: "胶囊",
    cylinder: "圆柱",
    hex: "六边形",
    gem: "宝石",
    crystal: "水晶",
    wedge: "楔形",
    shield: "盾形",
    dome: "穹顶",
    arch: "拱形",
    cloud: "云朵",
    teardrop: "水滴",
    leaf: "叶片",
    square: "方形",
    sparkle: "闪光",
    clover: "四叶草",
    flower: "花朵",
    heart: "爱心",
    house: "小屋",
    star: "星星",
    pumpkin: "南瓜",
  },
  colors: {
    black: "黑色",
    brown: "棕色",
    red: "红色",
    orange: "橙色",
    yellow: "黄色",
    green: "绿色",
    cyan: "青色",
    blue: "蓝色",
    violet: "紫色",
    magenta: "洋红",
    gray: "灰色",
  },
  faces: {
    neutral: "中性",
    happy: "开心",
    calm: "平静",
    sleepy: "困倦",
    surprised: "惊讶",
    inspecting: "审视",
    squinted: "眯眼",
  },
  morphs: {
    thinking: "思考",
    orbit: "环绕",
    radar: "雷达",
    progress: "进度",
    spawning: "生成中",
    dictating: "听写",
    sending: "发送",
    receiving: "接收",
    uploading: "上传",
    writing: "书写",
    alerting: "提示",
    bouncing: "弹跳",
    "powering-down": "关机",
  },
};

export const COPY: Readonly<Record<Language, CopySet>> = {
  en: EN,
  zh: ZH,
};

export const LANGUAGE_STORAGE_KEY = "avatar-grok-design.language";

export function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "en" || saved === "zh") {
      return saved;
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  const browserLanguage = window.navigator.languages?.[0] ?? window.navigator.language;
  return /^zh(?:-|$)/i.test(browserLanguage) ? "zh" : "en";
}
