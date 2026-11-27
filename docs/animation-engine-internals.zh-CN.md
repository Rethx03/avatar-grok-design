# Blobmark 引擎计算逻辑：图形与动作是怎么算出来的

本文只讲**算法**：一个 mark 的轮廓、眼睛、装饰是怎么从数字算成 SVG 路径的；
姿态、动作、表情、morph 是怎么逐帧算出来的。所有结论都对应
`src/engine/mark-engine.js`（下称"真实引擎"）的具体函数，并用无头探针实测过。

行号以当前工作区文件为准。

> Lab 扩展后，引擎数据为 **28 个身体 / 37 个片段 / 59 个状态**：
> 新增 `ghost`、`cookie` 两个身体，`Sneeze_A/B/C`、`Shiver_A`、
> `Stretch_A/B`、`Doze_A`、`Pace_A`、`Wink_A` 九个片段，
> 以及 `sneeze/shiver/stretch/doze/pace/wink` 六个 Lab 状态。
> `shy` 保持原有的 `Idle_D + calm` 动作不变。设计说明见 [lab/README.md](lab/README.md)。

## 0. 怎么验证

引擎导出了三个不依赖 DOM 的入口（`mark-engine.js:10327` 附近）：

```js
import { createMotionCore, createStateGraph, renderMarkScene, createAppearance } from "./src/engine/mark-engine.js";

const core = createMotionCore({ body: "sphere" });
const graph = createStateGraph(core, "working", { seed: 7 });
for (let i = 0; i < 60; i++) { graph.advance(1 / 60); core.advance(1 / 60); }
const tree = renderMarkScene(core.frame(), createAppearance("#1084fe"), 256, "m", { displaySize: 256, extent: "100%" });
```

`core.frame()` 给出姿态，`renderMarkScene` 给出 SVG 描述树（`{tag, attrs, children}`），
全程不需要浏览器。文中所有"实测"都是这样跑出来的。

---

## 1. 一帧的计算图

```text
输入（state / body / appearance / size / 指针）
  │
  ├─ 状态图 advance          : 选 clip、管 next / holdSeconds
  ├─ 运动核心 advance        : 视线 → clip 时间 → 桥接 → 表情 → morph → 身体 → poke
  └─ frame()                 : 采样 pose + 视线 + poke + morph 权重
        │                        → quat / offset / squash / zoom / eyes / bodies
        └─ renderMarkScene()   : 3D 投影 → 轮廓 → 眼睛 → 装饰 → SVG 树
              └─ Gh()          : 属性差分写回 DOM
```

`core.advance()` 内部的顺序（`wa` 的 advance，约 `:1515`）：

```js
dt = min(dt, 0.1)                       // 帧间隔硬上限
gaze(dt)                                // 视线阻尼 + hold
if (playing) clipTime(dt * (1 - morph.amount))   // morph 期间动作变慢
bridge(dt)                              // 0.35s 过渡
face.step(dt)                           // 表情几何 morph / 眨眼
morph.advance(dt)                       // 三条弹簧 + 暂停节拍
bodyBlend(dt)                           // 形状弹簧
pokes = pokes.map(t += dt).filter(...)  // poke 衰减
```

顺序决定了视觉优先级：**视线和表情不受 clip 时间影响；clip 时间被 morph 减速；
桥接会覆盖 clip 姿态；poke 最后叠加。**

---

## 2. 图形计算

### 2.1 从"设计稿形状"到二维轮廓

28 个身体的二维来源分三类（`ds`，`:5045`）：

| 来源 | 身体 | 生成方式 |
| --- | --- | --- |
| 字面 SVG path | heart、star6、sparkle | 设计工具导出的 `C` 曲线串（`Yo`/`Xo`/`Zo`），直接解析 |
| 参数方程采样 | pebble、bean、egg、squircle、gem、leaf、teardrop、flower、clover | `Po(fn, 128)` 采 128 个点后走平滑闭合曲线 |
| 路径构建器 | square、tablet、capsule、cylinder、hex、shield、dome、arch、house、cloud | `Mo`（M/L/C/Q + 圆弧贝塞尔）、`Fo`（圆角多边形）、`Lo`（圆并集） |
| Lab 自定义 | ghost（loft .9）、cookie（挤出 .36） | ghost 走 loft；cookie 走非凸挤出 |

几个有代表性的公式：

```text
squircle : Ro(w,h,p):  x = sign(cosθ)·|cosθ|^(2/p)·w,  y = sign(sinθ)·|sinθ|^(2/p)·h   (p=3.2)
egg      : Go(w,h,n):  x = cosθ·w·(1 - n·t²),  t = (1 - sinθ)/2                     (n=.22)
leaf     : $o(w,h,n):  x = cosθ·w·(1 - sin²θ)^(n/2-.5),  y = sinθ·h
pebble   : ts(r,n,φ):  ρ = r·(1 + n·(.6·sin(2θ+φ) + .4·sin(3θ-φ))),  y × .98
bean     : es(w,h,n,φ): ρ = 1 - n·e^(-Δθ²/.4232) + .34n·e^(-(Δθ+π)²/.4232)   // 高斯凹陷
clover   : Qo(a,r):    4 个半径 r 的圆的并集
cloud    : Lo(circles): 5 个圆的并集
```

圆并集不是布尔运算，而是**支撑函数**：对每个方向 θ 求所有圆上沿 θ 的最远点
（射线-圆求交取正根），再采样成点（`Lo`，`:4802`）。

任何 path 先被 `ns`（`:4876`）按约 4 单位步长**展平成多边形**——曲线在这一步之后就不存在了。
随后 `us`（`:5021`）做归一化并派生结构：

```js
scale = clamp(228.44 / max(width, height), 0.9, 1.35)   // 统一到 ~228 设计单位
center = B - bboxCenter                                   // B = 114.2705
ring   = 96 个方向的极径（最大投影）                       // as(), :4967
spanAt(y) / outerAt(y) = 160 条扫描线的左右边界            // rs(), :4928
beltRadius = 最大半宽                                     // 用于 wrap 座位
```

所有坐标最终四舍五入到 **0.01**（`Rl`）；布尔运算前另量化到 **1/1024**（`bl = 1024`）。

### 2.2 三维体：四种建模方式

| 方式 | 函数 | 构造 | 身体 |
| --- | --- | --- | --- |
| 旋转体 | `Zs`/`Qs`（`:5505`） | 把二维轮廓按扫描线绕 Y 轴旋转：每个高度 y 生成半径 = 半宽(y) 的 64 点圆环 | pebble, egg, gem, shield, dome, arch, leaf, wedge, cylinder, teardrop |
| 挤出体 | `ac`（`:5659`） | 二维轮廓沿 ±z 复制 5 层/侧（9 个不同 z 切片），z = ±(t − n + n·sinφ)，径向 scale = 1 − (n/r)·(1 − cosφ)，形成圆角厚度 | hex, square, sparkle, clover（部分）, house, star6 |
| 放样体 | `sc`（`:5724`） | 17 层环，z = ±depth·sinφ，环按 cos^0.72 缩放 | heartChubby, cloud |
| 球并集 | `ic`/`nc`（`:5624`/`:5596`） | 在轮廓内按网格采点，取到边界距离作为半径 → 一串球；或沿轴排 33 个等半径球 | bean（网格球）、tablet/capsule（轴向球） |
| 点云 | `Ys`（`:5434`） | 手工构造的球面点云 | crystal |
| 解析体 | `nm`（`:9060`） | 不建 3D，直接画椭圆 | sphere |

旋转体的扫描线还处理了极点：靠近顶部/底部时半径按 `sqrt(r/dJoin)·rJoin` 收缩，
避免旋转轴上的退化（`Qs` 内的 `l()`/`d()`）。

### 2.3 相机与投影

`Tc`（`:5836`）给出一次投影的相机：

```js
radius = max(0.2, body.size) * 0.36 * spriteSize / 1.18
center = spriteSize / 2
project({x,y,z}) = { x: center + radius*x, y: center - radius*y }   // 正交，y 翻转
```

`Ec`（`:5856`）构造旋转矩阵 **Rz(roll)·Rx(pitch)·Ry(yaw)**，用
`[cosθ, sinθ, 1−cosθ]` 这个三元组把三次旋转压成一个闭包（第三项在自乘时抵消成 0）。
`frame().quat` 则是 **Rz(rotZ)·Ry(rotY + spin)·Rx(rotX)**，再与相机四元数相乘（`Cf`）。

角度在使用前会**量化**（`Tf`，`:8318`）：

```text
step = 2^floor(log2((0.6 / max(zoom*size/2, 1)) * 180/π))   // 单位：度
```

display 256、zoom 0.6 时 step = 0.25°；44px 缩略图时 step = 2°。
接近 90° 的角度会被推开 0.5°（`Ef`），避免轮廓退化。量化后的
`(body, sprite, yaw, pitch, roll)` 是轮廓缓存的 key。

### 2.4 轮廓提取：四种算法按身体选择

`kc`（`:5889`）按 `silhouette.kind` 分派：

```text
solid + isLoop       → 直接投影多边形（可以凹）
solid + 非 loop      → 投影全部点 → 凸包（Andrew monotone chain, jc）
solid + balls        → 160 个方向的支撑函数（射线-球）→ 凸包
extrusion + 凸       → 所有环点凸包
extrusion + 非凸     → 环间四边形条带 → 布尔并集
loft                 → 480 个角度分箱，取每箱最远点（星形轮廓, Nc）
sphere               → 椭圆（4 段弧）
```

**布尔并集**（`El`，`:6758`）是一个完整的 2D 多边形布尔引擎，约 200 行：

1. 量化到 1/1024，消除反向重合边（`Dl`）；
2. 两两求交、把所有交点插进边（`Ol`，按 x 排序 + 包围盒早退）；
3. 有向边规范化成无向边并累计方向（`jl`）；
4. 对每条边用扫描线求绕数，判断保留/翻转（`Ml`）；
5. 按有向图串成闭环，输出 `M…Z`（`Nl`）。

因此 `star6` 的凹角是**真的**，不是凸包近似。实测（display 256）：

| 身体 | 多边形点数 | 凹度 area/hull | 备注 |
| --- | ---: | ---: | --- |
| star6 | 228 | 0.776 | 挤出 + 布尔并 |
| cloud | 480 | 0.973 | 放样 + 星形轮廓 |
| heartChubby | 480 | 0.988 | 放样；顶部凹口只剩 ~5px（viewBox 392） |
| arch | 174 | 1.000 | 旋转体 → 凸包（本身是凸轮廓） |
| crystal | 34 | — | 点云凸包，所以点数最少 |
| sphere | 4 段弧 + 2 条 162 点眼洞 | — | 解析圆（4 段 A 弧）+ SDF 眼洞 |
| pumpkin | 256 | 0.996 | 旋转体 + 梗 |

### 2.5 眼睛：座位投影 + SDF 等值线

眼睛先在**身体局部坐标**里成型（`Qa`，`:3875`）：

- 每身体有一组度量 `Za[body] = {width, height, gap, shiftY}`（基准 `0.26 × 0.57`，间距 `0.64`）；
- 两只眼分别放在 `x = ±(0.32 + off.x)·gapScale`，`y = shiftY + off.y·heightScale`；
- 眼形有两种：**胶囊**（中心线 `pts` + 半宽 `wid`，可带 tilt）或 **椭圆**（`oval`，由
  morph 的 ovalMix 产生）；
- 眨眼/表情通过 `lidY` 压扁中心线，`fillRing` 则在 oval 化时接管轮廓。

然后 `Pc`（`:6102`）把二维眼形**贴到体表**，按 `seat.kind` 分四种：

```text
front  : 眼睛在 z = faceZ 平面上；平面法线旋转后 z ≤ 0.03 时隐藏         （挤出体）
loft   : z = surfaceZ(x,y) 深度图 + 有限差分法线；法线夹角 < 0.12 隐藏    （heart/cloud）
wrap   : 包在圆柱上：u = clamp(x / max(0.12, radiusAt(y)), ±2.6)
         x' = r·sin u, z' = r·cos u, y 夹在 [y0, y1]；可选 puffAt 局部鼓包 （旋转体/球并集）
wrapX  : 同上，但轴是 X（tablet）
```

最后把 3D 点投影到屏幕。**每个点独立做朝向剔除**，所以转头时眼睛会被体表"切掉"一截，
而不是整体消失——这是它看起来像贴在球面上的关键。

眼睛的最终路径不是把胶囊多边形直接描边，而是：

1. 构造 **SDF**（`Ip`）：胶囊距离 = 到折线的最近距离 − 半宽；按 `ovalMix` 与椭圆距离混合；
2. 在包围盒上以 `step = max(min(0.015, min半径/3), 最大尺寸/400)` 的网格跑
   **marching squares**（`zp`/`Cu`），取距离 ≈ 0 的等值线；
3. 容差 `edge = sqrt(4·deviation)`，resolution 按眼睛屏幕半径取 `2^n`（16 级）；
4. 结果按 `(level, wid, oval, ovalMix, pts)` 缓存，LRU 512 条（`Fp`，`:8923`）。

实测：sphere 的一只眼孔约 162 个点；眨眼时眼高从 **45.6px → 9.1px**（约 20%），
0.267 s 完全复原。

### 2.6 场景组装与遮罩策略

三种 SVG 结构，取决于身体与外观：

```text
sphere（cutout）  → 单 <path fill-rule="evenodd">，眼睛是"洞"；glow 用 radialGradient
其他身体（cutout）→ <defs><g id=body> + <mask id=holes>（rect 白 + 眼黑）
                    <use href="#body" mask="url(#holes)">
其他身体（spot）  → <mask id=inside><use href="#body" fill="#fff"></mask>
                    <g mask="url(#inside)"><path d=eye fill=spot/></g>
```

- `sprite = max(144, round(size·zoom / (184/256)))`（`yf`，`:8143`）；
  根 SVG 的 `width/height = extent`（适配层传 `100%`），`viewBox = 0 0 size size`。
- 仿射 `matrix(sx 0 0 sy tx ty)` 由 `Mf`（`:8389`）算出：

```text
tx = a − sx·sprite/2,   a = sprite/2 + offset.x·zoom·sprite/2
ty = s + sy·(o − sprite/2 − s),   o = sprite/2 − offset.y·zoom·sprite/2
s  = o − squashAnchor·zoom·sprite/2        // 压缩支点
```

- `pumpkin` 额外画梗（`stem`）；`head` 组负责 morph 时的头身分离；
  `parts` 是 morph 粒子（`disc/ring/shape/stroke` 四种图元）；
  最外层 `zoom` 组以 mark 中心缩放。

实测：28 个身体全部可渲染，轮廓点数从 34（crystal）到 480（cloud/heart），
lab 的两个身体在 215–266 之间；
`star6` 的 bbox 随 viewBox 线性缩放（160→113px，800→560px），点数不变（228）。

---

## 3. 动作计算

### 3.1 clip 采样：分段三次贝塞尔

clip 是四类轨道（`position`/`rotation`/`squash`/`zoom`）+ 表情事件（`lids`/`expression`），
每条轨道是一串 `{t, v, ease}`。采样（`sa`，`:1067`）：

```text
t <= first.t      → first.v
t >= last.t       → last.v
否则找左关键帧 i，u = (t - t_i) / (t_{i+1} - t_i)
eased = cubicBezier(u, ease_i)        // 用左关键帧的 ease
v = v_i + (v_{i+1} - v_i) · eased
```

`cubicBezier`（`nr`，`:33`）先解 x 轴（8 次牛顿，误差 < 1e-6），再求 y。
旋转轨道的值直接当欧拉角用；桥接时另用 `la` 取**最短等价角**（加 360 的整数倍）。

实测：`listening`（Idle_D）在 t = 1.0783308 的姿态
`[-34.323°, 16.862°, 15.137°]`，与数据中的关键帧 `[-34.3234, 16.8620, 15.1374]` 完全一致。

### 3.2 桥接：0.35 s 的"到静止姿态"过渡

切片段时（`fa`，`:1108`）不是硬切，而是：

```text
from = 当前实时姿态（可能本身在桥接中）
to   = 目标 clip 在 workArea.start 处的静止姿态（ca, :1079）
duration = 0.35s
easing   = [0.4, 0, 0.2, 1]
rotation 的终点取与 from 最近的等价角
```

桥接用一个合成的"片段"承载，播完才真正载入目标 clip（从相位 0 开始）。
循环边界还有一层判断：若当前姿态已经贴近目标静止姿态（旋转差 < 4°、位置差 < 0.015、
缩放差 < 0.02），就不重复拉回（`da`，`:1105`）。

实测：`working → logo` 切换后桥接持续 **20 帧（0.333 s 采样，标称 0.35 s）**，
结束姿态 `[-15.911°, 33.253°, 25.360°]`，与 Idle_D 的 t=0 关键帧
`[-15.896°, 33.293°, 25.385°]` 相差 < 0.05°。

### 3.3 状态机：59 状态、37 片段

`Na`（`:3427`）把 59 个符号状态映射到：

```js
{ clips: string[], compactClips?, face?, morph?, next?, holdSeconds? }
```

- 循环状态：用**确定性洗牌袋**（`La`，`:1099`）抽片段，种子是 `seed ?? id` 的 FNV-1a 哈希；
  同一轮内不重复，且避免与上一个片段相同。`idle` 的列表里有重复项，等价于加权。
- 一次性状态：有 `next` 且无 `holdSeconds`，按声明顺序播完再进入 `next`。
- 定时状态：`blocked` 120 s → `drowsy`；`waking` 1.6 s → `idle`。
- 尺寸 < 48px 用 `compactClips`；`isEmphasized` 时给没有显式 `face` 的状态强制 `surprised`。

实测：`waking` 1.6 s 进入 idle；`blocked` 120.1 s 进入 drowsy；
`finished` 的顺序是 `Done_B`(1.8s) → `Done_A`(3.7s) → idle 片段。

### 3.4 姿态合成

`frame()`（约 `:1531`）把五层叠起来：

```text
rot   = clip.rot + gaze(pitch/yaw) + poke.pitch/yaw
pos   = clip.pos + gazeOffset + [0, poke.lift]
scl   = clip.scl × poke.squash
quat  = Rz(rot.z)·Ry(rot.y + spin)·Rx(rot.x)
eyes  = morph.amount >= 0.5 ? null : project(eyeGeometry)
bodies= 当前身体混合权重
```

- **视线**：`ry = (球 18 / 非球 26)·shapeScale·gazeX`，`rx = (球 14 / 非球 19)·…·gazeY`；
  位移 `0.03/0.024` 或 `0.07/0.055`，再乘 `0.55·hold`。阻尼 `α = 1 − 0.86^(dt·60)`，
  收敛阈值 0.001。实测：一帧后 +1.386°，收敛 +9.9°（= 0.55 × 18°），
  位移收敛 0.017（= 0.55 × 0.03），与公式完全一致。
- **poke**：
  ```text
  spin  : duration 0.9 + 0.4·(turns−1)s，yaw = 180·turns·(1 − cos(πu))
  bounce: 0.62s，lift = 0.3·sin(π·clamp((u−0.14)/0.72))，squash 1.08 / 0.9（两端回弹窗）
  nod   : 0.5s，pitch = 16°·sin²窗口
  ```
  实测：spin 的四元数相对角在 0.45 s 到 180°、0.9 s 回到 0（整 360°）；
  bounce 峰值 0.3 / 1.08 / 0.9；nod 峰值 16°。
- **morph 拉正**：morph 激活时记录 `c = [round360(rot.x), round360(rot.y), round360(rot.z)]`，
  最终姿态按 `1 − amount` 向 `c` 插值，offset/squash 同权重收回。
  这就是 morph 时 mark 会"立正"、头身分离的数值原因。

### 3.5 弹簧与身体混合

```text
v += (−2·damping·stiffness·v − stiffness²·(x − target))·dt
x += v·dt
```

子步固定 1/120 s，通道参数：morph amount 14、swap 11、morph spin 14、身体 10（damping 均为 1）。
身体混合权重计算（`pe`）：`w = easeInOutCubic(spring.x)`，
旧身体权重 `×(1−w)`、新身体 `+w`，过滤 `w < 1e-4` 后归一化。

实测 sphere → star6：0.17 s 时 star6 权重 **0.677**，0.33 s 时 **0.99**，0.5 s 完成。
`pumpkin` 是例外：切换时不混合，直接替换（避免梗/眼洞错位）。

### 3.6 表情：几何 morph，不是贴图

`yi`（`:642`）里每个表情都是两段可变形 capsule 的点集（9 种：neutral/happy/surprised/
sad/sleepy/squinted/calm/inspecting/confused），morph 时按三种路径插值：

```text
stadium : 普通胶囊（同构）
spine   : 带折点的中心线
oval    : 逐渐椭圆化（ai），ovalMix 用 n³ 或 1−(1−n)³ 缓动，同时生成 fillRing
```

时长：表情 morph **0.28 s**；眨眼 **0.26 s**；"眨眼中穿表情" **0.35 s**（`lidMorph`）。
眨眼窗口（`ir`/`or`）：

```text
closeWindow = min(0.28, (2/60)/duration)     // 2 帧闭合
u1 = (1 − closeWindow)·0.42, u2 = u1 + closeWindow
amount = u<u1 ? smooth(u/u1) : u<=u2 ? 1 : 1 − smooth((u−u2)/(1−u2))
```

眨眼期间来的新表情会挂起（`ne` 里的 `O`），等眼睛睁开后再执行。
`inspecting` 权重来自视线 `x/20`，并让两只眼做非对称放大（歪头打量）。

实测：`happy` 在 0.28 s 内把眼宽 0 → 0.32、眼高 0.31 → 0.24（到 0.5 s 不再变化）。

### 3.7 morph：三条弹簧 + 2.5/1.5 节拍

`Ki`（`:890`）维护三条弹簧：`amount`(14)、`swap`(11)、`spin`(14)，以及：

```text
激活时随机选 ±1，spin 目标 += ±π（每次 morph 转半圈，方向随机）
progress : 保持 2.5s → 暂停 1.5s
spawning : 保持 2.0s → 暂停 1.5s
暂停时 amount 目标 = 0（部件淡出），恢复时 shot 时钟重置（_ = h）
state 时钟连续，shot 时钟按节拍重置
```

morph 期间 clip 时间乘以 `1 − amount`（实测 1 s 内只前进 **0.147 s**）；
`amount ≥ 0.5` 时眼睛隐藏。13 种 morph 各自有程序化装饰（`Dh`，`:9722`）：
点点、轨道、雷达、进度弧、聚拢、声波、发送/接收、停靠、弹跳、铅笔、惊叹、待机。

---

## 4. 与可读重建版的公式对照

重建版（`motionEngine.ts` + `reconstruction/*`）复刻了同样的**系统边界**，
但关键数值/公式是自己写的：

| 计算 | 真实引擎 | 重建版 |
| --- | --- | --- |
| clip 曲线 | 每条轨道独立关键帧（真实数据） | 5 个标量参数 → 固定 6 帧模板（`keyframes.ts:107`） |
| 桥接 | 0.35 s → 目标 **workArea 静止姿态** | 0.28 s → 目标片段的 **t=0 姿态**（`motionEngine.ts:33`） |
| clip 减速 | `1 − amount`（实测 0.147×） | `1 − 0.82·amount`（`:381`） |
| morph 暂停 | amount 淡出、shot 时钟重置 | 时钟冻结、amount 保持 1（实测 7 s 时钟只有 2.53） |
| morph 姿态 | 拉向整圈中性朝向、offset/squash 收回 | 无 |
| 视线因子 | 0.55·hold；阻尼 0.86^… | 同左（复刻正确） |
| 眨眼窗口 | 2 帧闭合；0.26 s | 同左（复刻正确） |
| 身体混合 | spring 10 + easeInOutCubic | 线性 0.22 s + smoothstep |
| 眼睛 | 体表座位 + SDF 等值线 | 椭圆 + 旋转/位移近似 |
| 形状 | 28 种 3D 体（旋转/挤出/放样/球并/点云） | 28 条二维参数曲线（`shapeGeometry.ts` 128 点） |
| poke | spin / bounce / nod | 仅 spin / bounce |

重建版的三个确定性偏差（前两个已实测）：

1. `#morphClock` 在恢复暂停时没有重置（`:460` 的赋值是恒等式），
   `progress`/`spawning` 的视觉时钟基本冻死；
2. 轮廓/时长是另一套数据：原始 28 个片段里 17 个时长、5 个参数曲线与真实数据不同；
3. 桥接目标是 t=0 而不是 workArea 静止姿态，切换观感更"硬"。

---

## 5. 设计取舍（计算层面）

1. **轮廓是"从中心可见"的混合近似**：旋转体/球并集走凸包，放样体走星形远点，
   只有挤出体用真正的布尔并。所以凹形只在挤出体上被完整保留（star6 实测凹度 0.776）。
2. **一切几何都落在 2D 多边形上**：3D 只用于投影，没有 z-buffer、没有三角化；
   椭圆/胶囊在最后一步被光栅化成路径。
3. **精度是被设计过的**：布尔 1/1024、路径 0.01、角度按显示尺寸量化到 0.25°~2°，
   换来缓存命中率和稳定输出。
4. **动作核心没有物理引擎**：曲线采样 + 若干条弹簧 + 交叉淡化，全部是可复现的纯函数；
   状态图只负责选片段和计时。
5. **表情是几何 morph**，眼睛形状本身在变，因此能做出"眯眼/睁大/椭圆化"的连续过渡；
   这也是为什么它需要 SDF 而不是固定图标。
6. **morph 是"全局姿态拉正 + 局部程序化装饰"**，不是独立动画层；
   所以 morph 时 mark 会停住并立正，装饰在周围动。

---

## 6. 复算方法（可复现）

```js
// 1) 看某一刻的姿态
const core = createMotionCore({ body: "sphere" });
const graph = createStateGraph(core, "listening", { seed: 7 });
for (let t = 0; t < 1.0783308131720428; t += 1 / 60) { graph.advance(1/60); core.advance(1/60); }
console.log(core.frame().quat);        // 与数据中的关键帧对照

// 2) 看几何
core.setBody("star6", { isInstant: true });
const tree = renderMarkScene(core.frame(), createAppearance("#1084fe"), 392.53, "m", { displaySize: 256, extent: "100%" });
// tree.children → defs/g/mask/path，可提取 d 并计算 bbox / 凹度

// 3) 看时序
core.setMorph("progress");
const m = core.frame().morph;          // { amount, spin, clock: { stateTime, shotTime }, ... }
```

三条入口都不依赖浏览器；改参数后可以离线验证曲线、弹簧、桥接、morph 节拍，
不必靠肉眼看动画。
