import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    node: "./src/entrypoints/node.ts",
    cloudflare: "./src/entrypoints/cloudflare.ts", 
    "nextjs-edge": "./src/entrypoints/nextjs-edge.ts", 
    "nextjs-serverless": "./src/entrypoints/nextjs-serverless.ts", 
  },
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
});
