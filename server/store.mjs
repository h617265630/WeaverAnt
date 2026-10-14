import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
export const defaultSync = {
  enabled: true,
  materials: "auto",
  conversations: "auto",
  progress: "manual",
  decisions: "manual",
};
export class Store {
  constructor(directory) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true });
    this.db = new DatabaseSync(join(this.directory, "workspace.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, page_id TEXT, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, page_id TEXT, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, page_id TEXT, anchor_key TEXT, body TEXT NOT NULL, UNIQUE(page_id,anchor_key));
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS raw_events (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  close() {
    this.db.close();
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  read(table, key) {
    const row = this.db
      .prepare(`SELECT body FROM ${table} WHERE id=?`)
      .get(key);
    return row ? JSON.parse(row.body) : null;
  }
  put(table, entity) {
    this.db
      .prepare(
        `INSERT INTO ${table} (id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body`,
      )
      .run(entity.id, JSON.stringify(entity));
    return entity;
  }
  pages() {
    return this.db
      .prepare("SELECT body FROM pages")
      .all()
      .map((r) => JSON.parse(r.body))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  page(pageId) {
    const page = this.read("pages", pageId);
    if (!page) throw Object.assign(new Error("页面不存在"), { status: 404 });
    return page;
  }
  search(query) {
    const needle = String(query || "")
      .trim()
      .toLocaleLowerCase();
    if (!needle) return [];
    const results = [];
    const add = (page, type, key, title, text) => {
      const haystack = `${title}\n${text}`;
      const at = haystack.toLocaleLowerCase().indexOf(needle);
      if (at < 0 || results.length >= 60) return;
      results.push({
        pageId: page.id,
        pageTitle: page.title,
        type,
        id: key,
        title,
        snippet: haystack.slice(Math.max(0, at - 45), at + 170),
      });
    };
    for (const page of this.pages()) {
      add(page, "page", page.id, page.title, page.summary);
      for (const module of page.modules)
        add(
          page,
          "module",
          module.id,
          module.title,
          `${module.content}\n${module.items.map((i) => `${i.text} ${i.url}`).join("\n")}`,
        );
      for (const record of this.records(page.id))
        add(page, "record", record.id, record.title, record.raw);
      for (const session of this.sessions(page.id))
        add(
          page,
          "session",
          session.id,
          session.anchor.label || "完整对话",
          session.messages.map((m) => m.text).join("\n"),
        );
    }
    return results;
  }
  event(pageId, type, title, detail = "") {
    const event = { pageId, type, title, detail, at: now() };
    const row = this.db
      .prepare("INSERT INTO events (page_id,body) VALUES (?,?)")
      .run(pageId, JSON.stringify(event));
    return { id: Number(row.lastInsertRowid), ...event };
  }
  events(pageId) {
    return (
      pageId
        ? this.db
            .prepare(
              "SELECT id,body FROM events WHERE page_id=? ORDER BY id DESC LIMIT 80",
            )
            .all(pageId)
        : this.db
            .prepare("SELECT id,body FROM events ORDER BY id DESC LIMIT 80")
            .all()
    ).map((r) => ({ id: r.id, ...JSON.parse(r.body) }));
  }
  normalizeModules(modules = []) {
    if (!Array.isArray(modules) || modules.length > 100)
      throw new Error("模块必须是数组，最多 100 个");
    const used = new Set();
    return modules.map((m) => {
      const moduleId = m.id || id("block");
      if (used.has(moduleId)) throw new Error("模块 ID 不能重复");
      used.add(moduleId);
      return {
        id: moduleId,
        title: String(m.title || "未命名模块"),
        type: ["text", "tasks", "links"].includes(m.type) ? m.type : "text",
        content: String(m.content || ""),
        items: Array.isArray(m.items)
          ? m.items.map((item) => ({
              id: item.id || id("item"),
              text: String(item.text || ""),
              done: !!item.done,
              url: String(item.url || ""),
            }))
          : [],
        sourceIds: Array.isArray(m.sourceIds) ? m.sourceIds : [],
      };
    });
  }
  create(input) {
    if (!String(input.title || "").trim()) throw new Error("请输入页面标题");
    const kind = input.kind === "project" ? "project" : "question";
    const pageId = id(kind === "project" ? "project" : "question");
    let rootPath = null;
    if (kind === "project") {
      rootPath = input.rootPath
        ? resolve(input.rootPath)
        : join(this.directory, "projects", pageId, "app");
      if (input.rootPath && !existsSync(rootPath))
        throw new Error("目标项目目录不存在");
      mkdirSync(rootPath, { recursive: true });
    }
    const page = {
      id: pageId,
      kind,
      entryType:
        kind === "project"
          ? "project"
          : input.entryType === "task"
            ? "task"
            : "chat",
      title: input.title.trim(),
      summary: String(input.summary || ""),
      modules: this.normalizeModules(input.modules),
      rootPath,
      parentId: input.parentId || null,
      recordIds: Array.isArray(input.recordIds) ? [...input.recordIds] : [],
      sync: { ...defaultSync },
      customHtml: "",
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
      lastSyncAt: null,
      files: [],
      pending: [],
      bootstrap: input.initialPrompt
        ? { status: "queued", prompt: String(input.initialPrompt) }
        : null,
    };
    return this.transaction(() => {
      this.put("pages", page);
      this.snapshot(page, "创建页面");
      this.event(
        page.id,
        "created",
        kind === "project" ? "项目已启动，开发窗口已就绪" : "问答页面已创建",
      );
      return page;
    });
  }
  snapshot(page, reason) {
    this.db
      .prepare("INSERT INTO versions (id,page_id,body) VALUES (?,?,?)")
      .run(
        id("version"),
        page.id,
        JSON.stringify({ revision: page.revision, reason, at: now(), page }),
      );
  }
  update(pageId, patch, reason = "更新页面", expectedRevision) {
    return this.transaction(() => {
      const page = this.page(pageId);
      if (expectedRevision !== undefined && page.revision !== expectedRevision)
        throw Object.assign(
          new Error(
            "内容已有新版本，请刷新后再保存。你的编辑尚未覆盖任何内容。",
          ),
          { status: 409 },
        );
      for (const key of ["title", "summary", "customHtml"])
        if (patch[key] !== undefined) page[key] = String(patch[key]);
      if (patch.modules !== undefined)
        page.modules = this.normalizeModules(patch.modules);
      if (patch.sync) {
        for (const key of [
          "materials",
          "conversations",
          "progress",
          "decisions",
        ])
          if (patch.sync[key] !== undefined) {
            if (!["auto", "manual"].includes(patch.sync[key]))
              throw new Error("同步方式必须是 auto 或 manual");
            page.sync[key] = patch.sync[key];
          }
        if (typeof patch.sync.enabled === "boolean")
          page.sync.enabled = patch.sync.enabled;
      }
      page.revision++;
      page.updatedAt = now();
      this.put("pages", page);
      this.snapshot(page, reason);
      this.event(page.id, "updated", reason);
      return page;
    });
  }
  promote(pageId, input = {}) {
    const source = this.page(pageId);
    if (source.kind !== "question") throw new Error("只有问答页面可以转为项目");
    const modules = [...source.modules];
    if (!modules.some((m) => m.type === "tasks"))
      modules.push({
        title: "开发计划",
        type: "tasks",
        items: [
          { text: "确认第一版需求" },
          { text: "完成最小功能" },
          { text: "测试并验证成果" },
        ],
      });
    return this.create({
      kind: "project",
      title: input.title || source.title,
      summary: input.summary || source.summary,
      parentId: source.id,
      modules,
      rootPath: input.rootPath,
      recordIds: source.recordIds,
      initialPrompt: input.initialPrompt,
    });
  }
  versions(pageId) {
    return this.db
      .prepare(
        "SELECT id,body FROM versions WHERE page_id=? ORDER BY rowid DESC",
      )
      .all(pageId)
      .map((r) => {
        const v = JSON.parse(r.body);
        return { id: r.id, revision: v.revision, reason: v.reason, at: v.at };
      });
  }
  restore(pageId, versionId) {
    const version = this.read("versions", versionId);
    if (!version || version.page.id !== pageId) throw new Error("版本不存在");
    return this.update(
      pageId,
      {
        title: version.page.title,
        summary: version.page.summary,
        modules: version.page.modules,
        customHtml: version.page.customHtml,
      },
      `恢复到版本 ${version.revision}`,
    );
  }
  record(pageId, input) {
    return this.transaction(() => {
      const page = this.page(pageId);
      const record = {
        id: id("record"),
        pageId,
        title: String(input.title || "原始记录"),
        origin: String(input.origin || "手动导入"),
        raw: String(input.raw || ""),
        format: input.format || "text",
        ...(input.kind === "highlight" ? {
          kind: "highlight",
          source: {
            messageId: String(input.source?.messageId || ""),
            sessionId: String(input.source?.sessionId || ""),
            parentThreadKey: String(input.source?.parentThreadKey || ""),
          },
        } : {}),
        at: now(),
      };
      if (!record.raw.trim()) throw new Error("记录内容不能为空");
      if (record.kind === "highlight") {
        const existing = this.records(pageId).find((r) =>
          r.kind === "highlight" && r.raw === record.raw &&
          r.source?.messageId === record.source.messageId &&
          r.source?.sessionId === record.source.sessionId);
        if (existing) return existing;
      }
      this.db
        .prepare("INSERT INTO records (id,page_id,body) VALUES (?,?,?)")
        .run(record.id, pageId, JSON.stringify(record));
      page.recordIds.push(record.id);
      page.updatedAt = now();
      this.put("pages", page);
      this.event(pageId, "record", "已保存原始记录", record.title);
      return record;
    });
  }
  records(pageId) {
    return this.page(pageId)
      .recordIds.map((key) => this.read("records", key))
      .filter(Boolean);
  }
  session(pageId, anchor = {}) {
    this.page(pageId);
    const key = anchor.key || "global";
    const row = this.db
      .prepare("SELECT body FROM sessions WHERE page_id=? AND anchor_key=?")
      .get(pageId, key);
    if (row) return JSON.parse(row.body);
    const session = {
      id: id("session"),
      pageId,
      anchorKey: key,
      anchor,
      threadId: null,
      messages: [],
      createdAt: now(),
      status: "idle",
      turnId: null,
    };
    this.saveSession(session);
    return session;
  }
  saveSession(session) {
    this.db
      .prepare(
        "INSERT INTO sessions (id,page_id,anchor_key,body) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(
        session.id,
        session.pageId,
        session.anchorKey,
        JSON.stringify(session),
      );
    return session;
  }
  sessions(pageId) {
    return this.db
      .prepare("SELECT body FROM sessions WHERE page_id=? ORDER BY rowid DESC")
      .all(pageId)
      .map((r) => JSON.parse(r.body));
  }
  hub() {
    const stored = this.db
      .prepare("SELECT value FROM meta WHERE key=?")
      .get("hubPageId");
    if (stored) {
      const page = this.read("pages", JSON.parse(stored.value));
      if (page) return page;
    }
    const page = this.create({
      kind: "question",
      title: "WB 总对话",
      summary: "在这里提问、调研、整理思路，并确定要开始的项目。",
    });
    this.db
      .prepare(
        "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run("hubPageId", JSON.stringify(page.id));
    return page;
  }
  createChat(input = {}) {
    const task = input.mode === "task";
    const page = this.create({
      title: String(input.title || (task ? "新任务" : "新对话")),
      kind: "question",
      entryType: task ? "task" : "chat",
      summary: task
        ? "任务的需求、过程与成果集中保存在这里。"
        : "这次对话的内容、资料和后续讨论集中保存在这里。",
      modules: task
        ? [
            {
              title: "任务清单",
              type: "tasks",
              items: [{ text: "明确任务要求" }, { text: "完成任务并检查成果" }],
            },
          ]
        : [],
    });
    return {
      page,
      session: this.session(page.id, { key: "global", label: "新对话" }),
    };
  }
  conversations() {
    const pages = new Map(this.pages().map((page) => [page.id, page]));
    return this.db
      .prepare("SELECT body FROM sessions")
      .all()
      .flatMap((row) => {
        const session = JSON.parse(row.body),
          page = pages.get(session.pageId);
        if (
          !page ||
          (!session.messages.length && session.anchor.label !== "新对话")
        )
          return [];
        const first = session.messages.find(
          (message) => message.role === "user",
        );
        return [
          {
            id: session.id,
            pageId: page.id,
            pageTitle: page.title,
            kind: page.kind,
            entryType:
              page.entryType || (page.kind === "project" ? "project" : "chat"),
            title:
              first?.text.replace(/\s+/g, " ").trim().slice(0, 60) ||
              page.title,
            scope:
              page.kind === "question"
                ? "chat"
                : session.anchorKey === "global"
                  ? "global"
                  : "local",
            anchorLabel: session.anchor.label || "",
            status: session.status,
            updatedAt: session.messages.at(-1)?.at || session.createdAt,
            messageCount: session.messages.length,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      );
  }
  claimBootstrap(pageId) {
    return this.transaction(() => {
      const page = this.page(pageId);
      if (page.bootstrap?.status !== "queued") return null;
      page.bootstrap.status = "starting";
      this.put("pages", page);
      return page.bootstrap.prompt;
    });
  }
  bootstrapStatus(pageId, status, error) {
    const page = this.page(pageId);
    if (page.bootstrap) {
      page.bootstrap.status = status;
      page.bootstrap.error = error || null;
      this.put("pages", page);
    }
  }
  sessionById(sessionId) {
    const s = this.read("sessions", sessionId);
    if (!s) throw new Error("会话不存在");
    return s;
  }
  appendMessage(sessionId, role, text, extra = {}) {
    const s = this.sessionById(sessionId);
    s.messages.push({ id: id("msg"), role, text, at: now(), ...extra });
    this.saveSession(s);
    return s;
  }
  rawEvent(sessionId, event) {
    this.db
      .prepare("INSERT INTO raw_events(session_id,body) VALUES(?,?)")
      .run(sessionId, JSON.stringify({ at: now(), ...event }));
  }
  rawEvents(sessionId) {
    return this.db
      .prepare("SELECT body FROM raw_events WHERE session_id=? ORDER BY id")
      .all(sessionId)
      .map((r) => JSON.parse(r.body));
  }
  syncUpdate(pageId, category, content, manual = false) {
    if (
      !["materials", "conversations", "progress", "decisions"].includes(
        category,
      )
    )
      throw new Error("未知同步分类");
    return this.transaction(() => {
      const page = this.page(pageId);
      const update = { id: id("sync"), category, content, at: now() };
      if (!manual && (!page.sync.enabled || page.sync[category] === "manual")) {
        page.pending = [
          ...page.pending.filter(
            (x) => !(category === "materials" && x.category === "materials"),
          ),
          update,
        ];
      } else {
        this.applySync(page, update);
        page.lastSyncAt = now();
      }
      page.updatedAt = now();
      this.put("pages", page);
      return page;
    });
  }
  applySync(page, update) {
    if (update.category === "materials") page.files = update.content;
    else {
      page.updates ||= [];
      page.updates.push(update);
    }
    this.event(
      page.id,
      "sync",
      `已同步${{ materials: "项目文件", conversations: "开发对话", progress: "进度记录", decisions: "项目决策" }[update.category]}`,
    );
  }
  flushSync(pageId) {
    return this.transaction(() => {
      const page = this.page(pageId);
      for (const update of page.pending) this.applySync(page, update);
      page.pending = [];
      page.lastSyncAt = now();
      this.put("pages", page);
      return page;
    });
  }
  recoverSessions() {
    for (const row of this.db.prepare("SELECT body FROM sessions").all()) {
      const s = JSON.parse(row.body);
      if (s.status === "running") {
        s.status = "interrupted";
        s.turnId = null;
        this.saveSession(s);
      }
    }
  }
}
