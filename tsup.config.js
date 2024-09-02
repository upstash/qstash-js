import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "dist/base",
    format: "esm",
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
    format: "esm",
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
    format: "esm",
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
    format: "esm",
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
    format: "esm",
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
    format: "esm",
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
    format: "esm",
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
    outDir: "dist/cloudflare",
    format: "esm",
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
  },
]);
