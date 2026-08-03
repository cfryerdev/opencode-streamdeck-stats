import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    file: "com.chrisfryer.opencode-stats.sdPlugin/bin/plugin.js",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [nodeResolve({ preferBuiltins: true }), commonjs(), typescript()],
};
