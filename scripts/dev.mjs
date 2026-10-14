import { build } from "vite";
import { startServer } from "../server/index.mjs";
await build();
await build({
  configFile: false,
  root: "examples/ledger",
  base: "./",
  build: { outDir: "../../.wb-build/ledger", emptyOutDir: true },
});
const watcher = await build({ build: { watch: {} } });
const app = await startServer();
console.log(
  `WB React 开发环境 · ${app.origin}\n前端文件保存后自动构建，刷新浏览器即可查看。`,
);
const stop = async () => {
  await watcher.close();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
