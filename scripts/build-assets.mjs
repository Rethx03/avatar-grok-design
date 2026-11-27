import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Post-build step for the npm package.
 *
 * `vite build` emits the two JS entries, and `tsc` emits the declaration tree.
 * This script fills the gaps:
 *   1. the standalone engine ships as a hand-written `.d.ts`, which `tsc` never
 *      copies, so it is placed next to the declarations that import it;
 *   2. the component stylesheet is copied as `dist/avatar.css` (the package
 *      exposes it as `avatar-grok-design/style.css`).
 */

const root = process.cwd();
const dist = join(root, "dist");

const copy = (from, to) => {
  const target = join(dist, to);
  mkdirSync(join(target, ".."), { recursive: true });
  copyFileSync(join(root, from), target);
  console.log(`copied ${from} -> dist/${to}`);
};

copy("src/engine/mark-engine.d.ts", "types/engine/mark-engine.d.ts");
copy("src/avatar/avatar.css", "avatar.css");

const required = [
  "index.js",
  "index.cjs",
  "vanilla.js",
  "vanilla.cjs",
  "types/index.d.ts",
  "types/vanilla.d.ts",
  "types/avatar/markEngine.d.ts",
  "types/engine/mark-engine.d.ts",
  "avatar.css",
];

const missing = required.filter((file) => !existsSync(join(dist, file)));
if (missing.length > 0) {
  console.error(`build-assets: missing build output:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

console.log(`build-assets: package is complete (${required.length} artifacts checked)`);
