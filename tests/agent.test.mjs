import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../server/store.mjs";
import { CodexAgent } from "../server/codex.mjs";
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "wb-agent-test-")),
    store = new Store(dir),
    agent = new CodexAgent(store);
  const calls = [];
  let n = 0;
  agent.connect = async () => {};
  agent.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "thread/start") return { thread: { id: `thread-${++n}` } };
    if (method === "turn/start") return { turn: { id: `turn-${n}` } };
    return {};
  };
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, agent, calls };
}
test("Codex receives scoped project context; streams and tool events are archived", async (t) => {
  const { store, agent, calls } = fixture(t);
  const page = store.create({ title: "测试项目", kind: "project", modules: [{ title: "开发规范", content: "规划规范测试：保持无障碍" }, { title: "参考项目", content: "https://example.com" }] });
  const session = await agent.start(
    page.id,
    { key: "card", label: "金额卡片", selector: "#amount" },
    "把这里改成蓝色",
  );
  const request = calls.find((c) => c.method === "turn/start");
  assert.ok(request.params.input[0].text.includes("#amount"));
  assert.ok(request.params.input[0].text.includes("规划规范测试：保持无障碍"));
  assert.ok(request.params.input[0].text.includes("https://example.com"));
  assert.equal(calls[0].params.cwd, page.rootPath);
  agent.receive({
    method: "item/agentMessage/delta",
    params: { threadId: session.threadId, itemId: "a", delta: "已修改" },
  });
  agent.receive({
    method: "item/completed",
    params: {
      threadId: session.threadId,
      item: { id: "a", type: "agentMessage", text: "已修改" },
    },
  });
  agent.receive({
    method: "turn/completed",
    params: {
      threadId: session.threadId,
      turn: { id: session.turnId, status: "completed" },
    },
  });
  const saved = store.sessionById(session.id);
  assert.equal(saved.messages.length, 2);
  assert.equal(saved.messages[1].text, "已修改");
  assert.equal(saved.status, "completed");
  assert.equal(store.rawEvents(session.id).length, 4);
  assert.ok(store.page(page.id).updates[0].content.summary.includes("已修改"));
});
test("whole-project and local threads are different; follow-up resumes the correct thread", async (t) => {
  const { store, agent, calls } = fixture(t);
  const p = store.create({ title: "项目", kind: "project" });
  const first = await agent.start(p.id, { key: "global" }, "整体");
  agent.receive({
    method: "turn/completed",
    params: { threadId: first.threadId, turn: { status: "completed" } },
  });
  const second = await agent.start(p.id, { key: "button" }, "局部");
  assert.notEqual(second.threadId, first.threadId);
  agent.receive({
    method: "turn/completed",
    params: { threadId: second.threadId, turn: { status: "completed" } },
  });
  const follow = await agent.start(p.id, { key: "global" }, "继续整体");
  assert.equal(follow.threadId, first.threadId);
  assert.equal(calls.filter((c) => c.method === "thread/start").length, 2);
});

test("quoted conversation selections reach the agent and resume independently from main chat", async (t) => {
  const { store, agent, calls } = fixture(t);
  const { page } = store.createChat({ title: "选段" });
  const main = await agent.start(page.id, { key: "global" }, "学习计划");
  agent.receive({
    method: "turn/completed",
    params: { threadId: main.threadId, turn: { status: "completed" } },
  });
  const anchor = {
    key: "text-test",
    kind: "text-selection",
    messageId: "original",
    blockIndex: 2,
    quote: "学习 GPIO",
    action: "question",
    label: "学习 GPIO",
  };
  const local = await agent.start(page.id, anchor, "请解释");
  const request = calls.filter((c) => c.method === "turn/start").at(-1);
  assert.ok(request.params.input[0].text.includes('"quote":"学习 GPIO"'));
  assert.notEqual(local.threadId, main.threadId);
  agent.receive({
    method: "turn/completed",
    params: { threadId: local.threadId, turn: { status: "completed" } },
  });
  const follow = await agent.start(page.id, anchor, "再举例");
  assert.equal(follow.threadId, local.threadId);
  assert.equal(store.sessionById(main.id).messages.length, 1);
  assert.equal(store.sessionById(local.id).anchor.messageId, "original");
});
test("simultaneous project writes are rejected and interrupted text is retained", async (t) => {
  const { store, agent } = fixture(t);
  const p = store.create({ title: "项目", kind: "project" });
  const first = await agent.start(p.id, { key: "global" }, "开始");
  await assert.rejects(
    () => agent.start(p.id, { key: "local" }, "另一个修改"),
    (e) => e.status === 409,
  );
  agent.receive({
    method: "item/agentMessage/delta",
    params: { threadId: first.threadId, itemId: "a", delta: "未完成的回复" },
  });
  agent.receive({
    method: "turn/completed",
    params: { threadId: first.threadId, turn: { status: "interrupted" } },
  });
  assert.equal(store.sessionById(first.id).messages.at(-1).partial, true);
  assert.equal(agent.busy.size, 0);
});
test("home conversations use read-only inbox and can call organization tools", async (t) => {
  const { store, agent, calls } = fixture(t);
  await agent.start(store.hub().id, { key: "global" }, "先帮我分析这个想法");
  assert.equal(calls[0].params.sandbox, "read-only");
  assert.ok(calls[0].params.developerInstructions.includes("wb_start_project"));
});
test("approvals are routed to the right session and never silently accepted", async (t) => {
  const { store, agent } = fixture(t);
  const p = store.create({ title: "项目", kind: "project" }),
    session = await agent.start(p.id, { key: "global" }, "开发");
  const outgoing = [];
  agent.send = (msg) => outgoing.push(msg);
  agent.receive({
    id: 99,
    method: "item/commandExecution/requestApproval",
    params: { threadId: session.threadId, command: "test-command" },
  });
  assert.equal(outgoing.length, 0);
  assert.equal(agent.approvals.size, 1);
  agent.respond("99", { approve: false });
  assert.deepEqual(outgoing[0], { id: 99, result: { decision: "decline" } });
});
