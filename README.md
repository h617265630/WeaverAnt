# WeaverAnt

English | [简体中文](README.zh-CN.md)

**A page-first AI workspace for conversations, project planning, and assisted development.**

Turn a conversation into a workspace you can navigate, edit, and build in—not just a transcript you scroll through.

> Local-first MVP built with React and Node.js. The current interface uses Chinese labels and still refers to the workspace as **WB / WB Studio**. WeaverAnt is the project's name.

## Why move beyond a chat window?

Traditional chat windows are useful for asking questions, but become harder to work with as a conversation grows:

- **Important information gets buried.** Requirements, decisions, links, and explanations are scattered throughout a long transcript.
- **Follow-ups derail the main thread.** Discussing one paragraph mixes a new topic into the original conversation.
- **Replies are not project state.** An answer does not automatically become a plan, task list, or reusable reference.
- **Local changes are difficult to describe.** Selecting a card is easier than explaining “the second card below the heading.”
- **Context is fragmented across tools.** Research, conversations, project management, and implementation often live in separate places.

WeaverAnt explores a different approach: **use generated web pages and structured web interfaces as the working surface for AI conversations and projects.**

## What is WeaverAnt?

WeaverAnt is an interactive AI workspace and development assistant. Start with a question or idea, organize the resulting knowledge in a web workspace, and move into planning and implementation when you are ready.

It connects to your local **Codex or Claude Code** installation for reasoning and tool execution. WeaverAnt provides the interaction layer, project context, and persistent records—not a new foundation model.

There are two distinct parts:

| Part | Purpose |
| --- | --- |
| **WB workspace** | Manage conversations, research, requirements, plans, tasks, resources, and original records. |
| **Target project** | The actual website or software you are building, with its own files and development preview. |

### What “real-time generated web interaction” means

The product direction is to make AI-generated pages an interactive working environment. The current implementation has three complementary layers:

1. **Streaming conversations:** replies appear incrementally as headings, paragraphs, lists, tables, and code blocks. You can read while the AI is responding, without waiting for a complete HTML document.
2. **Editable workspace pages:** users and AI tools can update modules, tasks, links, and project material. AI can also provide custom HTML pages for isolated display. Knowledge pages can be exported as standalone HTML.
3. **Interactive project previews:** generated or imported web projects appear above a development chat dock. Select text or a page region and ask the AI to change that specific part.

**Not every response generates a new standalone application.** Conversation formatting uses the reply's existing structure, not another model call to rewrite it. Chat replies are not executed as arbitrary HTML or JavaScript. Project previews reflect actual files and build output; target-project development servers and hot reload are not automatically managed.

## Quick start

### Requirements

- **Node.js 22.13 or newer** and npm.
- A locally installed and authenticated **Codex or Claude Code** for real AI requests.
- A modern browser. Automated browser tests are configured for Google Chrome.

You can explore management features and the bundled demo without sending an AI request.

### Install and run

```sh
git clone https://github.com/h617265630/WeaverAnt.git
cd WeaverAnt
npm ci
npm start
```

Open **http://127.0.0.1:4317**.

Keep the terminal running; press **Ctrl+C** to stop. The start command builds WeaverAnt and its bundled demo, then starts the local service. It does not build imported projects.

- **4317:** main workspace interface.
- **4318:** separate preview origin for embedded project pages.

### Connect an AI agent

Open **Connection & Settings (`连接与设置`)** in the main sidebar:

1. Choose Codex or Claude Code as the default provider for new conversations.
2. Check the local connection. Complete authentication in the provider's own application if necessary.
3. Return to WeaverAnt and send a message.

WeaverAnt attempts to discover supported executables locally, including supported VS Code extension locations. Claude Code also has a configurable executable path. You can explicitly set a binary when starting:

```sh
WB_CODEX_BIN="/absolute/path/to/codex" npm start
# Or:
WB_CLAUDE_BIN="/absolute/path/to/claude" npm start
```

Existing conversations retain their provider; changing the default does not migrate them. Real requests use your provider account and may consume quota. These local adapters do not require a separate model API key in WeaverAnt.

## How to use WeaverAnt

### 1. Start a conversation or task

Choose a conversation or task on the entry page and send your first message. WeaverAnt creates a dedicated workspace and sidebar history entry only when you send—an empty chat does not become a record.

For example:

> Help me research a personal expense tracker. Compare possible workflows and identify the smallest useful first version.

The response streams into a structured reading area. Conversations, follow-ups, and supporting material have separate places instead of sharing one endless column.

### 2. Branch from a specific piece of information

Select text in a completed message to open the **select-dock** nearby. You can ask a focused question, request related resources, or save the selection as a highlight.

Follow-up replies appear in a separate response area with labels connecting them to their source. You can select text inside a follow-up and branch again without losing the main discussion.

The main **float-dock** stays near the bottom of the conversation. **Enter** sends; **Shift+Enter** inserts a new line. The interface follows streaming replies unless you scroll up to read history.

### 3. Organize knowledge and references

Use **Materials & Management (`资料与管理`)** to access content modules, resources, highlights, and original records.

- Supported links from saved messages and completed tool results are collected into Resources, deduplicated, and associated with their source.
- Saved selections appear under **Highlights (`重点`)**.
- Edit workspace content directly or search saved material without an extra model call.
- Original messages remain available; summaries do not replace them.
- Export knowledge pages as standalone HTML for viewing without the WeaverAnt service.

Resources are not automatically downloaded or verified. Structured organization depends on user edits or agent tool calls—not every message automatically becomes a module. Search capabilities depend on the tools available to the connected agent.

### 4. Turn an idea into a project

Use the **+** beside Projects or **Start Project (`启动项目`)** from a conversation workspace. Choose:

- **Plan first:** define the initial scope, development standards, and reference projects.
- **Start directly:** enter development and refine the requirements as you build.

In **Project Planning (`项目规划`)**, select common standards or write your own: preferred stack, visual style, accessibility, testing expectations, and dependency constraints. Record reference projects and explain what to borrow—and what not to copy.

Saved planning material is included in subsequent project development requests. You can return to planning at any time.

### 5. Build through the page

The development window combines a target-project preview, a fixed global chat dock, and panels for AI reports, Todo items, and the file tree.

Use the global dock for project-wide instructions:

> Build an expense tracker with an overview and an add-transaction form. Follow the saved project standards.

For a local change:

1. Select text, use **Select Region (`点选局部`)**, or double-click a supported page area.
2. Adjust the target using parent/child controls or the DOM hierarchy path.
3. Enter an instruction in the local select-dock.
4. Read the response in the left-hand **AI Reports (`AI 汇报`)** panel.

WeaverAnt passes the selected text, selector, HTML excerpt, and available source markers as context. The agent edits actual project files. The selection overlay is injected by the preview environment, not written into the delivered app.

The select-dock also offers **AI advice**, **color palettes**, and **UI component ideas**. Palette and component cards are built-in suggestions, not dynamically generated recommendations. Choosing one fills the input for review; you must send it before an agent request runs. AI advice uses the connected provider and appears in AI Reports.

### 6. Continue an existing local project

Choose **Open Local Web Project (`打开本地 Web 项目`)** in the main sidebar.

Select a folder with the native chooser on macOS, or enter an absolute path. Choose the project root containing `index.html`, `dist/index.html`, or `package.json`.

- WeaverAnt binds the original directory without copying it.
- Opening does not install dependencies, execute project scripts, or automatically invoke AI.
- Reopening the same resolved directory reuses its existing WB workspace.
- Later development instructions operate on the original files. Use Git or another backup before making changes.

**Importing successfully does not guarantee preview compatibility.** Static HTML and compatible build output are supported. Full-stack apps and root-relative asset paths need additional handling; see the limitations below.

### Try the demo without an AI request

Open **All Projects (`全部项目`) → Try the Expense Tracker Demo (`体验记账 App 示例`)**.

The bundled demo is a working React page with sample transactions. Exploring it, selecting regions, and using management features does not require model quota. Sending a message does.

## Project management and local data

- **Todo:** add, edit, complete, filter, and delete tasks. Management and development views share the same task data.
- **Files:** inspect the indexed project tree. A file changing does not automatically mean a task is complete.
- **Records:** retain WB-created conversations and protocol events. Private VS Code chat history is not automatically imported; existing records can be pasted manually.
- **Sync settings:** choose automatic or manual handling by category. Raw conversation capture is independent of summary synchronization.
- **Workspace versions:** restore management content, not source code. The version panel is **not Git** and cannot undo target-project changes.

| Location | Contents |
| --- | --- |
| `.wb-data/workspace.sqlite` | Workspaces, modules, conversations, records, events, and management versions. |
| `.wb-data/projects/<project-id>/app/` | Default directory for a new target project. |
| An imported project's original directory | Actual files of a bound local project. |

Stop the service before backing up `.wb-data`. Back up externally bound directories separately. Runtime workspace data is excluded from this repository.

## Architecture

```text
Conversation / task
  → Structured web workspace
  → Planning and project material
  → Target-project preview + global/local instructions
  → Local agent bridge → Codex or Claude Code → project files
                       ↘ WB MCP tools → workspace updates
```

| Layer | Main implementation |
| --- | --- |
| React workspace and project UI | `src/` |
| Local API, previews, file synchronization | `server/index.mjs` |
| Provider routing and adapters | `server/agents.mjs`, `server/codex.mjs`, `server/claude.mjs` |
| SQLite content and version store | `server/store.mjs` |
| Agent tools for workspace organization | `server/mcp.mjs` |
| Injected selection and region navigation | `public/overlay.js` |

A local Node service is needed because a static browser page cannot launch agent processes, continuously access project files, or handle development approvals. The built interface does not require a Vite development server at runtime.

## Configuration and development

```sh
# Use different local ports.
PORT=4417 WB_PREVIEW_PORT=4418 npm start

# Use a different workspace data directory.
WB_DATA_DIR="/absolute/path/to/workspace-data" npm start

# Develop WeaverAnt's frontend.
npm run dev
```

The development command rebuilds WeaverAnt's frontend when files change; refresh the browser to see updates. Restart for server-side changes. This does not run the target project's development server. Do not run two instances against the same workspace database.

The built-in bridge supplies WB MCP configuration to its own agent processes without requiring global configuration changes. For optional use from an external Codex client, `npm run config` prints a configuration snippet to review and add to that client. Both processes must use the same data directory. The helper prints the repository's default `.wb-data` path; adjust it if using a custom location.

## Safety

Both services bind to `127.0.0.1`. The management API checks a local token, Host, and Origin; target previews use a separate origin. This is a single-user local tool, not a hardened sandbox for hostile projects or a public multi-tenant service.

AI requests may read files, edit code, run commands, access the network, and consume account quota. Review unfamiliar scripts before executing them.

Codex approvals are surfaced in the interface and are not automatically approved. Claude Code interactive approvals are not currently bridged, so operations without permission may be denied. The adapter does not use permission-bypass flags.

## Current limitations

- **Root-relative preview assets:** builds referencing `/assets/...` can display a blank page because the static preview serves projects under `/app/<project-id>/`. Relative build assets, such as those produced with Vite's `base: './'`, fit this structure; application routes and API URLs may still need separate handling. Automatic path adaptation remains unfinished.
- **No automatic target-project runtime:** importing a folder does not start Vite, a backend, or a database. Server-rendered and full-stack services are not automatically orchestrated or proxied.
- **No guaranteed DOM-to-source mapping:** selections provide context, not an exact source-editor mapping. Stable `data-ai-id` and `data-ai-source` attributes can improve targeting.
- **One active agent task per project:** global and local requests share a lock to avoid simultaneous edits.
- **Custom HTML is a presentation layer:** it does not automatically gain workspace write permissions. Native editors and MCP tools handle changes.
- **Local-first MVP:** no team permissions or integrated cloud deployment.

## Checks and tests

```sh
npm run check
npm run build
npm test
npm run test:browser
```

Browser tests use Google Chrome as configured in `playwright.config.mjs`. Automated tests use isolated temporary workspaces and simulated agents, not real model quota. They cover conversations, scoped interactions, project workflows, persistence, and local imports.

An optional real Codex smoke test is available with `node scripts/smoke-codex.mjs`. Unlike the simulated tests, it invokes your installed agent and may consume account quota.

---

**WeaverAnt: move from talking about a project to working inside an interactive page built around it.**
