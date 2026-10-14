import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, ROOT } from "../server/index.mjs";

test("HTTP app: protected API, isolated previews, records, revision conflicts and exports", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "wb-http-test-"));
  const app = await startServer({
    port: 4537,
    previewPort: 4538,
    directory: dir,
  });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const call = (path, data, method) =>
    fetch(app.origin + "/api" + path, {
      method: method || (data ? "POST" : "GET"),
      headers: { "X-WB-Token": app.token, "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  assert.equal((await fetch(app.origin + "/api/state")).status, 401);
  assert.equal(
    (
      await fetch(app.origin + "/api/state", {
        headers: { "X-WB-Token": app.token, Origin: app.previewOrigin },
      })
    ).status,
    403,
  );
  const home = await fetch(app.origin);
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes(app.token));
  const hub = await (await call("/hub", {})).json();
  assert.equal(hub.page.id, (await (await call("/hub", {})).json()).page.id);
  const task = await (
    await call("/chats", { title: "测试任务", mode: "task" })
  ).json();
  assert.equal(task.page.entryType, "task");
  const state = await (await call("/state")).json();
  assert.equal(
    state.conversations.find((s) => s.id === task.session.id).pageId,
    task.page.id,
  );
  const q = await (
    await call("/pages", {
      title: "调研",
      modules: [{ title: "结论", content: "<script>unsafe</script>" }],
    })
  ).json();
  await call(`/pages/${q.id}/records`, {
    title: "原始文字",
    raw: "逐字保留\n第二行",
  });
  const latest = (await (await call(`/pages/${q.id}`)).json()).page;
  assert.equal(
    (
      await call(
        `/pages/${q.id}`,
        { title: "更新", expectedRevision: latest.revision },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/pages/${q.id}`,
        { title: "错误覆盖", expectedRevision: latest.revision },
        "PATCH",
      )
    ).status,
    409,
  );
  const exported = await (await call(`/pages/${q.id}/export`)).text();
  assert.ok(exported.includes("&lt;script&gt;"));
  assert.ok(!exported.includes(app.token));
  const project = await (
    await call(`/pages/${q.id}/promote`, { title: "目标项目" })
  ).json();
  assert.equal(
    (await (await call(`/pages/${project.id}/records`)).json())[0].raw,
    "逐字保留\n第二行",
  );
  const preview = await fetch(`${app.previewOrigin}/app/${project.id}/`);
  assert.ok((await preview.text()).includes("从第一条开发指令开始"));
  symlinkSync(
    join(ROOT, "package.json"),
    join(project.rootPath, "outside.json"),
  );
  assert.equal(
    (await fetch(`${app.previewOrigin}/app/${project.id}/outside.json`)).status,
    403,
  );
  assert.equal(
    (await fetch(`${app.previewOrigin}/app/${project.id}/.env`)).status,
    403,
  );
  const demo = await (await call("/demo", {})).json();
  const demoHtml = await (
    await fetch(`${app.previewOrigin}/app/${demo.id}/`)
  ).text();
  assert.ok(demoHtml.includes("/__wb/overlay.js"));
  assert.ok(demoHtml.includes("./assets/"));
  assert.ok(!demoHtml.includes(app.token));
});
