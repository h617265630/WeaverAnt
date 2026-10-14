import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
console.log(
  `[mcp_servers.wb]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(resolve(root, "server/mcp.mjs"))}]\n\n[mcp_servers.wb.env]\nWB_DATA_DIR = ${JSON.stringify(resolve(root, ".wb-data"))}`,
);
