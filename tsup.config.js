import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    nextjs: "./src/nextjs.ts",
    workflow: "./src/client/workflow/index.ts",
    "workflow-nextjs": "./src/client/workflow/frameworks/nextjs.ts",
  },
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: false,
  clean: true,
  bundle: true,
  dts: true,
  external: ["next"],
});
