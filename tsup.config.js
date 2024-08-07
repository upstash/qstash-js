import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    nextjs: "./src/nextjs.ts",
    workflow: "./src/client/workflow/index.ts",
    nextjs: "./platforms/nextjs.ts",
    nuxt: "./platforms/nuxt.ts",
    svelte: "./platforms/svelte.ts",
    solidjs: "./platforms/solidjs.ts",
  },
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: false,
  clean: true,
  bundle: true,
  dts: true,
  external: ["next"],
});
