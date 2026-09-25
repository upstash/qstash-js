// Bundles the published entry points the way edge runtimes resolve them and
// fails if any Node.js builtin ends up in the graph.
//
// Vercel's edge analyzer rejects bundles that reference `node:` builtins; a
// dynamic `import("node:crypto")` in the receiver once broke middleware
// deploys that way. The receiver now gets Web Crypto from `uncrypto`, whose
// edge export conditions resolve to `globalThis.crypto`. This guards that it
// stays that way. Run after `bun run build` (reads ../dist).
import { builtinModules } from "node:module";
import { build } from "esbuild";

const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

// Condition sets as the runtimes' bundlers use them: Next.js / Vercel Edge
// resolve `edge-light`, then `worker` and `browser`; Wrangler resolves
// `workerd`, then `worker` and `browser`.
const VERCEL_EDGE = ["edge-light", "worker", "browser"];
const CLOUDFLARE = ["workerd", "worker", "browser"];

const targets = [
  { entry: "dist/index.mjs", conditions: VERCEL_EDGE },
  { entry: "dist/nextjs.mjs", conditions: VERCEL_EDGE },
  { entry: "dist/index.mjs", conditions: CLOUDFLARE },
  { entry: "dist/cloudflare.mjs", conditions: CLOUDFLARE },
];

let failed = false;

for (const { entry, conditions } of targets) {
  const offenders = new Set();
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    conditions,
    external: ["next", "next/*"],
    minify: false,
    logLevel: "silent",
    plugins: [
      {
        name: "flag-node-builtins",
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /.*/ }, ({ path, importer }) => {
            if (!builtins.has(path)) return;
            offenders.add(`${path} (imported by ${importer})`);
            return { path, external: true };
          });
        },
      },
    ],
  });

  // A computed `import(specifier)` never reaches onResolve, but Vercel's
  // analyzer still rejects the `node:` string it leaves behind.
  const code = result.outputFiles[0].text;
  for (const match of code.matchAll(/["'`](node:[\w/]+)/g)) {
    offenders.add(`${match[1]} (string literal in bundled output)`);
  }

  const label = `${entry} [${conditions.join(", ")}]`;
  if (offenders.size === 0) {
    console.log(`\u2713 ${label}`);
  } else {
    failed = true;
    console.error(`\u2717 ${label} pulls in Node.js builtins:`);
    for (const offender of offenders) console.error(`    ${offender}`);
  }
}

if (failed) process.exit(1);
console.log("No Node.js builtins in edge bundles.");
