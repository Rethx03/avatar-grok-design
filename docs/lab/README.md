# Lab：新增的 2 个形象与 6 个行为

这些不是"设计稿"，而是已经补进真实渲染器的数据：应用里的 `MarkCanvas` 会直接渲染它们，
状态面板的 **Lab** 页签新增了行为，身体网格从 26 个变成 28 个。

- 真实引擎渲染预览：[real-engine-preview.html](real-engine-preview.html)
- 形象源数据：[`src/avatar/lab/forms.ts`](../../src/avatar/lab/forms.ts)
- 引擎数据：[`src/engine/mark-engine.js`](../../src/engine/mark-engine.js)

> 猫耳和橡果已经移除；`shy` 已还原成原来的 `Idle_D + calm` 情绪动作，
> 不再带专属片段、shy 眼型或腮红。

## 一、补进真实引擎的数据

### 1. 身体（`ds` / `js` / `Za` / `wr`）

| 身体 | `ds` 二维轮廓 | `js` 三维定义 | 眼睛座位 | 90° 宽度保留 |
| --- | --- | --- | --- | ---: |
| `ghost` 幽灵 | 圆顶 + 五条扇贝下摆的自定义 path | loft，深度 .9（`Us`） | loft | 0.90 |
| `cookie` 饼干 | 圆 + 右上高斯咬痕 | 非凸挤出（.36 / .22） | front | 0.37 |

`Za` 新增了 2 组眼睛度量（`width/height/gap/shiftY`）；`wr` 白名单加入 2 个名字，
使片段 body 校验与缺省回退都能识别。幽灵是立体 loft；饼干保持扁平（饼干本来就扁）。

### 2. 行为（`Aa` / `Na` / `__labClip`）

真实引擎的片段需要完整的轨道数据。这里没有手写几十条关键帧，而是加了一个
`__labClip(name, duration, options)` 生成器，在模块加载时生成 9 个片段：

```text
Sneeze_A .55s  pitch -10, 轻微后仰
Sneeze_B .22s  pitch +22, squash .13, 一次眨眼
Sneeze_C .50s  pitch +3, 收敛
Shiver_A 1.0s  cycles 6（每秒 6 个周期）, wobble 1.3, 不眨眼
Stretch_A 1.5s pitch -8, bob 1.7, squash .09
Stretch_B .6s  pitch -2, 收敛
Doze_A   4.5s  pitch 1.2, 极低幅度, 不眨眼
Pace_A   2.4s  cycles 2, swayX .1（左右 ±0.1）, yawWave 16
Wink_A   0.8s  pitch 2, 单眼 wink 表情
```

生成器输出真实引擎的轨道格式：`position`、`rotation`（含 pitch/yaw/roll）、`scale`(zoom)、
可选 `squash`、`expression`（blink），并带 `workArea`/`inspect`。

状态表 `Na` 新增：

```js
sneeze : clips [Sneeze_A,B,C], face squinted,          next idle
shiver : clips [Shiver_A],     face surprised, hold 2.4, next idle
stretch: clips [Stretch_A, Stretch_B], face sleepy,     next idle
doze   : clips [Doze_A],       face sleepy, hold 5.5,   next waking
pace   : clips [Pace_A],       face calm, hold 4,       next idle
wink   : clips [Wink_A],       face wink,               next idle
```

`Sneeze_A → B` 的急冲不是一条爆发曲线，而是 **0.35 s 桥接把一个 clip 的 pitch 带到下一个**，
和原引擎切换片段的机制完全一致。`Pace_A` 的 `swayX` 让位置在 ±0.1 之间往返，
`yawWave 16` 让身体朝行进方向侧转。

### 3. 新表情（wink）

- `Br.wink`：左眼保持竖胶囊，右眼压成横线，形成单眼眨眼；`Er` 接受 `wink`。
- `Wink_A` 使用该表情，一次性播放 0.8s 后回 idle。

## 二、UI 接入

- `types.ts`：`SHAPE_OPTIONS` +2；`Lab` 组加入 `pace`/`wink`。
- `i18n.ts`：中英文的身体、状态、表情（wink）标签。
- `shapeGeometry.ts`：可读渲染器的 28 个形状支持（`getLabForm()` 复用同一套半径函数）。
- 可读渲染器也补了 wink 眼型，保持两套实现观感接近。

## 三、实测（真实引擎，`createMotionCore` + `createStateGraph` + `renderMarkScene`）

28 个身体全部渲染成功，每个都是 3 条 path + 1 个 mask + 2 只眼（pumpkin 5 条，sphere 1 条）。
引擎总数为 **28 个身体 / 37 个片段 / 59 个状态**。

| 状态 | 状态迁移 | face | 观测 |
| --- | --- | --- | --- |
| `sneeze` | 2.02s → idle | squinted | 俯仰 −9.5° → +22° → +4° |
| `shiver` | 2.42s → idle | surprised | 1 秒 6 个 roll 峰 |
| `stretch` | 2.48s → idle | sleepy | clip 内后仰约 −10° |
| `doze` | 5.52s → waking → 7.13s idle | sleepy | 低幅呼吸 |
| `pace` | 4.02s → idle | calm | 位置 x 在 −0.10 ~ +0.10 往返 |
| `wink` | 0.82s → idle | wink | 单眼闭合，另一眼保持 |

## 四、验证

```bash
npx tsc --noEmit     # 通过
npm run build        # 需在本地运行；受限沙箱里 Vite/Vitest 会因 spawn EPERM 失败
```

`src/avatar/lab/lab.test.ts` 覆盖可读引擎版本的路径/半径/状态时序；
真实引擎的验证脚本以无头方式跑过（见上方表格）。

## 五、代码位置

新增代码集中在 `__lab*` 区块与各数据表的末尾，便于审阅或回退。
