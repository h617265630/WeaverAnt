import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpathSync, statSync, existsSync } from "node:fs";
import { isAbsolute, join, parse } from "node:path";
import { homedir } from "node:os";

const execute = promisify(execFile);
let selecting = false;
export async function chooseProjectDirectory() {
  if (process.platform !== "darwin") throw new Error("当前系统请手动填写项目的绝对路径。");
  if (selecting) throw new Error("文件夹选择窗口已经打开，请先完成或取消选择。");
  selecting = true;
  try {
    const { stdout } = await execute("/usr/bin/osascript", ["-e", 'POSIX path of (choose folder with prompt "选择要在 WB 中继续开发的 Web 项目根目录")'], { timeout: 120000 });
    return { path: stdout.trim() };
  } catch (error) {
    if (String(error.stderr).includes("-128")) return { path: null };
    throw new Error("未能选择文件夹，请重试或手动填写路径。");
  } finally { selecting = false; }
}

export function validateLocalProject(value, forbidden = []) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input || !isAbsolute(input)) throw new Error("请填写项目文件夹的绝对路径。");
  let root;
  try {
    root = realpathSync(input);
    if (!statSync(root).isDirectory()) throw new Error();
  } catch { throw new Error("项目文件夹不存在或不可访问，请重新选择。"); }
  if ([parse(root).root, homedir(), ...forbidden].some((path) => {
    try { return realpathSync(path) === root; } catch { return false; }
  })) throw new Error("请选择具体的目标 Web 项目文件夹，不要选择系统根目录、个人目录或 WB 自身目录。");
  if (!["index.html", "dist/index.html", "package.json"].some((path) => {
    try { return existsSync(join(root, path)) && statSync(join(root, path)).isFile(); } catch { return false; }
  })) throw new Error("未找到 index.html、dist/index.html 或 package.json，请选择 Web 项目的根目录。");
  return root;
}
