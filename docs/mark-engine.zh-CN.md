# Grok Bot Mark 引擎架构

本文描述当前独立 Mark 引擎的运行结构。引擎入口位于
[`mark-engine.js`](../src/engine/grok-bot-mark/mark-engine.js)，React 适配位于
[`markEngine.ts`](../src/avatar/markEngine.ts) 和
[`MarkCanvas.tsx`](../src/avatar/MarkCanvas.tsx)。

## 分层

1. **浏览器适配层**：处理输入更新、尺寸监听、指针、可见性和 RAF。
2. **状态调度层**：将 53 个符号状态映射为动作片段、表情和 morph。
3. **运动核心**：采样关键帧，组合视线、poke、表情和 spring 姿态。
4. **场景投影层**：生成 26 种身体形状、眼睛和 morph 部件。
5. **SVG 差分层**：结构不变时只更新变化属性。

## 帧调度

RAF 控制器维护目标帧间隔：

```text
frameDuration = 1000 / maxFrameRate
deltaSeconds = (timestamp - lastPublishedAt) / 1000
deltaSeconds <= 0.1
```

不可见、页面隐藏或引擎已经稳定时停止推进。指针和组件输入会重新唤醒循环。

输入按字段比较，只更新受影响的子系统：

- `body` 触发形状混合；
- `state`、`clip`、`morph` 进入对应状态调度；
- `appearance` 和 `fill` 只触发重绘；
- `size` 重新绑定尺寸监听；
- `isFollowingPointer` 重新绑定指针监听；
- `maxFrameRate` 或 static 状态重建 RAF。

## 状态与动作片段

状态定义包含：

```ts
{
  clips: string[];
  compactClips?: string[];
  face?: Face;
  morph?: Morph;
  next?: State;
  holdSeconds?: number;
}
```

循环状态使用确定性 shuffle bag 选择动作片段，避免固定顺序循环。单次状态按照
声明顺序播放，结束后进入 `next`。

`blocked` 保持 120 秒后进入 `drowsy`；`waking` 保持 1.6 秒后进入 `idle`。

## 关键帧采样

动作片段包含 `position`、`rotation`、`scale`、`zoom`、`lids` 和
`expression` 轨道。数值轨道在两个关键帧之间使用 cubic-bezier：

```text
u <- clamp(u - (BezierX(u) - x) / BezierX'(u), 0, 1)
y = BezierY(u)
```

每段最多执行 8 次牛顿迭代。片段切换默认使用 0.28 秒桥接：

```text
easing = [0.4, 0, 0.2, 1]
from = 当前实时姿态
to = 目标片段静止姿态
```

旋转走最短角路径，桥接结束后才进入目标片段相位。

## 姿态组合

每帧姿态由以下部分组成：

```text
clip pose
+ gaze rotation / offset
+ poke pitch / yaw / lift
+ poke squash
```

### 视线

指针以 `width * 2` 为归一化分母，并限制到 `[-1, 1]`。阻尼与帧率无关：

```text
alpha = 1 - 0.86 ** (deltaSeconds / (1 / 60))
value += (target - value) * alpha
```

### Poke

- `spin`：`0.9 + 0.4 * (turns - 1)` 秒；
- `bounce`：0.62 秒；
- `nod`：0.5 秒。

多个 poke 可以同时叠加。

## 表情

眼睛由两段可变形 capsule 构成，依次经过表情 morph、inspecting 权重、眨眼收拢
和投影。

| 行为 | 时长 |
| --- | ---: |
| 表情 morph | 0.28 s |
| blink | 0.26 s |
| 眨眼穿越表情 | 0.35 s |

眨眼过程中收到的新表情请求会在眼睛重新打开后执行。

## Morph Spring

Morph 使用半隐式 spring：

```text
v += (-2 * damping * stiffness * v
      - stiffness² * (x - target)) * dt
x += v * dt
```

每帧按 `1 / 120` 秒切分积分子步。

| 通道 | stiffness | damping |
| --- | ---: | ---: |
| morph amount | 14 | 1 |
| morph spin | 14 | 1 |
| outgoing swap | 11 | 1 |
| body shape | 10 | 1 |

`progress` 运行 2.5 秒后暂停部件 1.5 秒；`spawning` 在 2 秒后执行相同循环。

## SVG 投影

场景投影负责：

- 球体与异形身体；
- cutout 眼睛和 painted 装饰；
- 眼睛 capsule；
- morph 圆环、粒子、轨迹和头身分离；
- 多 body 权重混合。

SVG 差分层缓存上一棵场景树。树结构相同时只写入变化属性，结构变化时才重建根节点。

## 验证

```bash
npm run check
npm test
npm run build
```

单元测试覆盖动作原语、状态、形状、颜色、引擎适配和组件状态推导。

## 范围

引擎负责 Mark 输入的姿态与 SVG 输出。桌面产品的数据源、IPC 和业务状态推导不在
该运行时范围内。
