import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import { renderPage } from "../server/render.mjs";
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "wb-store-test-"));
  const store = new Store(directory);
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return store;
}
test("saved highlights preserve full text and source and deduplicate within a page", (t) => {
  const s = fixture(t);
  const page = s.create({ title: "重点测试" });
  const input = { kind: "highlight", title: "重点", raw: "完整原文\n第二行", source: { messageId: "message-1", sessionId: "session-1", parentThreadKey: "thread-1" } };
  const saved = s.record(page.id, input);
  assert.equal(saved.kind, "highlight");
  assert.deepEqual(saved.source, input.source);
  assert.equal(s.record(page.id, input).id, saved.id);
  assert.equal(s.records(page.id).length, 1);
  assert.equal(s.records(page.id)[0].raw, input.raw);
  const other = s.create({ title: "另一对话" });
  assert.notEqual(s.record(other.id, input).id, saved.id);
});
test("question promotion preserves source data and creates a distinct target project", (t) => {
  const s = fixture(t);
  const q = s.create({
    title: "想法",
    modules: [{ title: "需求", content: "先做核心功能" }],
  });
  const raw = s.record(q.id, { title: "原文", raw: "原始\n完整对话\n" });
  const p = s.promote(q.id, { title: "目标项目" });
  assert.equal(p.kind, "project");
  assert.equal(p.parentId, q.id);
  assert.notEqual(p.id, q.id);
  assert.ok(p.rootPath.endsWith("/app"));
  assert.deepEqual(p.recordIds, [raw.id]);
  assert.equal(s.records(p.id)[0].raw, "原始\n完整对话\n");
  assert.equal(p.modules[0].id, q.modules[0].id);
  assert.equal(p.modules[1].type, "tasks");
  assert.equal(s.versions(p.id).length, 1);
});
test("stale AI/editor writes fail without overwriting user changes", (t) => {
  const s = fixture(t);
  const q = s.create({ title: "原标题" });
  s.update(q.id, { title: "用户的新标题" }, "编辑", 1);
  assert.throws(
    () => s.update(q.id, { title: "过期版本" }, "AI 更新", 1),
    (e) => e.status === 409,
  );
  assert.equal(s.page(q.id).title, "用户的新标题");
});
test("restoring a revision creates a new version and preserves later raw records", (t) => {
  const s = fixture(t);
  const q = s.create({
    title: "原始",
    modules: [{ title: "模块", content: "第一版" }],
  });
  const first = s.versions(q.id)[0];
  s.update(q.id, { title: "新版本" });
  s.record(q.id, { raw: "后续对话" });
  const restored = s.restore(q.id, first.id);
  assert.equal(restored.title, "原始");
  assert.equal(restored.revision, 3);
  assert.equal(s.records(q.id)[0].raw, "后续对话");
  assert.equal(s.versions(q.id).length, 3);
});
test("synchronization obeys enabled and per-category settings; raw capture remains independent", (t) => {
  const s = fixture(t);
  const p = s.create({
    title: "项目",
    kind: "project",
    modules: [{ title: "任务", type: "tasks", items: [{ text: "验证功能" }] }],
  });
  s.syncUpdate(p.id, "materials", [{ path: "index.html" }]);
  assert.equal(s.page(p.id).files.length, 1);
  s.syncUpdate(p.id, "progress", { title: "写了代码" });
  assert.equal(s.page(p.id).pending.length, 1);
  assert.equal(s.page(p.id).modules[0].items[0].done, false);
  s.update(p.id, { sync: { enabled: false } });
  s.syncUpdate(p.id, "materials", [{ path: "next.html" }]);
  assert.equal(s.page(p.id).files[0].path, "index.html");
  s.flushSync(p.id);
  assert.equal(s.page(p.id).pending.length, 0);
  assert.equal(s.page(p.id).files[0].path, "next.html");
  assert.equal(s.page(p.id).updates.length, 1);
});
test("global and element conversations are persistent and independent", (t) => {
  const s = fixture(t);
  const p = s.create({ title: "项目", kind: "project" });
  const global = s.session(p.id, { key: "global" }),
    local = s.session(p.id, { key: "index.html::summary", label: "总览" });
  assert.notEqual(global.id, local.id);
  s.appendMessage(global.id, "user", "整体指令");
  s.appendMessage(local.id, "user", "只修改这里");
  assert.equal(s.session(p.id, { key: "global" }).messages[0].text, "整体指令");
  assert.equal(
    s.session(p.id, { key: "index.html::summary" }).messages[0].text,
    "只修改这里",
  );
  s.rawEvent(local.id, {
    method: "tool-event",
    params: { text: "完整原始事件" },
  });
  assert.equal(s.rawEvents(local.id)[0].params.text, "完整原始事件");
});
test("static question export escapes arbitrary text and works without app scripts", (t) => {
  const s = fixture(t);
  const q = s.create({
    title: "<script>bad()</script>",
    modules: [
      {
        title: "资料",
        content: "<img src=x onerror=alert(1)>",
        type: "links",
        items: [{ text: "危险链接", url: "javascript:alert(1)" }],
      },
    ],
  });
  const html = renderPage(q);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("/api/"));
});
test("complete custom HTML is independent of stored modules and versioned", (t) => {
  const s = fixture(t),
    q = s.create({
      title: "定制页面",
      modules: [{ title: "稳定数据", content: "保留我" }],
    });
  s.update(q.id, { customHtml: "<!doctype html><h1>完全不同的设计</h1>" });
  assert.equal(
    renderPage(s.page(q.id)),
    "<!doctype html><h1>完全不同的设计</h1>",
  );
  assert.equal(s.page(q.id).modules[0].content, "保留我");
});
test("WB home is reusable; a requested project bootstrap can only be claimed once", (t) => {
  const s = fixture(t);
  assert.equal(s.hub().id, s.hub().id);
  const p = s.create({
    kind: "project",
    title: "新项目",
    initialPrompt: "按需求开发",
  });
  assert.equal(s.claimBootstrap(p.id), "按需求开发");
  assert.equal(s.claimBootstrap(p.id), null);
});
test("search finds original conversation text and imported sources without sending them to AI", (t) => {
  const store = fixture(t),
    page = store.hub();
  const session = store.session(page.id);
  store.appendMessage(session.id, "user", "只在原文出现的关键词银杏");
  store.record(page.id, { title: "文献", raw: "资料中的银杏全文" });
  const results = store.search("银杏");
  assert.deepEqual(
    new Set(results.map((r) => r.type)),
    new Set(["record", "session"]),
  );
  assert.equal(store.search("").length, 0);
});
test("independent chats and tasks preserve old conversations and expose lightweight history metadata", (t) => {
  const store = fixture(t);
  const old = store.hub(),
    oldSession = store.session(old.id);
  store.appendMessage(oldSession.id, "user", "之前的聊天");
  const chat = store.createChat({ title: "新的主题" });
  const task = store.createChat({ mode: "task", title: "调研任务" });
  store.appendMessage(chat.session.id, "user", "新的主题");
  store.appendMessage(task.session.id, "user", "调研任务");
  const history = store.conversations();
  assert.equal(history.length, 3);
  assert.equal(history.find((h) => h.id === task.session.id).entryType, "task");
  assert.equal(history.find((h) => h.id === chat.session.id).entryType, "chat");
  assert.ok(!("messages" in history[0]));
  assert.equal(store.sessionById(oldSession.id).messages[0].text, "之前的聊天");
  assert.notEqual(chat.page.id, task.page.id);
});
