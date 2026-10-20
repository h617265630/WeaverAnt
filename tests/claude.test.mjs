import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import { ClaudeAgent } from "../server/claude.mjs";
import { Agents } from "../server/agents.mjs";
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "wb-claude-test-"));
  const store = new Store(directory);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return store;
}
function transport() {
  const calls = [];
  const spawnProcess = (binary, args, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = (signal) => { child.signal = signal; };
    child.line = (data) => child.stdout.write(JSON.stringify(data) + "\n");
    calls.push({ binary, args, options, child });
    return child;
  };
  return { calls, spawnProcess };
}
test("Claude streams, persists and resumes its own session without permission bypass", async (t) => {
  const store = fixture(t), mock = transport();
  const agent = new ClaudeAgent(store, { binary: "test-claude", spawnProcess: mock.spawnProcess });
  const page = store.create({ title: "测试" });
  const events = []; agent.on("event", (e) => events.push(e));
  const session = await agent.start(page.id, { key: "global" }, "你好");
  const child = mock.calls[0].child;
  child.line({ type: "system", session_id: "claude-id" });
  child.line({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "回复" } } });
  child.line({ type: "assistant", message: { content: [{ type: "text", text: "回复" }] } });
  child.line({ type: "result", is_error: false }); child.emit("close", 0);
  assert.equal(store.sessionById(session.id).status, "completed");
  assert.deepEqual(store.sessionById(session.id).messages.map((m) => m.text), ["你好", "回复"]);
  assert.ok(events.some((e) => e.type === "agent-delta" && e.delta === "回复"));
  assert.ok(!mock.calls[0].args.join(" ").includes("skip-permissions"));
  assert.ok(mock.calls[0].args.includes("--mcp-config"));
  await agent.start(page.id, { key: "global" }, "继续");
  assert.equal(mock.calls[1].args[mock.calls[1].args.indexOf("--resume") + 1], "claude-id");
  await agent.interrupt(session.id);
  assert.equal(mock.calls[1].child.signal, "SIGINT");
  mock.calls[1].child.emit("close", 130);
  assert.equal(store.sessionById(session.id).status, "interrupted");
});
test("Claude receives saved project standards and reference material", async (t) => {
  const store = fixture(t), mock = transport();
  const agent = new ClaudeAgent(store, { binary: "test-claude", spawnProcess: mock.spawnProcess });
  const page = store.create({ title: "规划测试", kind: "project", modules: [{ title: "开发规范", content: "先测试再交付" }, { title: "参考项目", content: "https://example.com" }] });
  await agent.start(page.id, { key: "global" }, "实现第一版");
  const prompt = mock.calls[0].child.stdin.read().toString();
  assert.match(prompt, /先测试再交付/);
  assert.match(prompt, /https:\/\/example.com/);
  agent.close();
});

test("Claude errors, permission denials and shutdown preserve truthful state", async (t) => {
  const store = fixture(t), mock = transport();
  const agent = new ClaudeAgent(store, { binary: "test-claude", spawnProcess: mock.spawnProcess });
  const page = store.create({ title: "测试" });
  const session = await agent.start(page.id, { key: "global" }, "测试");
  mock.calls[0].child.line({ type: "result", is_error: true, result: "authentication failed", permission_denials: [{ tool_name: "Edit" }] });
  mock.calls[0].child.emit("close", 1);
  assert.equal(store.sessionById(session.id).status, "failed");
  assert.match(store.sessionById(session.id).error, /authentication/);
  assert.match(store.sessionById(session.id).messages.at(-1).text, /权限限制/);
  await agent.start(page.id, { key: "global" }, "再试");
  agent.close();
  assert.equal(store.sessionById(session.id).status, "interrupted");
  mock.calls[1].child.emit("close", 143);
});
test("provider settings persist, old conversations stay pinned and engines share page lock", async (t) => {
  const store = fixture(t);
  const fake = () => Object.assign(new EventEmitter(), { start: async () => ({}), close() {}, status: async () => ({ available: true }) });
  const agents = new Agents(store, { codex: fake(), claude: fake() });
  agents.configure({ provider: "claude", claudeBinary: "claude" });
  const old = store.create({ title: "old" });
  store.appendMessage(store.session(old.id, { key: "global" }).id, "user", "旧对话");
  await agents.start(old.id, { key: "global" }, "继续");
  assert.equal(store.session(old.id, { key: "global" }).provider, "codex");
  await assert.rejects(() => agents.start(old.id, { key: "child" }, "冲突"), /任务正在执行/);
  const page = store.create({ title: "new" });
  await agents.start(page.id, { key: "global" }, "新对话");
  assert.equal(store.session(page.id, { key: "global" }).provider, "claude");
  const restored = new Agents(store, { codex: fake(), claude: fake() });
  assert.equal(restored.config.provider, "claude");
});
