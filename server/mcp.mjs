import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const store = new Store(process.env.WB_DATA_DIR || resolve(root, ".wb-data"));
const server = new McpServer(
  { name: "wb-workspace", version: "0.1.0" },
  {
    instructions:
      "WB is the user's page and development-management layer. Use these tools to create structured question pages, start projects and update their WB. Target-project development happens in its own development window. Keep original records and summaries separate. Use get_page before an update and supply its revision to avoid overwriting user edits. Never label a model summary as a complete source transcript. Every project gets independent page content and may have fully custom HTML.",
  },
);
const pageId = z.string().describe("WB page ID");
const moduleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  type: z.enum(["text", "tasks", "links"]).default("text"),
  content: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string(),
        done: z.boolean().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
  sourceIds: z.array(z.string()).optional(),
});
const tool = (name, description, inputSchema, fn) =>
  server.registerTool(name, { description, inputSchema }, async (input) => {
    try {
      const result = await fn(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: error.message }],
      };
    }
  });
const urls = (page) => ({
  ...page,
  wbUrl: `http://127.0.0.1:${process.env.PORT || 4317}/#/page/${page.id}`,
  ...(page.kind === "project"
    ? {
        developmentUrl: `http://127.0.0.1:${process.env.PORT || 4317}/#/develop/${page.id}`,
      }
    : {}),
});
tool(
  "wb_list_pages",
  "List question pages and project WB assistants.",
  {},
  () =>
    store.pages().map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind,
      revision: p.revision,
      updatedAt: p.updatedAt,
    })),
);
tool(
  "wb_get_page",
  "Read page modules, revision, source records and development activity. Read this before editing.",
  { pageId },
  ({ pageId }) => ({
    page: urls(store.page(pageId)),
    records: store.records(pageId),
    events: store.events(pageId),
  }),
);
tool(
  "wb_create_page",
  "Create a lightweight structured question page from the current topic. AI writes modules; users can edit them later.",
  {
    title: z.string(),
    summary: z.string().optional(),
    modules: z.array(moduleSchema).optional(),
  },
  (input) => urls(store.create({ ...input, kind: "question" })),
);
tool(
  "wb_start_project",
  "After the user explicitly decides to start a project, create its WB and dedicated development window. Include initialPrompt only when the user wants development to begin now; WB runs it in the target project.",
  {
    sourcePageId: z.string().optional(),
    title: z.string(),
    summary: z.string().optional(),
    rootPath: z.string().optional(),
    initialPrompt: z.string().optional(),
  },
  (input) => {
    const page = input.sourcePageId
      ? store.promote(input.sourcePageId, input)
      : store.create({
          ...input,
          kind: "project",
          modules: [
            { title: "项目目标", content: input.summary || "" },
            { title: "开发计划", type: "tasks", items: [] },
          ],
        });
    store.event(page.id, "project-ready", "目标项目开发窗口已创建");
    return urls(page);
  },
);
tool(
  "wb_update_page",
  "Update a WB or question page, preserving stable module IDs and unrelated user edits. customHtml optionally supplies a fully bespoke page; it renders separately from the authoritative data and is isolated from the management app.",
  {
    pageId,
    expectedRevision: z.number().int(),
    title: z.string().optional(),
    summary: z.string().optional(),
    modules: z.array(moduleSchema).optional(),
    customHtml: z.string().optional(),
  },
  ({ pageId, expectedRevision, ...patch }) =>
    urls(store.update(pageId, patch, "Codex 更新页面", expectedRevision)),
);
tool(
  "wb_record",
  "Preserve exact source material or supplied transcript without replacing it with a summary. Set origin honestly; only the application-owned conversations are automatically captured in full.",
  {
    pageId,
    title: z.string(),
    raw: z.string(),
    origin: z.string().default("Codex 提交的原始材料"),
    format: z.enum(["text", "json", "jsonl"]).optional(),
  },
  ({ pageId, ...input }) => store.record(pageId, input),
);
tool(
  "wb_sync_update",
  "Submit a development summary, progress report or decision to WB. It respects this page's per-category auto/manual synchronization settings. File changes alone never prove task completion.",
  {
    pageId,
    category: z.enum(["conversations", "progress", "decisions"]),
    title: z.string(),
    summary: z.string(),
  },
  ({ pageId, category, title, summary }) =>
    urls(store.syncUpdate(pageId, category, { title, summary })),
);
await server.connect(new StdioServerTransport());
process.on("SIGINT", async () => {
  await server.close();
  store.close();
  process.exit(0);
});
