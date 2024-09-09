import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "dist/base",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
  },
  {
    entry: {
      index: "src/client/workflow/index.ts",
    },
    outDir: "dist/workflow",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
  },
  {
    entry: {
      index: "platforms/nextjs.ts",
    },
    outDir: "dist/nextjs",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    external: ["next"],
  },
  {
    entry: {
      index: "platforms/h3.ts",
    },
    outDir: "dist/h3",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    external: ["h3"],
  },
  {
    entry: {
      index: "platforms/svelte.ts",
    },
    outDir: "dist/svelte",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    external: ["@sveltejs/kit"],
  },
  {
    entry: {
      index: "platforms/solidjs.ts",
    },
    outDir: "dist/solidjs",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    external: ["@solidjs/start"],
  },
  {
    entry: {
      index: "platforms/hono.ts",
    },
    outDir: "dist/hono",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    external: ["hono"],
  },
  {
    entry: {
      index: "platforms/cloudflare.ts",
    },
    outDir: "dist/cloudlfare",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
  },
]);
