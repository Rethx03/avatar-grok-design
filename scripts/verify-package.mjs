import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Proves that the packed tarball is usable by another project.
 *
 * It packs the package, installs the tarball into a throwaway consumer
 * directory (without touching the registry), then checks that:
 *   - the published file list is complete;
 *   - the ESM entry imports and server-renders in plain Node;
 *   - the CJS entry can be required;
 *   - the React-free `./vanilla` entry loads without a DOM;
 *   - the stylesheet is shipped;
 *   - the declarations type-check in a strict `nodenext` consumer.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const work = join(root, ".package-check");
const consumer = join(work, "consumer");
const pkgName = "avatar-grok-design";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;

const runNpm = (args, options = {}) =>
  npmCli !== undefined && npmCli.endsWith(".js")
    ? run(process.execPath, [npmCli, ...args], options)
    : run(npm, args, { shell: process.platform === "win32", ...options });

const fail = (message) => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

const run = (file, args, options = {}) => {
  try {
    return execFileSync(file, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    fail(`command failed: ${file} ${args.join(" ")}\n${output}`);
    return "";
  }
};

const heading = (text) => console.log(`\n▸ ${text}`);

// 1. The build must already exist, so verification never silently passes on a
//    stale or missing dist directory.
heading("checking build output");
const requiredArtifacts = [
  "dist/index.js",
  "dist/index.cjs",
  "dist/vanilla.js",
  "dist/vanilla.cjs",
  "dist/avatar.css",
  "dist/types/index.d.ts",
  "dist/types/vanilla.d.ts",
  "dist/types/engine/mark-engine.d.ts",
];
for (const artifact of requiredArtifacts) {
  assert(existsSync(join(root, artifact)), `missing ${artifact}; run "npm run build" first`);
}
console.log(`  ${requiredArtifacts.length} artifacts present`);

// 2. Pack the tarball exactly as `npm publish` would.
heading("packing tarball");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const packOutput = runNpm(["pack", "--json", "--pack-destination", work]);
const jsonStart = packOutput.indexOf("[");
const jsonEnd = packOutput.lastIndexOf("]");
assert(jsonStart !== -1 && jsonEnd !== -1, `unexpected npm pack output:\n${packOutput}`);
const packJson = JSON.parse(packOutput.slice(jsonStart, jsonEnd + 1));
const packed = packJson[0];
assert(packed !== undefined, "npm pack returned no result");
const tarball = join(work, packed.filename);
const shipped = new Set(packed.files.map((file) => file.path));
const expectedFiles = [
  "package.json",
  "dist/index.js",
  "dist/index.cjs",
  "dist/vanilla.js",
  "dist/vanilla.cjs",
  "dist/avatar.css",
  "dist/types/index.d.ts",
  "dist/types/vanilla.d.ts",
  "dist/types/avatar/index.d.ts",
  "dist/types/avatar/vanilla.d.ts",
  "dist/types/engine/mark-engine.d.ts",
];
for (const file of expectedFiles) {
  assert(shipped.has(file), `tarball is missing ${file}`);
}
assert(
  ![...shipped].some((file) => file.startsWith("src/")),
  "tarball must not ship the source tree",
);
console.log(`  ${packed.filename}: ${packed.size} bytes, ${packed.files.length} files`);

// 3. Extract the tarball into a consumer project. Node resolves `react` from
//    the repository's node_modules by walking up, so no registry access occurs.
heading("installing tarball into a throwaway consumer");
const installed = join(consumer, "node_modules", pkgName);
mkdirSync(join(consumer, "node_modules"), { recursive: true });
run("tar", ["-xzf", tarball, "-C", consumer]);
const extracted = join(consumer, "package");
assert(existsSync(extracted), "tarball extraction produced no package/ directory");
renameSync(extracted, installed);
console.log(`  installed into .package-check/consumer/node_modules/${pkgName}`);

writeFileSync(join(consumer, "package.json"), JSON.stringify({ type: "module" }, null, 2));

// 4. ESM + server rendering.
writeFileSync(
  join(consumer, "esm.mjs"),
  `import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as api from "${pkgName}";
import {
  AVATAR_ACTIONS,
  AVATAR_PRESETS,
  GrokBotMark,
  createAvatarConfig,
  deriveMarkState,
} from "${pkgName}";

const names = Object.keys(api);
if (!names.includes("GrokBotMark")) throw new Error("GrokBotMark is not exported");
if (typeof api.useGrokBotAvatar !== "function") throw new Error("useGrokBotAvatar is not exported");
if (Object.keys(AVATAR_PRESETS).length < 5) throw new Error("presets are missing");
if (Object.keys(AVATAR_ACTIONS).length < 5) throw new Error("actions are missing");

const config = createAvatarConfig({ preset: "ghost", size: 96 });
if (config.shape !== "ghost" || config.size !== 96) throw new Error("preset merge failed");
if (deriveMarkState({ isRunning: true, currentActivity: { verb: "coding" } }, Date.now()) !== "coding") {
  throw new Error("state derivation failed");
}

const styleUrl = import.meta.resolve("${pkgName}/style.css");
if (!styleUrl.endsWith("avatar.css")) {
  throw new Error("the ./style.css export does not resolve to avatar.css");
}

const html = renderToStaticMarkup(
  createElement(GrokBotMark, { ...config, state: "idle", ariaLabel: "server mark" }),
);
if (!html.includes("grok-bot-mark")) throw new Error("mark did not render");
if (!html.includes("width:96px")) throw new Error("size was not applied");

console.log(\`  ESM ok: \${names.length} exports, SSR html \${html.length} chars\`);
`,
);

// 5. CJS require.
writeFileSync(
  join(consumer, "cjs.cjs"),
  `const api = require("${pkgName}");
if (typeof api.GrokBotMark !== "object") throw new Error("CJS entry has no GrokBotMark");
if (typeof api.createAvatarConfig !== "function") throw new Error("CJS entry has no createAvatarConfig");
console.log("  CJS ok: " + Object.keys(api).length + " exports");
`,
);

// 6. React-free vanilla entry, loaded in Node (no DOM at import time).
writeFileSync(
  join(consumer, "vanilla.mjs"),
  `import * as vanilla from "${pkgName}/vanilla";
if (typeof vanilla.mountGrokBotMark !== "function") throw new Error("mountGrokBotMark is missing");
if (vanilla.AVATAR_PRESETS.classic.shape !== "blob") throw new Error("catalogs are missing");
if (typeof vanilla.createMarkEngine !== "function") throw new Error("engine is missing");
if ("useGrokBotAvatar" in vanilla) throw new Error("vanilla entry must stay React-free");
console.log("  vanilla ok: " + Object.keys(vanilla).length + " exports");
`,
);

// 7. Strict TypeScript consumer using nodenext resolution.
writeFileSync(
  join(consumer, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "nodenext",
        moduleResolution: "nodenext",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
      },
      include: ["consumer.tsx"],
    },
    null,
    2,
  ),
);

writeFileSync(
  join(consumer, "consumer.tsx"),
  `import {
  AVATAR_ACTIONS,
  AVATAR_PRESETS,
  GrokBotMark,
  createAvatarConfig,
  useGrokBotAvatar,
  type AvatarConfig,
  type AvatarPresetId,
  type BotShape,
  type GrokBotMarkHandle,
  type MarkState,
} from "${pkgName}";
import {
  createAvatarActionRunner,
  mountGrokBotMark,
  type AvatarActionId,
} from "${pkgName}/vanilla";

const config: AvatarConfig = createAvatarConfig({ preset: "neon", size: 120 });
const presetId: AvatarPresetId = "ghost";
const actionId: AvatarActionId = "greet";
const shape: BotShape = AVATAR_PRESETS[presetId].shape;
const state: MarkState = AVATAR_ACTIONS[actionId].steps[0].state;

export const Demo = () => {
  const avatar = useGrokBotAvatar({ preset: "mint" });
  return <GrokBotMark {...avatar.props} ref={avatar.ref} />;
};

export const mount = (element: HTMLElement) =>
  mountGrokBotMark(element, { preset: "classic" });

export const runner = createAvatarActionRunner({
  getBaseState: () => "idle",
  setState: (next) => void next,
});

export type Handle = GrokBotMarkHandle | null;
export const installed = { config, shape, state, runner };
`,
);

heading("running consumer checks");
for (const file of ["esm.mjs", "cjs.cjs", "vanilla.mjs"]) {
  console.log(`  $ node ${file}`);
  run(process.execPath, [file], { cwd: consumer, stdio: "inherit" });
}

heading("type-checking a strict nodenext consumer");
run(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], {
  cwd: consumer,
  stdio: "inherit",
});
console.log("  types ok");

heading("checking stylesheet");
const css = readFileSync(join(installed, "dist", "avatar.css"), "utf8");
assert(css.includes(".grok-bot-mark"), "stylesheet is missing the mark rules");
assert(css.includes(".grok-bot-mark__canvas"), "stylesheet is missing the canvas rules");
console.log(`  avatar.css ok (${css.length} bytes)`);

console.log("\n✓ package verification passed");
console.log(`  tarball: ${tarball}`);
console.log("  install in another project with:");
console.log(`    npm install ${tarball}`);
