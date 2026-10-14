import test from "node:test";
import assert from "node:assert/strict";
import { contentBlocks, safeLink } from "../src/content-blocks.mjs";
test("streaming text renders before a code fence or reply finishes", () => {
  assert.equal(contentBlocks("部分回复")[0].text, "部分回复");
  const blocks = contentBlocks("# 方案\n\n```js\nconst a =");
  assert.equal(blocks[0].type, "heading");
  assert.deepEqual(blocks[1], {
    type: "code",
    language: "js",
    text: "const a =",
    complete: false,
  });
});
test("lists, steps, checkboxes and tables retain their original content", () => {
  const blocks = contentBlocks(
    "- 身份：确认姓名\n- 状态：识别状态\n\n1. 手机\n2. 硬件\n\n- [x] 已验证\n- [ ] 待验证\n\n| 阶段 | 目标 |\n| --- | --- |\n| MVP | 验证 |",
  );
  assert.equal(blocks[0].items[0].text, "身份：确认姓名");
  assert.equal(blocks[1].ordered, true);
  assert.equal(blocks[2].items[0].checked, true);
  assert.equal(blocks[2].items[1].checked, false);
  assert.deepEqual(blocks[3].rows, [["MVP", "验证"]]);
});
test("unsafe links and HTML are not executable presentation instructions", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("data:text/html,test"), null);
  assert.equal(safeLink("https://example.com"), "https://example.com/");
  assert.equal(
    contentBlocks("<script>bad()</script>")[0].text,
    "<script>bad()</script>",
  );
});
