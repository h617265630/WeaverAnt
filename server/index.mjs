import http from "node:http";
import { randomBytes } from "node:crypto";
import {
  readFileSync,
  existsSync,
  statSync,
  readdirSync,
  realpathSync,
  cpSync,
} from "node:fs";
import { resolve, join, extname, dirname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Store } from "./store.mjs";
import { CodexAgent } from "./codex.mjs";
import { renderPage, escapeHtml } from "./render.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
function staticFile(res, path) {
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(path)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(readFileSync(path));
}
function json(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 8 * 1024 * 1024)
      throw Object.assign(new Error("单次导入内容不能超过 8 MB"), {
        status: 413,
      });
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    throw new Error("请求内容不是有效 JSON");
  }
}
function filesIn(root) {
  const files = [];
  const walk = (directory, prefix = "", depth = 0) => {
    if (depth > 8 || files.length >= 1000) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (
        entry.name.startsWith(".") ||
        ["node_modules", "dist", "build", "coverage"].includes(entry.name) ||
        entry.isSymbolicLink()
      )
        continue;
      const path = join(directory, entry.name),
        relative = prefix + entry.name;
      if (entry.isDirectory()) walk(path, `${relative}/`, depth + 1);
      else if (entry.isFile()) {
        const stat = statSync(path);
        files.push({
          path: relative,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  };
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function startServer({
  port = Number(process.env.PORT || 4317),
  previewPort = Number(process.env.WB_PREVIEW_PORT || port + 1),
  directory = process.env.WB_DATA_DIR || join(ROOT, ".wb-data"),
  agentFactory,
} = {}) {
  const store = new Store(directory);
  store.recoverSessions();
  const token = randomBytes(24).toString("hex");
  const clients = new Set();
  const signatures = new Map(),
    previewSignatures = new Map();
  const agent = agentFactory ? agentFactory(store) : new CodexAgent(store);
  const broadcast = (event) => {
    for (const client of clients)
      client.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  agent.on("event", broadcast);
  const origin = `http://127.0.0.1:${port}`,
    previewOrigin = `http://127.0.0.1:${previewPort}`;
  function checkHost(req, expectedPort) {
    return [`127.0.0.1:${expectedPort}`, `localhost:${expectedPort}`].includes(
      req.headers.host,
    );
  }
  function scan(page, manual = false) {
    if (!page.rootPath || !existsSync(page.rootPath)) return;
    const files = filesIn(page.rootPath),
      signature = JSON.stringify(files);
    if (signatures.get(page.id) !== signature) {
      signatures.set(page.id, signature);
      const existing =
        page.pending.find((x) => x.category === "materials")?.content ||
        page.files;
      if (JSON.stringify(existing) !== signature)
        store.syncUpdate(page.id, "materials", files, manual);
      broadcast({ type: "files-changed", pageId: page.id });
    }
    const dist = join(page.rootPath, "dist");
    if (existsSync(dist) && statSync(dist).isDirectory()) {
      const built = JSON.stringify(filesIn(dist));
      if (previewSignatures.get(page.id) !== built) {
        previewSignatures.set(page.id, built);
        broadcast({ type: "files-changed", pageId: page.id });
      }
    }
    if (manual) store.flushSync(page.id);
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (!checkHost(req, port))
        return json(res, { error: "不允许的主机" }, 403);
      const url = new URL(req.url, origin);
      const path = url.pathname;
      if (path.startsWith("/api/")) {
        if (
          req.headers.origin &&
          ![origin, `http://localhost:${port}`].includes(req.headers.origin)
        )
          return json(res, { error: "不允许的来源" }, 403);
        if (
          req.headers["x-wb-token"] !== token &&
          !(path === "/api/events" && url.searchParams.get("token") === token)
        )
          return json(res, { error: "请从本机 WB 页面访问" }, 401);
        if (path === "/api/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write("retry: 2000\n\n");
          clients.add(res);
          const timer = setInterval(() => res.write(": heartbeat\n\n"), 20000);
          req.on("close", () => {
            clients.delete(res);
            clearInterval(timer);
          });
          return;
        }
        if (path === "/api/state" && req.method === "GET")
          return json(res, {
            pages: store.pages(),
            conversations: store.conversations(),
            events: store.events(),
            previewOrigin,
            version: "0.1.0",
          });
        if (path === "/api/chats" && req.method === "POST") {
          const chat = store.createChat(await body(req));
          broadcast({ type: "state-changed" });
          return json(res, chat, 201);
        }
        if (path === "/api/search" && req.method === "GET")
          return json(res, store.search(url.searchParams.get("q")));
        if (path === "/api/hub" && req.method === "POST") {
          const page = store.hub();
          return json(res, {
            page,
            session: store.session(page.id, {
              key: "global",
              label: "WB 总对话",
            }),
          });
        }
        if (path === "/api/agent/status")
          return json(res, await agent.status());
        if (path === "/api/agent/approvals" && req.method === "GET")
          return json(
            res,
            [...(agent.approvals?.values() || [])].map((r) => ({
              id: String(r.id),
              pageId: r.pageId,
              sessionId: r.sessionId,
              method: r.method,
              params: r.params,
            })),
          );
        if (path === "/api/agent/connect" && req.method === "POST") {
          await agent.connect();
          return json(res, await agent.status());
        }
        if (path === "/api/agent/turn" && req.method === "POST") {
          const input = await body(req);
          const session = await agent.start(
            input.pageId,
            input.anchor || { key: "global" },
            input.message,
          );
          return json(res, session);
        }
        if (path === "/api/agent/interrupt" && req.method === "POST") {
          await agent.interrupt((await body(req)).sessionId);
          return json(res, { ok: true });
        }
        if (path === "/api/agent/respond" && req.method === "POST") {
          const input = await body(req);
          agent.respond(input.id, input);
          return json(res, { ok: true });
        }
        if (path === "/api/pages" && req.method === "POST") {
          const page = store.create(await body(req));
          broadcast({ type: "state-changed" });
          return json(res, page, 201);
        }
        if (path === "/api/demo" && req.method === "POST") {
          const page = store.create({
            kind: "project",
            title: "小账本",
            summary:
              "一个用于体验全局开发与局部 AI 对话的记账 App 示例。所有金额和记录均为示例数据。",
            modules: [
              {
                title: "项目目标",
                content:
                  "让日常记账变得清晰、轻松。当前页面为可交互示例，可继续通过 Codex 增加功能。",
              },
              {
                title: "第一版开发计划",
                type: "tasks",
                items: [
                  { text: "基础概览与最近交易", done: true },
                  { text: "收入与支出记录", done: true },
                  { text: "月度预算功能" },
                  { text: "完善移动端体验" },
                ],
              },
              {
                title: "开发说明",
                content:
                  "在开发窗口底部发送全局指令；开启点选模式后，点击预览中的任意区域进行局部开发。WB 负责资料、记录与进度管理。",
              },
            ],
          });
          cpSync(join(ROOT, "examples/ledger"), page.rootPath, {
            recursive: true,
          });
          cpSync(join(ROOT, ".wb-build/ledger"), join(page.rootPath, "dist"), {
            recursive: true,
          });
          scan(page);
          broadcast({ type: "state-changed" });
          return json(res, page, 201);
        }
        const match = path.match(/^\/api\/pages\/([^/]+)(?:\/(.*))?$/);
        if (match) {
          const pageId = match[1],
            action = match[2] || "";
          if (!action && req.method === "GET")
            return json(res, {
              page: store.page(pageId),
              records: store
                .records(pageId)
                .map(({ raw, ...r }) => ({ ...r, length: raw.length })),
              sessions: store.sessions(pageId),
              versions: store.versions(pageId),
              events: store.events(pageId),
            });
          if (!action && req.method === "PATCH") {
            const input = await body(req);
            const page = store.update(
              pageId,
              input,
              "手动编辑",
              input.expectedRevision,
            );
            broadcast({ type: "state-changed", pageId });
            return json(res, page);
          }
          if (action === "promote" && req.method === "POST") {
            const page = store.promote(pageId, await body(req));
            broadcast({ type: "state-changed" });
            return json(res, page);
          }
          if (action === "records" && req.method === "POST") {
            const record = store.record(pageId, await body(req));
            broadcast({ type: "state-changed", pageId });
            return json(res, record);
          }
          if (action === "records" && req.method === "GET")
            return json(res, store.records(pageId));
          if (action === "sync" && req.method === "POST") {
            scan(store.page(pageId), true);
            const page = store.flushSync(pageId);
            broadcast({ type: "state-changed", pageId });
            return json(res, page);
          }
          if (action === "restore" && req.method === "POST") {
            const page = store.restore(pageId, (await body(req)).versionId);
            broadcast({ type: "state-changed", pageId });
            return json(res, page);
          }
          if (action === "export" && req.method === "GET") {
            const page = store.page(pageId);
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${page.id}.html"`,
            });
            return res.end(renderPage(page));
          }
          if (action === "session" && req.method === "POST") {
            const session = store.session(
              pageId,
              (await body(req)).anchor || { key: "global" },
            );
            return json(res, session);
          }
        }
        const sessionMatch = path.match(
          /^\/api\/sessions\/([^/]+)(?:\/(raw))?$/,
        );
        if (sessionMatch && req.method === "GET")
          return json(
            res,
            sessionMatch[2]
              ? store.rawEvents(sessionMatch[1])
              : store.sessionById(sessionMatch[1]),
          );
        return json(res, { error: "接口不存在" }, 404);
      }
      if (path === "/" || path === "/index.html") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src ${previewOrigin}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
        });
        return res.end(
          readFileSync(join(ROOT, "dist/index.html"), "utf8").replace(
            "__WB_TOKEN__",
            token,
          ),
        );
      }
      const file = resolve(ROOT, "dist", `.${path}`);
      if (
        !file.startsWith(join(ROOT, "dist") + sep) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      )
        return json(res, { error: "文件不存在" }, 404);
      staticFile(res, file);
    } catch (error) {
      json(res, { error: error.message }, error.status || 400);
    }
  });
  const preview = http.createServer((req, res) => {
    try {
      if (!checkHost(req, previewPort))
        return json(res, { error: "不允许的主机" }, 403);
      const url = new URL(req.url, previewOrigin);
      const path = decodeURIComponent(url.pathname);
      if (path === "/__wb/overlay.js")
        return staticFile(res, join(ROOT, "public/overlay.js"));
      const pageMatch = path.match(/^\/page\/([^/]+)$/);
      if (pageMatch) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'",
        });
        return res.end(renderPage(store.page(pageMatch[1])));
      }
      const match = path.match(/^\/app\/([^/]+)\/(.*)$/);
      if (!match) return json(res, { error: "预览不存在" }, 404);
      const page = store.page(match[1]);
      if (!page.rootPath) throw new Error("未绑定目标项目");
      const relative = match[2] || "index.html";
      if (
        relative
          .split("/")
          .some((x) => x.startsWith(".") || x === "node_modules")
      )
        return json(res, { error: "文件不可预览" }, 403);
      const projectRoot = realpathSync(page.rootPath);
      const root = existsSync(join(projectRoot, "dist/index.html"))
        ? realpathSync(join(projectRoot, "dist"))
        : projectRoot;
      const file = resolve(root, relative);
      if (root !== projectRoot && !root.startsWith(projectRoot + sep))
        return json(res, { error: "预览目录不可指向项目外" }, 403);
      if (!file.startsWith(root + sep))
        return json(res, { error: "路径不可访问" }, 403);
      if (!existsSync(file)) {
        if (relative !== "index.html")
          return json(res, { error: "文件不存在" }, 404);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(
          `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;display:grid;place-content:center;height:100vh;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;text-align:center;color:#28353b}.icon{font-size:48px;color:#739380}h1{font-size:26px;font-weight:500}p{font-size:14px;color:#8a9399;line-height:1.8}</style><div class="icon">✧</div><h1>从第一条开发指令开始</h1><p>「${escapeHtml(page.title)}」的开发空间已就绪。<br>在下方告诉 Codex 你想做什么，页面将在这里出现。</p></html>`,
        );
      }
      const real = realpathSync(file);
      if (
        !real.startsWith(root + sep) ||
        !statSync(real).isFile() ||
        !contentTypes[extname(real)]
      )
        return json(res, { error: "文件不可预览" }, 403);
      if (extname(real) === ".html") {
        const html = readFileSync(real, "utf8");
        const script = `<script src="/__wb/overlay.js" data-wb-parent="${origin}" data-wb-source="${escapeHtml(relative)}"></script>`;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": `frame-ancestors ${origin}; object-src 'none'`,
        });
        return res.end(
          html.includes("</body>")
            ? html.replace("</body>", script + "</body>")
            : html + script,
        );
      }
      staticFile(res, real);
    } catch (error) {
      json(res, { error: error.message }, 400);
    }
  });
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(port, "127.0.0.1", yes);
  });
  try {
    await new Promise((yes, no) => {
      preview.once("error", no);
      preview.listen(previewPort, "127.0.0.1", yes);
    });
  } catch (error) {
    server.close();
    store.close();
    throw error;
  }
  let latest = store.events()[0]?.id || 0;
  const poll = setInterval(() => {
    try {
      for (const page of store.pages().filter((p) => p.kind === "project")) {
        scan(page);
        if (page.bootstrap?.status === "queued") {
          const prompt = store.claimBootstrap(page.id);
          if (prompt) {
            broadcast({ type: "project-ready", pageId: page.id });
            agent
              .start(page.id, { key: "global", label: "全局开发" }, prompt)
              .then(() => store.bootstrapStatus(page.id, "started"))
              .catch((error) => {
                store.bootstrapStatus(page.id, "failed", error.message);
                broadcast({
                  type: "bootstrap-error",
                  pageId: page.id,
                  message: error.message,
                });
              });
          }
        }
      }
      const events = store.events();
      const next = events[0]?.id || 0;
      if (next !== latest) {
        for (const event of events.filter(
          (e) => e.id > latest && e.type === "project-ready",
        ))
          broadcast({ type: "project-ready", pageId: event.pageId });
        latest = next;
        broadcast({ type: "state-changed" });
      }
    } catch (error) {
      broadcast({ type: "sync-error", message: error.message });
    }
  }, 2000);
  return {
    store,
    agent,
    token,
    origin,
    previewOrigin,
    server,
    preview,
    close: async () => {
      clearInterval(poll);
      agent.close();
      for (const client of clients) client.end();
      await Promise.all([
        new Promise((r) => server.close(r)),
        new Promise((r) => preview.close(r)),
      ]);
      store.close();
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = await startServer();
  console.log(`WB Workspace · ${app.origin}\n开发预览 · ${app.previewOrigin}`);
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
