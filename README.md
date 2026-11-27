# Avatar Grok Design

[English](README.md) | [简体中文](README.zh-CN.md)

An interactive motion study for the Grok Bot mark, packaged as an npm library.
The package ships ready-made looks, appearance configuration, and behaviour
actions, so another project can render the animated mark with a single import.

The repository also contains the interactive control surface used to design and
inspect every shape, color, and state.

## Screenshots

![Avatar Grok Design desktop interface](docs/screenshots/desktop.png)

## Features

- 59 animation states grouped by lifecycle, reactions, morphs, product, brand, and lab
- 28 procedural body shapes
- Lab: ghost/cookie bodies and sneeze/shiver/stretch/doze/pace/wink behaviours
- 11 preset ink colors plus custom hex colors
- 10 named presets that combine shape, ink, and an entrance state
- 14 behaviour actions with timing, chaining, and automatic return to rest
- React component and hook, plus a React-free DOM mount controller
- State-aware clips, facial presets, morphs, and bridge transitions
- Pointer-following gaze, blinking, squash, bob, spin, and poke effects
- Idle settling, reduced-motion support, and 30/60 FPS limits
- ESM + CJS builds, strict type declarations, and a shipped stylesheet
- Responsive, bilingual English and Chinese demo interface

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (the test runner asks for `>=22.12.0`)
- npm 10 or newer
- React `>=18.3` (peer dependency, only for the React entry point)

## Install the package

The package is consumed like any other dependency. Three ways to install it:

```bash
# From a local checkout
npm install ../avatar-grok-design

# From a packed tarball (works without a registry)
npm pack                # creates avatar-grok-design-0.2.0.tgz
npm install ./avatar-grok-design-0.2.0.tgz

# From a registry, after publishing
npm install avatar-grok-design
```

The stylesheet is part of the package and must be imported once:

```ts
import "avatar-grok-design/style.css";
```

### React

```tsx
import {
  GrokBotMark,
  createAvatarConfig,
  useGrokBotAvatar,
  type AgentFacts,
} from "avatar-grok-design";
import "avatar-grok-design/style.css";

export function AgentAvatar({ facts }: { facts: AgentFacts }) {
  const avatar = useGrokBotAvatar({ preset: "mint", size: 160, facts });

  return (
    <div>
      <GrokBotMark {...avatar.props} ref={avatar.ref} />
      <button onClick={() => avatar.play("celebrate")}>Celebrate</button>
      <button onClick={() => avatar.poke("bounce")}>Poke</button>
      <button onClick={() => avatar.setState("thinking")}>Think</button>
    </div>
  );
}
```

Without the hook, the component is fully controlled:

```tsx
import { GrokBotMark, createAvatarConfig } from "avatar-grok-design";

const config = createAvatarConfig({ preset: "ghost", size: 96 });

<GrokBotMark {...config} state="listening" followPointer />;
```

The imperative handle exposes the low-level accents:

```tsx
const mark = useRef<GrokBotMarkHandle>(null);

mark.current?.poke("bounce");
mark.current?.poke("spin", 2);
mark.current?.restart();
```

### Presets and configuration

Presets are plain data, so they can drive galleries and pickers. Each preset
bundles a body shape, an ink color, and an entrance state.

```ts
import {
  AVATAR_PRESETS,
  createAvatarConfig,
  listAvatarPresets,
  type AvatarConfig,
} from "avatar-grok-design";

const presetIds = Object.keys(AVATAR_PRESETS);
// classic, midnight, ember, mint, neon, ghost, cookie, starlight, sunset, brand

const config: AvatarConfig = createAvatarConfig({
  preset: "sunset", // shape + color + colorHex + initial state
  size: 180, // explicit values win over the preset
  followPointer: true,
});

// Every key maps 1:1 onto a component prop:
<GrokBotMark {...config} />;
```

Available configuration: `state`, `shape`, `color`, `colorHex`, `size`,
`paused`, `followPointer`, `settleIdle`, `maxFrameRate` (`30 | 60`), and
`reducedMotion`.

### Behaviour actions

Actions are short motion sequences with timing. The runner plays them on top of
the resting state and returns to the state that was active before the action
started, so an agent-driven state never gets lost.

```ts
import { AVATAR_ACTIONS, actionDurationMs, resolveAvatarAction } from "avatar-grok-design";

// greet, nod, celebrate, spin, think, search, code, success, failure,
// sleep, wake, alert, dance, listen
const action = resolveAvatarAction("success");
actionDurationMs(action); // total playback time in ms

const avatar = useGrokBotAvatar({ preset: "classic" });
avatar.play("success"); // plays finished → happy → idle
avatar.stop(); // cancels and restores the resting state
```

For non-React code the same scheduler is exported:

```ts
import { createAvatarActionRunner } from "avatar-grok-design/vanilla";

const runner = createAvatarActionRunner({
  getBaseState: () => mark.config.state,
  setState: (state) => mark.setState(state),
  onEffect: (kind) => mark.poke(kind),
});

runner.play("celebrate");
```

### Agent-driven state

Pass `AgentFacts` to the hook (or call `deriveMarkState` yourself) to follow the
agent lifecycle automatically. The derived state wins over the `state` option;
actions temporarily override both and return to the derived state when they end.

```ts
import { deriveMarkState } from "avatar-grok-design";

const state = deriveMarkState(agentFacts, Date.now(), surfaceFacts);
```

### Vanilla DOM, other frameworks

The `./vanilla` entry point has no React dependency and mounts the mark into any
element. It is suitable for Vue, Svelte, Angular, plain HTML, or a browser
extension.

```ts
import { mountGrokBotMark } from "avatar-grok-design/vanilla";
import "avatar-grok-design/style.css";

const mark = mountGrokBotMark("#stage", {
  preset: "ember",
  size: 200,
  followPointer: true,
});

mark.play("dance");
mark.setState("working");
mark.setShape("star");
mark.setColor("violet");
mark.poke("spin");
mark.destroy();
```

Reduced motion is detected automatically in the vanilla controller; override it
with `reducedMotion: false`.

### Low-level engine

Both entry points export the runtime primitives, for custom renderers or
non-DOM environments:

```ts
import {
  canonicalBody,
  createAppearance,
  createMarkEngine,
  getShapeGeometry,
  STATE_DEFINITIONS,
} from "avatar-grok-design/vanilla";
```

### Package exports

| Import                        | Contents                                                             |
| ----------------------------- | -------------------------------------------------------------------- |
| `avatar-grok-design`          | React component, hook, presets, actions, catalogs, engine primitives |
| `avatar-grok-design/vanilla`  | DOM mounting, presets, actions, catalogs, engine – no React           |
| `avatar-grok-design/style.css`| Component stylesheet                                                 |

The catalogs are exported as values for building your own UI:
`SHAPE_OPTIONS` (28), `COLOR_OPTIONS` (11 + hex), `MARK_STATE_GROUPS` (59),
`STATE_DEFINITIONS`, `MOTION_CLIPS`, `ACTIVITY_TO_STATE`, and `listMarkStates()`.

### Server rendering

`GrokBotMark` paints the real engine only in the browser; on the server it
renders the sized host element and hydrates on the client. For markup-only or
static SVG rendering, `SvgGrokBotMark` (the behavioural fallback renderer)
renders a complete SVG on the server as well.

In React Server Component frameworks, use `GrokBotMark` inside a client
component. The data exports (presets, actions, catalogs, `deriveMarkState`) have
no browser dependency and are safe to use on the server.

## Run the demo locally

```bash
npm install
npm run dev
```

Vite starts the demo at `http://127.0.0.1:4173`.

## Scripts

| Command                  | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `npm run dev`            | Demo dev server                                                 |
| `npm run build`          | Type-check, then build the package into `dist/`                 |
| `npm run build:lib`      | Package build only (Vite entries, declarations, assets)         |
| `npm run build:demo`     | Build the demo into `demo-dist/`                                |
| `npm run check`          | `tsc --noEmit`                                                  |
| `npm test`               | Vitest suite                                                    |
| `npm run preview`        | Preview the built demo                                          |
| `npm run verify:package` | Pack, install into a throwaway consumer, check ESM/CJS/types/CSS |

`npm run verify:package` is the end-to-end guard: it packs the tarball, installs
it into `.package-check/consumer/node_modules`, server-renders the React
component, requires the CJS entry, imports the React-free entry, and type-checks
a strict `nodenext` consumer against the published declarations.

## Package layout

```text
dist/
├─ index.js / index.cjs        React entry
├─ vanilla.js / vanilla.cjs    React-free entry
├─ avatar.css                  component stylesheet (avatar-grok-design/style.css)
└─ types/                      declaration tree for both entries
```

The standalone engine is bundled into a shared chunk that both entries import.

## Project structure

```text
src/
├─ index.ts                   React package entry
├─ vanilla.ts                 React-free package entry
├─ avatar/
│  ├─ index.ts                public API barrel
│  ├─ types.ts                shapes, colors, states, and frame types
│  ├─ presets.ts              named looks and resolved configuration
│  ├─ actions.ts              behaviour action catalog and runner
│  ├─ useGrokBotAvatar.ts     React hook for state, presets, and actions
│  ├─ vanilla.ts              React-free DOM mount controller
│  ├─ avatar.css              component stylesheet
│  ├─ stateModel.ts           agent facts to symbolic mark state
│  ├─ animationClips.ts       clip profiles and state definitions
│  ├─ shapeGeometry.ts        procedural shape paths and metrics
│  ├─ motionEngine.ts         simplified behavioral motion renderer
│  ├─ markEngine.ts           typed adapter for the standalone engine
│  ├─ MarkCanvas.tsx          React lifecycle and browser attachment
│  ├─ reconstruction/         motion primitives used by the fallback renderer
│  ├─ lab/                    new forms, engine data notes, and lab tests
│  └─ GrokBotMark.tsx         fallback UI and behavioural renderer
├─ engine/                    standalone Mark engine runtime and typings
├─ App.tsx                    interactive demo control surface
├─ i18n.ts                    English and Chinese demo copy
└─ styles.css                 demo layout; imports avatar.css

scripts/
├─ build-assets.mjs           copies engine typings and stylesheet into dist
└─ verify-package.mjs         end-to-end package verification
```

## State derivation

```ts
const state = deriveMarkState(agentFacts, Date.now(), surfaceFacts);
```

The derivation works as follows:

1. Running or composing agents use `streaming` or the current activity mapping.
2. `awaitingUserResponse` maps to `blocked`.
3. A recent successful or failed turn remains visible for eight seconds.
4. Roster facts take precedence over surface facts.
5. Otherwise, the mark returns to `idle`.

## Engine architecture

The state scheduler, clip sampler, facial state machine, morph springs, gaze
smoothing, and SVG projection are documented in
[`docs/mark-engine.zh-CN.md`](docs/mark-engine.zh-CN.md).

## Publishing

The package is intentionally marked `"private": true` so it cannot be published
by accident. To publish it:

1. Remove the `"private"` field from `package.json`.
2. Set `"license"`, `"repository"`, and `"author"` to match your project.
3. Run `npm publish` (the `prepublishOnly` script builds, tests, and verifies the
   tarball first).

Until then, install it with a local path or the packed tarball shown above.
