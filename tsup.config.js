import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    workflow: "./src/client/workflow/index.ts",
    nextjs: "./platforms/nextjs.ts",
    h3: "./platforms/h3.ts",
    nuxt: "./platforms/nuxt.ts",
    svelte: "./platforms/svelte.ts",
    solidjs: "./platforms/solidjs.ts",
    hono: "./platforms/hono.ts",
    cloudflare: "./platforms/cloudflare.ts",
  },
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: false,
  clean: true,
  bundle: true,
  dts: true,
  external: ["next"],
});
