import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "entrypoints/nodejs.ts",
    nextjs: "entrypoints/nextjs.ts",
    cloudflare: "entrypoints/cloudflare.ts",
  },
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
});
