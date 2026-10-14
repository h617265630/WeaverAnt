import test from "node:test";
import assert from "node:assert/strict";
import { collectResources } from "../src/resources.mjs";

test("resources deduplicate persisted links and retain provenance without indexing code examples", () => {
  const resources = collectResources(
    {
      modules: [
        {
          id: "module",
          type: "links",
          items: [{ text: "指南", url: "https://example.com/guide" }],
        },
      ],
    },
    [
      {
        messages: [
          {
            id: "a",
            role: "assistant",
            text: "[指南](https://example.com/guide)\nhttps://example.com/guide。\n```js\nhttps://example.com/code\n```",
          },
          { id: "u", role: "user", text: "https://example.com/guide" },
        ],
      },
    ],
  );
  assert.equal(resources.length, 1);
  assert.equal(resources[0].title, "指南");
  assert.equal(resources[0].sources.length, 3);
});
test("search and MCP result URLs are collected, not arguments or unsafe links", () => {
  const events = [
    {
      method: "item/completed",
      params: {
        item: {
          id: "s",
          type: "webSearch",
          action: { type: "openPage", url: "https://example.com/source" },
        },
      },
    },
    {
      method: "item/completed",
      params: {
        item: {
          id: "m",
          type: "mcpToolCall",
          arguments: { url: "https://example.com/input" },
          result: {
            content: [
              { text: "[文档](https://example.com/doc)" },
              { uri: "file:///secret" },
              { url: "javascript:alert(1)" },
              { url: "https://user:password@example.com/" },
            ],
          },
        },
      },
    },
  ];
  const resources = collectResources({}, [], events);
  assert.deepEqual(
    resources.map((r) => r.url),
    ["https://example.com/source", "https://example.com/doc"],
  );
  assert.equal(resources[0].sources[0].label, "搜索 / 浏览来源");
});
