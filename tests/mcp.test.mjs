import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Store } from "../server/store.mjs";

test("real MCP stdio tools share data and reject stale edits", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "wb-mcp-test-"));
  const client = new Client({ name: "wb-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("server/mcp.mjs")],
    env: { ...process.env, WB_DATA_DIR: dir },
    stderr: "pipe",
  });
  await client.connect(transport);
  const store = new Store(dir);
  t.after(async () => {
    await client.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 7);
  const created = await client.callTool({
    name: "wb_create_page",
    arguments: {
      title: "MCP 调研",
      modules: [{ title: "答案", content: "真实工具测试" }],
    },
  });
  assert.ok(!created.isError);
  const page = JSON.parse(created.content[0].text);
  assert.equal(store.page(page.id).title, "MCP 调研");
  await client.callTool({
    name: "wb_update_page",
    arguments: { pageId: page.id, expectedRevision: 1, summary: "更新" },
  });
  const stale = await client.callTool({
    name: "wb_update_page",
    arguments: { pageId: page.id, expectedRevision: 1, summary: "不应生效" },
  });
  assert.equal(stale.isError, true);
  const result = await client.callTool({
    name: "wb_start_project",
    arguments: {
      sourcePageId: page.id,
      title: "新项目",
      initialPrompt: "生成一个 React 页面",
    },
  });
  const project = JSON.parse(result.content[0].text);
  assert.equal(store.page(project.id).bootstrap.status, "queued");
  assert.equal(project.parentId, page.id);
});
