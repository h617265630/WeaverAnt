// Test-only transport. This file is never imported by the production server.
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server/index.mjs";
class TestAgent extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.approvals = new Map();
  }
  async status() {
    return {
      available: true,
      connected: true,
      signedIn: true,
      version: "TEST TRANSPORT — NOT A REAL MODEL",
    };
  }
  async connect() {}
  async start(pageId, anchor, message) {
    let session = this.store.session(pageId, anchor);
    this.store.appendMessage(session.id, "user", message);
    session = this.store.sessionById(session.id);
    session.status = "running";
    this.store.saveSession(session);
    if (message === "测试流式结构") {
      const parts = [
        "# 流式方案\n\n第一段已经到达。\n\n- App：先验证需求\n- 硬件：后续实现\n\n",
        "| 阶段 | 内容 |\n| --- | --- |\n| MVP | 测试 |\n\n```js\nconst result =",
        " true;\n```\n\n<script>window.__unsafe = true</script>",
      ];
      parts.forEach((delta, index) =>
        setTimeout(
          () => {
            this.emit("event", {
              type: "agent-delta",
              pageId,
              sessionId: session.id,
              itemId: `stream-${session.id}`,
              delta,
            });
            if (index === parts.length - 1) {
              this.store.appendMessage(session.id, "assistant", parts.join(""));
              const latest = this.store.sessionById(session.id);
              latest.status = "completed";
              this.store.saveSession(latest);
              this.emit("event", {
                type: "message-completed",
                pageId,
                sessionId: session.id,
                itemId: `stream-${session.id}`,
              });
              this.emit("event", {
                type: "turn-completed",
                pageId,
                sessionId: session.id,
                status: "completed",
              });
            }
          },
          200 + index * 1600,
        ),
      );
      return session;
    }
    const itemId = `test-${session.id}-${session.messages.length}`;
    const answer =
      anchor.kind === "text-selection"
        ? anchor.action === "resources"
          ? "选段资源：[参考资料](https://example.com/selection)"
          : "针对引用内容的回答：" + anchor.quote
        : message === "测试资源收纳"
          ? "参考 [示例文档](https://example.com/guide)。"
          : "测试回复：已接收。";
    setTimeout(() => {
      if (message === "测试资源收纳") {
        const item = {
          id: `search-${session.id}`,
          type: "webSearch",
          action: { type: "openPage", url: "https://example.com/source" },
        };
        this.store.rawEvent(session.id, {
          method: "item/completed",
          params: { item },
        });
        this.emit("event", {
          type: "tool",
          pageId,
          sessionId: session.id,
          item,
        });
      }
      this.emit("event", {
        type: "turn-started",
        pageId,
        sessionId: session.id,
      });
      this.emit("event", {
        type: "agent-delta",
        pageId,
        sessionId: session.id,
        delta: answer,
        itemId,
      });
      this.store.appendMessage(session.id, "assistant", answer);
      session = this.store.sessionById(session.id);
      session.status = "completed";
      this.store.saveSession(session);
      this.emit("event", {
        type: "message-completed",
        itemId,
        pageId,
        sessionId: session.id,
      });
      this.emit("event", {
        type: "turn-completed",
        pageId,
        sessionId: session.id,
        status: "completed",
      });
      if (message === "测试启动项目") {
        const page = this.store.create({
          title: "聊天启动的项目",
          kind: "project",
        });
        this.emit("event", { type: "project-ready", pageId: page.id });
      }
    }, 100);
    return session;
  }
  close() {}
}
const directory = mkdtempSync(join(tmpdir(), "wb-browser-test-"));
const app = await startServer({
  port: 4547,
  previewPort: 4548,
  directory,
  agentFactory: (store) => new TestAgent(store),
});
console.log("Browser test server ready");
const stop = async () => {
  await app.close();
  rmSync(directory, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
