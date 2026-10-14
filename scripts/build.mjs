import { build } from "vite";
await build();
await build({
  configFile: false,
  root: "examples/ledger",
  base: "./",
  build: { outDir: "../../.wb-build/ledger", emptyOutDir: true },
});
