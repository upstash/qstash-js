import { dnt } from "../deps.ts";

const packageManager = "npm";
const outDir = "./dist";

await dnt.emptyDir(outDir);

await dnt.build({
  packageManager,
  entryPoints: [
    "platforms/nodejs.ts",
  ],
  outDir,
  shims: {
    deno: "dev",
    crypto: true,
  },
  typeCheck: true,
  test: typeof Deno.env.get("TEST") !== "undefined",

  package: {
    // package.json properties
    name: "@upstash/qstash",
    version: Deno.args[0],
    description: "Official Deno/Typescript client for qStash",
    repository: {
      type: "git",
      url: "git+https://github.com/upstash/sdk-qstash-ts.git",
    },
    keywords: ["qstash", "queue", "events", "serverless", "upstash"],
    author: "Andreas Thomas <dev@chronark.com>",
    license: "MIT",
    bugs: {
      url: "https://github.com/upstash/sdk-qstash-ts/issues",
    },
    homepage: "https://github.com/upstash/sdk-qstash-ts#readme",
    devDependencies: {
      "size-limit": "latest",
      "@size-limit/preset-small-lib": "latest",
    },

    /**
     * typesVersion is required to make imports work in typescript.
     * Without this you would not be able to import {} from "@upstash/redis/<some_path>"
     */
    typesVersions: {
      "*": {
        nodejs: "./types/platforms/nodejs.d.ts",
      },
    },

    "size-limit": [
      {
        path: "esm/platforms/nodejs.js",
        limit: "6 KB",
      },

      {
        path: "script/platforms/nodejs.js",
        limit: "10 KB",
      },
    ],
  },
});

// post build steps
Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
Deno.copyFileSync("README.md", `${outDir}/README.md`);
Deno.copyFileSync(".releaserc", `${outDir}/.releaserc`);

/**
 * Workaround because currently deno can not typecheck the built modules without `@types/node` being installed as regular dependency
 *
 * This removes it after everything is tested.
 */
await Deno.run({
  cwd: outDir,
  cmd: [packageManager, "uninstall", "@types/node"],
  stdout: "piped",
}).output();
