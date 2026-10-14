// Explicitly opt-in: this test uses the current Codex account for one tiny turn.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { Store } from "../server/store.mjs";
import { CodexAgent } from "../server/codex.mjs";
const directory = mkdtempSync(join(tmpdir(), "wb-codex-smoke-"));
const store = new Store(directory),
  agent = new CodexAgent(store);
let timer;
try {
  const result = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("Codex smoke test timed out")),
      120000,
    );
    agent.on("event", (event) => {
      if (event.type === "approval") {
        agent.respond(event.id, { approve: false });
      }
      if (event.type === "turn-completed") resolve(event);
    });
  });
  const session = await agent.start(
    store.hub().id,
    { key: "global" },
    "这是只读集成测试。只调用一次 WB 的 wb_list_pages 工具，然后只回复 WB_READY。不要更新任何页面，不要创建文件、项目或运行其他工具。",
  );
  const event = await result;
  const saved = store.sessionById(session.id),
    raw = store.rawEvents(session.id);
  console.log(
    JSON.stringify({
      status: event.status,
      messages: saved.messages.length,
      reply: saved.messages.at(-1)?.text,
      mcpCalled: raw.some((r) => JSON.stringify(r).includes("wb_list_pages")),
      protocolEvents: raw.length,
      error: event.error,
    }),
  );
  if (event.status !== "completed") process.exitCode = 1;
} finally {
  clearTimeout(timer);
  const child = agent.child;
  const closed = child
    ? once(child, "exit").catch(() => {})
    : Promise.resolve();
  agent.close();
  await closed;
  store.close();
  rmSync(directory, { recursive: true, force: true });
}
