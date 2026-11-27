# Grok Bot Mark 动画引擎研究笔记

> 行号说明：文中 `mark-engine.js:NNNN` 的行号以当前工作区文件为准。
> 图形与动作的具体算法见 [animation-engine-internals.zh-CN.md](animation-engine-internals.zh-CN.md)。

本文是对本项目动画相关代码的实证分析，结论均来自源码（含行号）与 Git 历史，
不依赖 README 的自我描述。研究时间：2026-11-27。

---

## 0. 一页结论

1. **项目里有两套动画引擎，真正在页面上跑的是 `src/engine/mark-engine.js` 那一套。**
   - 实际渲染：`App.tsx` → `MarkCanvas.tsx` → `markEngine.ts` → `src/engine/mark-engine.js`
     （289.9 KB / 10,561 行 / gzip 78.5 KB，压缩打包产物风格，数据占约 32%）。
   - 另一套是可读的"行为重建"：`motionEngine.ts` + `reconstruction/*`，导出为
     `BehavioralGrokBotMark` / `ApproximateGrokBotMark`，**App 没有使用它**，只有测试引用。
2. **引擎是数据驱动的**：37 个动作片段（clip）、59 个符号状态、28 种身体、9 种眼型、
   13 种 morph 装饰、3 种 poke（其中 9 片段 / 6 状态 / 2 身体是 lab 扩展）。
   状态表与片段名和可读重建版基本一致（lab 新增项除外），但片段的
   关键帧/时长是原始数据，重建版是"另写的一版近似"。
3. **运动核心 = 关键帧采样 + 桥接过渡 + 弹簧 + 视线阻尼 + 表情状态机 + 姿态合成**；
   渲染层把 pose 投影成 SVG 树，并用 WeakMap 做"结构不变则只写变化属性"的差分。
4. **两处容易看错的性能设计**：眼睛/身体轮廓按"量化后的 yaw/pitch/roll + 精灵分辨率"
   缓存（身体缓存按点数预算淘汰，眼睛缓存上限 256 条）；旋转量化步长随显示尺寸取 2 的幂。
5. **文档与实现有偏差**：`docs/mark-engine.zh-CN.md` 写的桥接时长 0.28 s 属于重建版，
   真实引擎是 0.35 s；`size` 尺寸监听只在 size 不是数字时才会挂 ResizeObserver。
6. **可读重建版存在一个真实缺陷**：`progress`/`spawning` 的 morph 在第一次 1.5 s 暂停后
   会被"立刻再次暂停"，视觉时钟基本冻结（见 §8.3）。

---

## 1. 调用链与两套实现的边界

```text
App.tsx
 └─ MarkCanvas.tsx                    ← React 生命周期 / 空闲休眠 / poke 转发
     └─ markEngine.ts                 ← 选项 → 引擎输入（颜色、body、seed、帧率…）
         └─ src/engine/mark-engine.js ← 真正渲染：createMarkEngine()
              ├─ createStateGraph()   → 59 状态 → 37 clip 的调度
              ├─ createMotionCore()   → pose 采样、桥接、弹簧、视线、poke、表情
              ├─ renderMarkScene()    → frame + appearance → SVG 描述树
              └─ 内部 attach/RAF/指针/尺寸/可见性

GrokBotMark.tsx + motionEngine.ts + reconstruction/*   ← 可读重建版（App 未使用）
 └─ index.ts 导出为 BehavioralGrokBotMark / ApproximateGrokBotMark
```

- `src/avatar/index.ts:1` 把 **`GrokBotMark` 指向 `MarkCanvas`**（真实引擎），
  重建版被改名为 `BehavioralGrokBotMark`（`:3`）和 `ApproximateGrokBotMark`（`:4`）。
- `App.tsx:7` 仍然从 `animationClips.ts`（重建版的状态表）取 `STATE_DEFINITIONS`，
  仅用于底部显示"clip"标签，**不是运行时真实播放的 clip**（引擎用洗牌袋抽片段）。
- `MarkCanvas.tsx:13` 只以 `import type` 引用重建版的 props/handle 类型，运行时不加载。

结论：约 40 KB 的 TypeScript（`motionEngine.ts`、`animationClips.ts`、`shapeGeometry.ts`、
`reconstruction/*`）在应用里是"文档 + 测试 + 备用实现"，**不是产品渲染路径**。

---

## 2. 真实引擎的模块地图

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 输入/宿主 | `mark-engine.js:10136` `ig()` | 默认值归一化（`:10117`）、字段级更新、attach/update/命令式 API |
| 帧调度 | `:10229` `C()` | RAF + 帧率上限 + 页面隐藏 + IntersectionObserver + 静止停帧 |
| 状态调度 | `:3634` `za()` | 59 状态 → clip 列表、洗牌袋、一次性序列、`next`/`holdSeconds` |
| 片段数据 | `:1579` `Aa` | 37 个 clip：轨道关键帧、workArea、inspect、squashAnchor |
| 运动核心 | `:1172` `wa()` | 时间推进、采样、桥接、视线、poke、身体混合、morph、表情整合 |
| 表情状态机 | `:643` `yi()` | 9 种眼型的几何 morph、眨眼、眨眼中穿表情、inspecting 权重 |
| Morph 控制器 | `:891` `Ki()` | 三条弹簧（amount/swap/spin）+ 2.5 s/2 s 保持 + 1.5 s 暂停 |
| Morph 视觉 | `:9723` `Dh()` | morph kind → 缩放/位移/旋转/透明度/环半径/粒子列表 |
| 场景投影 | `:10029` `Vh()` | 单身体走 `im`（球）/`xf`（异形）；多身体或 morph 走 `Nh`→`Ph` |
| 几何与缓存 | `:8243`…`:8380` | 28 种身体轮廓、眼睛贴合投影、量化缓存 |
| SVG 差分 | `:10042` `Gh()` | 扁平化 tag/attr 名列表，结构一致只写变化值 |

低层 API 也对外导出（`mark-engine.js:10327`）：`createMotionCore`、`createStateGraph`、
`renderMarkScene`，但有类型定义却没被适配层使用。

---

## 3. 帧调度、停帧与"空闲休眠"

真实引擎的 RAF 循环（`mark-engine.js:10229`）：

```js
frameDuration = 1000 / max(1, maxFrameRate)
if (now - lastProcessed < frameDuration - 1) → 跳过本帧，继续排 RAF
delta = (now - lastProcessed) / 1000
if (!document.hidden) { isPlaying && graph.advance(delta); core.advance(delta); }
render();
if (!isPlaying && core.isSettled) → 停止排 RAF
```

要点：

- `core.advance()` 内部把 delta 截断到 0.1 s（`:1155` `ga = .1`），与重建版一致。
- `document.hidden` 时**不推进**，但 `lastProcessed` 每帧仍更新，所以回到前台不会出现大跳变。
- 停帧条件是"未播放且核心已静止"，`core.isSettled`（`:1382`）要求：
  无 poke、无身体混合、无桥接、无挂起表情、表情不在 morph、无眨眼、
  morph 弹簧与视线阻尼都已收敛。
- **空闲休眠是适配层的功能，不是引擎的**：`MarkCanvas.tsx:15` `IDLE_SETTLE_MS = 1400`
  在 idle 状态 1.4 s 后调用 `setPlaying(false)`，引擎随即 `graph.setResting(true)` →
  `core.rest()`（切换到 10 s 的 `rest` 片段并桥接），再等核心静止后停掉 RAF。
  这与重建版的 `IDLE_SETTLE_SECONDS = 1.4` 对应。
- 指针移动/组件输入会 `wake()` 重新起 RAF；`isPlaying=false` 时状态图不推进，
  但**核心仍 advance**，所以休眠后视线、眨眼、弹簧依旧可以响应（`mark-engine.js:10242`）。
- 静态/降级动效（`isStatic` 或 `prefers-reduced-motion`）：`pause → seek(0) → 60 × advance(0.1)`
  后渲染一帧并停住（`:10170`），`MarkCanvas` 同时把 `paused` 置真。
  注意 `advance` 在 pause 状态下不推进 clip 时间，只让弹簧/表情收敛，
  所以静态图是"当前片段（rest 或桥接）第 0 帧 + 收敛后的姿态"。

输入更新（`:10276` `O()`）按字段逐项比较，只有变化才触发对应子系统：
`body`→身体混合、`clip`/`morph`/`state`→调度、`appearance`/`fill`/`resolution`/`isProof`→重绘、
`size`→尺寸、`isFollowingPointer`→指针绑定、`isStatic`/`maxFrameRate`→重建 RAF。

---

## 4. 状态机：59 状态、37 片段

状态表 `Na` 与重建版 `animationClips.ts` 在**原始 53 个状态上逐项一致**；
lab 的 4 个状态设计相同，但真实引擎为 `stretch` 用了独立的 `Stretch_B`（重建版复用 `Idle_B`）。

- 59 个状态 = 生命周期 17 + 情绪反应 17 + morph 13 + 产品 3 + 品牌 3 + lab 6
  （`types.ts:48`；lab 4 个为后加）。
- 循环状态用**确定性洗牌袋**（`:3623` `La`：Fisher–Yates + 避免与上一个片段相同），
  种子来自 `seed ?? id` 的 FNV-1a（`:10109`），因此同一 mark 的片段顺序可复现。
- 一次性状态 = 有 `next` 且没有 `holdSeconds`：按声明顺序播放，播完进入 `next`。
- 定时状态：`blocked` 保持 **120 s** 后 → `drowsy`；`waking` 保持 **1.6 s** 后 → `idle`。
- `idle` 的片段列表里有重复项 `["Idle_B","Idle_B","Idle_D","Idle_B","Idle_A"]`，
  洗牌后表现为"Idle_B 出现概率更高"的加权效果。
- `compact`（尺寸 < 48 px，`:10106` `Qh = 48`）时 idle 只播 `Idle_B`。
- `isEmphasized` 时，没有显式 `face` 的状态会被强制 `surprised`（`:3622` `Ia`）。
  适配层永远传 `false`（`markEngine.ts:51`）。

---

## 5. 片段数据模型与采样

一个 clip 的真实结构（`Blocked_A`，`mark-engine.js:1579` 起）：

```js
{
  name: "Blocked_A",
  duration: 2.12,
  body: "sphere",
  squashAnchor: 0,
  workArea: { start: 0, end: 2.1 },     // 静止姿态参考区间（可为 null）
  inspect: { bias: -1, follow: true },  // 眼睛 inspecting 权重来源
  tracks: {
    position: [{ t, v: [x, y], ease: [x1,y1,x2,y2] }, ...],
    rotation: [{ t, v: [rx, ry, rz] }, ...],
    squash:   [{ t, v: [sx, sy] }, ...], // 仅 3 个 clip 有
    scale:    [{ t, v: [zoom] }, ...],   // 映射到 zoom，仅 3 个 clip 有
    lids:     [{ t, v: [0..1] }, ...],   // 仅 1 个 clip 有
    expression: [{ t, v: "confused" | "blink" | ..., cut?: true }, ...],
  }
}
```

- 原始 28 个片段中：27 个有 `rotation`、19 个有 `position`、22 个有 `expression`、
  3 个有 `squash`、3 个有 `scale`(zoom)、1 个有 `lids`。
  lab 新增的 9 个片段全部含 `position/rotation/scale/expression`，其中多数另含 `squash`。
- 关键帧插值（`:1068` `sa`）：先夹到首尾区间，再取**左关键帧的 ease** 做
  cubic-bezier 求值；求解 x 用 8 次牛顿迭代（`:34` `nr`），与文档描述一致。
- `expression` 里的 `blink` 会被展开成 lids 轨（`:1033` `oa` → `:1009` `ia`：
  在 `t + 0.26 * 0.45` 闭合、`t + 0.26` 打开），`cut: true` 表示"眨眼穿越"。
- 每个 clip 的 `duration` 是真实数据；`workArea.start` 是该片段的静止姿态时间点
  （多数为 0，`Done_A` 为 0.072，`Logo_A` 的 end 为 2.0 等）。

### 5.1 桥接过渡（bridge）

片段切换（`:1280` `N()`）**不是**直接切到目标 clip，而是：

1. 取目标 clip 的**静止姿态** `ca(target)`（`:1080`，按 `workArea.start` 采样）；
2. 生成一个 0.35 s 的合成桥接片段 `fa()`（`:1109`）：
   位置/旋转/压缩/缩放/眼皮各自从"当前实时姿态"插值到目标静止姿态；
   旋转用 `la()`（`:1100`）取**最短等价角**；
   缓动 `Yi = [0.4, 0, 0.2, 1]`（`:961`）；
3. 桥接片段播完后（一次性片段），才在 `se()`（`:1264`）里正式载入目标 clip，从相位 0 开始；
4. 循环边界还有一层"纠正"逻辑：若当前姿态与目标静止姿态已经在容差内
   （`:1106` `da()`：旋转 < 4°、位置 < 0.015、缩放 < 0.02…），就不再起桥接，
   直接回绕时间继续播，避免每次循环都做一次多余的拉回。

**真实桥接时长 = 0.35 s（`Yn`，`mark-engine.js:21`）**，
不是文档/重建版里的 0.28 s；0.28 s 是"表情 morph"时长（`Jn`）。

### 5.2 clip 时间与 morph 的耦合

`advance()`（`:1517`）中 clip 时间乘以 `1 - morph.amount`：
morph 完全展开时片段动画**完全停住**。重建版用的是 `1 - 0.82 * amount`（见 §8）。

---

## 6. 运动数学

### 6.1 半隐式弹簧

```js
v += (-2 * damping * stiffness * v - stiffness^2 * (x - target)) * dt
x += v * dt
```

固定子步长 1/120 s（`:11` `Vn`，`:12` `Hn`），各通道参数：

| 通道 | stiffness | damping | 位置 |
| --- | ---: | ---: | --- |
| morph amount | 14 | 1 | `:930` |
| morph outgoing swap | 11 | 1 | `:930` |
| morph spin | 14 | 1 | `:930` |
| body 形状混合 | 10 | 1 | `:1156` `_a` |

### 6.2 视线（gaze）

- 指针归一化：以 `width * 2` 为分母，夹到 `[-1, 1]`，y 轴取反（`:851`，`Ni = 2`）。
- 形状相关增益（`:841` `Fi`）：
  非球体 `rx = -19 * gazeY`、`ry = 26 * gazeX`；球体 `-14 / 18`；
  `heartChubby` 乘 0.6、`wedge` 乘 0.55。
- 位移增益：非球体 `0.07 / 0.055`，球体 `0.03 / 0.024`，再乘 hold 系数 0.55（`:1534`）。
- 帧率无关阻尼：`alpha = 1 - 0.86 ** (dt / (1/60))`（`:838`），收敛阈值 0.001。
- 仅当 `isGazeAlways && 播放中 && 未暂停` 时视线才写进姿态（`:1533`）。

### 6.3 Poke

| 种类 | 时长 | 效果 |
| --- | --- | --- |
| `spin` | `0.9 + 0.4 * (turns - 1)` s | `yaw += 180 * turns * (1 - cos(πu))` |
| `bounce` | 0.62 s | 上抬 `0.3 * sin(...)`，压缩 1.08 / 0.9，两端有回弹窗 |
| `nod` | 0.5 s | `pitch += 16° * 窗函数` |

多 poke 可叠加（bounce 的压缩相乘）。适配层类型只暴露 `spin`/`bounce`，
但运行时传 `nod` 也能工作（`mark-engine.js:782`、`:797`）。

### 6.4 Morph

两个部件：控制器 `Ki`（`:891`）与视觉 `Dh`（`:9723`）。

- 13 种 morph 映射到 13 种视觉 kind（`:856` `Li`）：
  `thinking→dots`、`orbit→orbit`、`radar→radar`、`progress→progress`、
  `spawning→gather`、`dictating→wave`、`sending→send`、`receiving→receive`、
  `uploading→dock`、`bouncing→ball`、`writing→pencil`、`alerting→bang`、
  `powering-down→standby`。
- `progress` / `spawning` 有节律：保持 2.5 s / 2 s，然后**暂停 1.5 s**；
  暂停期间 amount 弹簧目标变 0（部件淡出），恢复时 `_ = h` 重置节拍重新计时（`:916`）。
- morph 激活时随机选 ±π 的额外自旋（`:916` `p += Ri * p`）。
- `frame()` 在 morph 期间会把姿态**拉向"整圈对齐"的中性朝向**：
  `c = [Sa(rot[0]), Sa(rot[1]), Sa(rot[2])]`，`Sa` 四舍五入到 360 的倍数（`:1161`、`:1544`），
  再按 `1 - amount` 权重插值；同时 offset/squash 也按 `1 - amount` 收回。
  这是"头身分离"视觉的来源之一。
- `frame().eyes = amount >= 0.5 ? null : ...`（`:1553`、`:9789` `isFaceVisible`）：
  morph 展开到一半后眼睛隐藏。
- 场景里的 `parts`（粒子/环/笔尖等）由 `Dh` 生成，`Lh`（`:9930`）把
  `disc / ring / shape / stroke` 四种图元翻译成 SVG。

### 6.5 表情状态机

`yi()`（`mark-engine.js:643`）以**眼睛几何**为单位做 morph，而不是切换图标：

- 9 种表达式（`:307` `Br`）：`neutral / happy / surprised / sad / sleepy / squinted / calm / inspecting / confused`，
  每种由两段可变形 capsule（`pts`、`wid`、`lidY`、`oval`、`tilt`、`off`）描述。
- morph 路径有三种：`stadium`（普通）、`spine`（带折点）、`oval`（椭圆化），
  由两端几何是否有折点/椭圆（或任一端是 `sleepy`）决定（`:637`）。
- 时长：表情 morph 0.28 s（`Jn`）、眨眼穿越表情 0.35 s（`Yn`）、眨眼 0.26 s（`Xn`）。
- 眨眼：`ir()`（`:49`）计算闭合窗口（快速闭合 2 帧、慢速闭合 4.25 帧，按 60 fps 归一），
  `or()`（`:65`）给出 0→1→0 的窗；`blinkAmount()` 返回 null 表示未眨眼。
- 眨眼期间收到的新表情请求会存进 `O`（`:1224` `ne`），等眼睛睁开后执行（`:1521`）。
- `inspecting` 权重来自视线 x / 20（`:617` `hi`、`:379` `Xr = 20`），并在左右眼之间做
  非对称放大，形成"歪头打量"。
- 允许 clip 的 `lids` 轨直接压住眼皮（`:1241` `re`）。

---

## 7. SVG 投影与差分

### 7.1 场景结构

- 单身体且无 morph：球体走 `im()`（`:9087`），异形走 `yf()→xf()`（`:8144`、`:8212`）。
- 多身体（形状混合中）或有 morph：`Nh()→Mh()→Ph()`（`:9842`、`:9845`）。
- `Ph()` 组装的顺序：
  1. `defs`（cutout 眼睛的 mask、或 painted 眼睛的 clipPath、渐变）；
  2. 身体 path（`fill` 用 ink 或 glow 渐变）；
  3. 眼睛：默认 `cutout`（`createAppearance` 不传 spot 时 `cutout: true`）→
     用 mask 在身体上"挖洞"；传 spot → 用 clipPath 把眼睛画在身体内；
  4. `painted` 装饰（如南瓜梗 `stem`）；
  5. `head` 组：`translate/rotate/scale`（morph 时头身分离）；
  6. `parts`：morph 粒子/环/笔尖等；
  7. `zoom` 组：以 mark 中心缩放。
- 根 `<svg>`：`width/height = 精灵分辨率`，`viewBox = "0 0 size size"`（`:8125` `sf`），
  由 CSS 拉伸到宿主尺寸（`styles.css:287`）。
- 精灵分辨率：`resolution = size * fill / 0.6`（`:1566` `Ea`，默认 fill 0.92 →
  1.533 × size）；身体精灵再按 `round(res * zoom / (184/256))` 取整，最小 144（`:8145`）。

### 7.2 缓存与量化（性能关键）

- 眼睛投影 `Of()`（`:8348`）的 key 是
  `${body} ${sprite} ${yaw} ${pitch} ${roll} ${eyesJSON}`，LRU 上限 256 条（`:8139` `mf`）。
- 身体轮廓 `kf()`（`:8359`）的 key 是 `${body} ${sprite} ${yaw} ${pitch} ${roll}`，
  按累计点数预算 16M（`:8137` `ff`）淘汰。
- 角度量化步长 `Tf()`（`:8318`）：
  `step = 2 ** floor(log2((0.6 / max(zoom*size/2, 1)) * 180/π))`，
  即屏幕越小步长越粗；`Ef()` 还会把接近 90° 的角度推开 0.5°，避免轮廓退化。
- 结论：静止/小幅度运动时每帧几乎命中缓存；只有明显转头或换身体才重算几何。
- `frame()` 里的 `quat` 由欧拉角按 `Rz * Ry * Rx` 组合（`:91` `pr`），
  Y 轴额外叠加 clip 的 `spin`（`:1548`）。

### 7.3 SVG 差分

`Gh(canvas, tree)`（`:10042`）：

- 把树扁平化成 `[tag, attrName..., "/"]` 的名字数组 + 对应值数组；
- `WeakMap<canvas, {root, names, slots, values}>` 缓存上一棵；
- 若 `canvas.firstChild === root` 且名字数组完全一致，只把值变化的属性写回；
- 否则 `replaceChildren(rebuild(tree))`。
- 因此每帧仍会构造一棵完整的 JS 描述树（有分配开销），但 DOM 写入被压到最小。
  这是"60 fps 但 GC 压力中等"的典型取舍。

---

## 8. 可读重建版（MarkMotionEngine）现状

`motionEngine.ts:112` 刻意保留了同样的系统边界：clip 采样、桥接、状态调度、
视线阻尼、表情计时、弹簧 morph、poke、空闲休眠。状态表与片段名 100% 对齐，
数学原语（cubic-bezier 8 次牛顿、spring、洗牌袋）也复刻得不错。

但它**不是 1:1 移植**：

### 8.1 数据与常量差异

| 项 | 真实引擎 | 重建版 | 影响 |
| --- | --- | --- | --- |
| 桥接时长 | 0.35 s | 0.28 s（`motionEngine.ts:33`） | 切片段更快、更硬 |
| 片段减速 | `1 - amount` | `1 - 0.82 * amount`（`:381`） | morph 期间仍有片段运动 |
| 片段时长 | 28 条真实值 | 17 条不一致（见附录） | 节奏与真实片段不同 |
| 片段曲线 | 每条轨道独立关键帧 | `bob/tilt/spin/squash/wobble` 5 参数生成 6 帧 | 只保留"风格"，非原始动作 |
| 表情 | 9 种几何 morph | 7 种枚举 + 椭圆近似 | 缺 `sad`/`confused`，眼睛不是 capsule |
| morph 姿态 | 拉向中性朝向、offset/squash 收回 | 无 | 缺"头身分离"关键观感 |
| morph 暂停 | 部件淡出、恢复后重新计时 | 冻结时钟（见 8.3） | progress/spawning 视觉卡死 |
| 身体混合 | spring 10 + 三档缓动 | 线性 0.22 s + smoothstep | 过渡手感不同 |
| poke | spin/bounce/**nod** | 仅 spin/bounce | 少一种反馈 |
| 命令式 API | `setExpression/blink/look/rest` | 无 | 可编程性弱 |
| workArea / squashAnchor | 支持 | 无 | 桥接目标姿态不同 |

### 8.2 结构差异

- 真实引擎用 `frame()` 输出 `body/zoom/offset/squash/quat/eyes/morph/bodies`，
  由投影层决定 SVG；重建版直接输出扁平的 `MarkVisualState`，由 React 每帧重渲染整棵 SVG
  （`GrokBotMark.tsx:630`），没有差分。
- 真实引擎的眼睛是"贴合身体表面的 capsule 投影"；重建版是椭圆 + 少量旋转/位移近似。

### 8.3 一个确定的 bug：morph 暂停后冻死

`motionEngine.ts:460`：

```ts
if (!this.#morphPaused && this.#morphClock >= holdAt) { …暂停… }
else if (this.#morphPaused) {
  this.#morphPauseElapsed += deltaSeconds;
  if (this.#morphPauseElapsed >= 1.5) {
    this.#morphPaused = false;
    this.#morphClock = this.#morphPauseStarted + 1.5 + (this.#morphClock - this.#morphPauseStarted - 1.5); // 恒等式，无效果
  }
}
```

`#morphClock` 在暂停期间仍在累加，恢复后仍 ≥ `holdAt`，于是下一帧立刻再次暂停。
`#morphRenderClock`（真正驱动视觉相位的时钟）只在未暂停时累加，
表现为"每 1.5 s 只前进一帧"，`progress` 弧线与 `spawning` 粒子基本冻结。
真实引擎在恢复时执行的是 `_ = h`（重置 shot 时钟），见 `mark-engine.js:916`。

实测（把 `motionEngine.ts` 用 `tsc --ignoreConfig` 单独编译，按 60 fps 推进 7 s）：

| 状态 | 7 s 时 morphClock | morphActive | 对照 |
| --- | ---: | --- | --- |
| `progress`（hold 2.5 s） | **2.533**（2.5 后每次恢复只前进 1 帧） | 一直 `false` | 应周期性 2.5 s 播放 / 1.5 s 暂停 |
| `spawning`（hold 2 s） | **2.050** | 一直 `false` | 同上，节拍 2 s |
| `orbit`（无 hold） | 7.017（线性增长） | 一直 `true` | 正常 |

同时 `morphAmount` 恒为 1，而真实引擎在暂停期间会把 amount 弹簧目标设为 0（部件淡出）。

### 8.4 其它观察

- `frame()` 用 `faceBlend >= 0.5` 直接切换表情枚举，没有连续几何过渡。
- `advance()` 在 `#idleSettled` 后整体早退（`:665`），poke/gaze 通过 `#wake()` 恢复，逻辑可用，
  但与被真实引擎"状态图静止、核心仍推进"的模型不同。
- 重建版的测试反而比真实引擎多：真实引擎只有 API 形状/映射测试
  （`markEngine.test.ts`），没有任何运动行为测试。

---

## 9. 文档、README 与实现的偏差

| 文档表述 | 实际 |
| --- | --- |
| `docs/mark-engine.zh-CN.md:67` 桥接 0.28 s | 真实引擎 0.35 s（`Yn`）；0.28 s 是表情 morph |
| 同文 "`size` 重新绑定尺寸监听" | 仅当 `size` 不是数字时挂 ResizeObserver（`:10203`）；适配层始终传数字，因此从不挂 |
| 同文 "每帧按 1/120 秒切分积分子步" | 正确（`Vn`/`Hn`） |
| 同文 "`progress` 2.5 s 后暂停 1.5 s" | 真实引擎正确；重建版因 §8.3 实际冻结 |
| 同文 "指针以 width * 2 为归一化分母" | 正确（`Ni = 2`） |
| 同文 "blocked 保持 120 秒后进入 drowsy" | 正确（`ja = 120`） |
| README "Evidence-backed 1:1 reconstruction"（`package.json:6`） | 状态表 1:1，动作曲线/时长并非 1:1（17/28 片段时长不同） |
| README "26 body shapes / 53 states" | 正确 |
| README 组件示例 `import { GrokBotMark }` | 解析到 `MarkCanvas`（真实引擎）；重建版需显式引 `BehavioralGrokBotMark` |
| `docs/mark-engine.zh-CN.md:3` "引擎入口位于 mark-engine.js" | 正确，但同文多处数值描述的是重建版而非该文件 |

另外：`App.tsx:177` 的 "clip" 标签取 `definition.clips[0]`，是**静态首选片段**，
不是引擎当前播放片段（洗牌袋会换），属于展示层的轻微误导。

---

## 10. 风险与建议

### 10.1 测试

- 真实引擎没有行为测试；重建版有较好的单元测试，但测的是"另一套实现"。
- 在本机受限沙箱中 `npm test` 因 Vite 启动时 `child_process.spawn` 被拒（`EPERM`）而失败，
  属于环境限制，不是代码失败；`npx tsc --noEmit` 通过（exit 0）。
- 建议：给真实引擎补"给定输入 → 若干帧后的确定性快照"测试（它 seed 可复现，适合做快照）。

### 10.2 性能

- 284.9 KB（gzip 77.3 KB）的引擎被打进首屏主包，没有动态 import。
- 每帧构造整棵 SVG 描述树，只有 DOM 写入做了差分；如果状态面板同时挂 28 个
  `ShapeGlyph`（`App.tsx:302`），启动时会创建 28 个引擎实例并各跑 60 步静态收敛。
  可考虑：形状缩略图共用一张预渲染图、引擎改为 `import()` 懒加载。
- 眼睛/身体缓存已有上限（256 条 / 16M 点），长时间切形状不会无限增长。

### 10.3 可维护性

- 引擎是压缩产物，无 source map、无注释，改一个节奏只能"读汇编"；
  可读版虽然不参与渲染，但至少提供了行为说明。
- 建议把可读版修到与真实引擎一致（至少修 §8.1 的桥接/morph/减速），
  或明确标注"教学用近似"，避免后来者误以为它是产品实现。

### 10.4 API 缺口

- 适配层没有透传：`clip`、`morph`、`isEmphasized`、`seed`、`resolution`、`isProof`、
  `setExpression`、`blink`、`look`、`rest`。
- `MarkEngineInput.state` 在 `.d.ts` 里是 `string`，传入未知状态时
  `u = Na[t]` 会是 `undefined`，随后 `h()` 访问 `u.clips` 直接抛错；
  建议运行时兜底到 `idle` 并给出警告。

---

## 11. 调试与扩展指引

### 11.1 观察真实引擎

```bash
npm run dev          # http://127.0.0.1:4173
# ?paused=1 冻结在首帧，便于比对静态姿态
```

- 页面上每个 mark 的宿主 `<span class="grok-bot-mark">` 带 `data-grok-state`；
  SVG 的 `id` 前缀来自 React `useId`（`MarkCanvas.tsx:24`），便于在 DevTools 里定位。
- 想临时看骨架：把 `MarkCanvas` 的 `size` 调大、或在 `attach` 后直接调用
  `engine.poke("nod")`（类型未暴露，运行时可用）。

### 11.2 加一个状态

1. `types.ts` 的 `MARK_STATE_GROUPS` 加名字（会同步派生 `MarkState`）；
2. `animationClips.ts` 的 `STATE_DEFINITIONS` 加定义（重建版与 UI 用）；
3. 真实引擎的状态表在压缩包里（`Na`），需要改 `mark-engine.js` 或改用
   `createStateGraph` 的低层 API 自行构造；
4. `i18n.ts` 补两份文案（`COPY.states`），否则 UI 取不到标签。

### 11.3 调一个节奏

- 真实引擎：改 `Aa` 里对应 clip 的 `t`/`ease`（数据即代码），或临时把
  `Yn`（桥接）改大观察过渡；
- 重建版：改 `animationClips.ts` 的 5 个标量，或 `keyframes.ts:107` 的 6 帧模板。

### 11.4 换颜色/形状

- 颜色：`resolveColorHex`（`markEngine.ts:31`）→ `createAppearance`（`mark-engine.js:10092`）。
  不传 spot 时 `cutout: true`（挖洞眼），传 spot 则变成实心点。
- 形状：`canonicalBody`（`:10077`）只映射 4 个名字，其余原样传入；引擎内部还有
  `sphereWide/spark/hexagon` 等别名（`:960`），`pumpkin` 特殊：不做形状混合、直接切换（`:1429`）。

---

## 附录：28 个原始片段时长对照

（不含 lab 新增的 9 个片段：Sneeze_A/B/C、Shiver_A、Stretch_A/B、Doze_A、Pace_A、Wink_A。）

| clip | 真实 (s) | 重建 (s) | 一致 |
| --- | ---: | ---: | :--: |
| Idle_A | 6 | 6 | ✓ |
| Idle_B | 4 | 4 | ✓ |
| Idle_D | 6 | 6 | ✓ |
| Streaming_A | 2.6 | 2.6 | ✓ |
| Streaming_B | 2.6 | 2.6 | ✓ |
| Streaming_C | 2.4 | 2.4 | ✓ |
| Working_A | 8 | 3.5 | ✗ |
| Working_B | 4.8 | 3.8 | ✗ |
| Working_C | 5 | 3.2 | ✗ |
| Working_D | 5 | 4.2 | ✗ |
| Working_E | 4 | 3.6 | ✗ |
| Working_F | 5 | 3.1 | ✗ |
| Blocked_A | 2.12 | 3.8 | ✗ |
| Blocked_B | 3 | 4.2 | ✗ |
| Blocked_C | 1.4 | 5.4 | ✗ |
| Done_A | 3.7 | 3.7 | ✓ |
| Done_B | 1.8 | 3.3 | ✗ |
| Done_C | 2 | 3.1 | ✗ |
| Rotation_A | 6 | 5.4 | ✗ |
| Rotation_B | 10 | 10 | ✓ |
| Rotation_C | 4 | 4 | ✓ |
| Marketing_A | 4 | 4.4 | ✗ |
| Marketing_B | 4 | 4.1 | ✗ |
| Marketing_C | 4 | 4.8 | ✗ |
| Marketing_D | 4 | 4.5 | ✗ |
| Logo_A | 4 | 4 | ✓ |
| Logo_B | 4 | 4 | ✓ |
| Bodymoves_A | 5 | 3.6 | ✗ |

一致 11 / 28。真实值来自 `mark-engine.js:1579`–`:3423`，重建值来自
`animationClips.ts:46`–`:75`。
