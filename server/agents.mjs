import { EventEmitter } from "node:events";
import { CodexAgent } from "./codex.mjs";
import { ClaudeAgent, detectClaude } from "./claude.mjs";

export class Agents extends EventEmitter {
  constructor(store, { codex, claude } = {}) {
    super();
    this.store = store;
    this.config = JSON.parse(store.db.prepare("SELECT value FROM meta WHERE key='ai-settings'").get()?.value || '{"provider":"codex","claudeBinary":""}');
    this.codex = codex || new CodexAgent(store);
    this.claude = claude || new ClaudeAgent(store, { binary: this.config.claudeBinary || detectClaude() });
    this.busy = new Set();
    for (const agent of [this.codex, this.claude]) agent.on("event", (event) => {
      if (event.type === "turn-completed") this.busy.delete(event.pageId);
      this.emit("event", event);
    });
  }
  get approvals() { return this.codex.approvals; }
  async status() {
    const [codex, claude] = await Promise.all([this.codex.status(), this.claude.status()]);
    return { ...(this.config.provider === "claude" ? claude : codex), provider: this.config.provider, codex, claude, settings: this.config };
  }
  configure(input) {
    if (this.busy.size) throw new Error("请等待当前 AI 任务结束后再修改连接设置");
    if (!["codex", "claude"].includes(input.provider)) throw new Error("不支持的 AI 类型");
    const claudeBinary = String(input.claudeBinary || "").trim();
    if (claudeBinary && !claudeBinary.startsWith("/") && claudeBinary !== "claude") throw new Error("请输入完整可执行文件路径，不要填写命令参数");
    this.config = { provider: input.provider, claudeBinary };
    this.claude.binary = claudeBinary || detectClaude();
    this.claude.connected = false;
    this.store.db.prepare("INSERT INTO meta(key,value) VALUES('ai-settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(this.config));
  }
  connect(provider = this.config.provider) {
    if (!["codex", "claude"].includes(provider)) throw new Error("不支持的 AI 类型");
    return this[provider].connect();
  }
  async start(pageId, anchor, message) {
    if (this.busy.has(pageId)) throw new Error("这个页面有任务正在执行，请先等待或停止");
    const session = this.store.session(pageId, anchor);
    session.provider ||= session.threadId || session.messages.length ? "codex" : this.config.provider;
    this.store.saveSession(session);
    this.busy.add(pageId);
    try { return await this[session.provider].start(pageId, anchor, message); }
    catch (error) { this.busy.delete(pageId); throw error; }
  }
  interrupt(sessionId) { return this[this.store.sessionById(sessionId).provider || "codex"].interrupt(sessionId); }
  respond(id, input) { return this.codex.respond(id, input); }
  close() { this.codex.close(); this.claude.close(); }
}
