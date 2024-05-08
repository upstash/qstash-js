import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./index.ts"],
  format: ["cjs", "esm"],
  splitting: true,
  sourcemap: false,
  clean: true,
  bundle: true,
  dts: true,
  external: ["next"],
});
