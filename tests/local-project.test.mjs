import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server/index.mjs";
import { validateLocalProject } from "../server/local-project.mjs";

test("local project import preserves files, reuses canonical paths and protects endpoints", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "wb-local-test-"));
  const project = join(dir, "已有 web 项目");
  mkdirSync(project);
  const html = "<!doctype html><html><body><h1>Existing project</h1></body></html>";
  writeFileSync(join(project, "index.html"), html);
  const app = await startServer({ port: 4557, previewPort: 4558, directory: join(dir, "wb") });
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const open = (rootPath) => fetch(`${app.origin}/api/local-projects/open`, {
    method: "POST", headers: { "X-WB-Token": app.token, "Content-Type": "application/json" }, body: JSON.stringify({ rootPath }),
  });
  assert.equal((await fetch(`${app.origin}/api/local-projects/choose`, { method: "POST" })).status, 401);
  assert.equal((await open("relative/path")).status, 400);
  assert.equal((await open(join(project, "index.html"))).status, 400);
  assert.equal((await open(dir)).status, 400);
  assert.throws(() => validateLocalProject(project, [project]), /具体的目标/);
  const firstResponse = await open(project);
  assert.equal(firstResponse.status, 201);
  const first = await firstResponse.json();
  assert.equal(first.page.title, "已有 web 项目");
  assert.equal(first.reused, false);
  assert.equal(first.page.bootstrap, null);
  const alias = join(dir, "alias"); symlinkSync(project, alias);
  const repeated = await (await open(alias)).json();
  assert.equal(repeated.reused, true);
  assert.equal(repeated.page.id, first.page.id);
  const preview = await fetch(`${app.previewOrigin}/app/${first.page.id}/`);
  assert.match(await preview.text(), /Existing project/);
  assert.equal(readFileSync(join(project, "index.html"), "utf8"), html);
  assert.deepEqual(readdirSync(project), ["index.html"]);
});
