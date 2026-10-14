import React, { useState } from "react";
import { useWB } from "./context";
import { api, timeLabel, go } from "./api";
import { Icon, Button, Empty } from "./components";

export function Dashboard({ filter = "all" }) {
  const { state, createQuestion, createProject, openDemo, status, connect } =
    useWB();
  const [localFilter, setLocalFilter] = useState("all");
  const actual = filter === "all" ? localFilter : filter;
  const pages = state.pages.filter(
    (p) => actual === "all" || p.kind === actual,
  );
  return (
    <div className="page">
      <div className="hero">
        <div>
          <div className="eyebrow">A QUIETER SPACE FOR YOUR IDEAS</div>
          <h1>
            让想法，<em>长成作品。</em>
          </h1>
          <p>
            从一个问题开始，让知识有序积累，让项目持续向前。
            <br />
            AI 负责创造，WB 帮你留住每一步。
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span>
            <Icon name="note" />
          </span>
          <span>
            <Icon name="spark" />
          </span>
          <span>
            <Icon name="layers" />
          </span>
          <span>
            <Icon name="code" />
          </span>
        </div>
      </div>
      <div className="mode-grid">
        <button
          className="mode-card"
          onClick={createQuestion}
          style={{ display: "block", textAlign: "left" }}
        >
          <div className="mode-icon">
            <Icon name="note" />
          </div>
          <span className="card-tag">KNOWLEDGE</span>
          <h2>从一个问题开始</h2>
          <p>把零散问答，整理成可以持续生长的知识页面。</p>
          <span className="arrow">
            <Icon name="arrow" />
          </span>
        </button>
        <button
          className="mode-card project"
          onClick={() => createProject()}
          style={{ display: "block", textAlign: "left" }}
        >
          <div className="mode-icon">
            <Icon name="folder" />
          </div>
          <span className="card-tag">PROJECT</span>
          <h2>让一个想法落地</h2>
          <p>生成专属开发窗口与 WB 助手，管理项目的每一步。</p>
          <span className="arrow">
            <Icon name="arrow" />
          </span>
        </button>
      </div>
      <div className="section-heading">
        <h2>
          最近的工作
          <span>
            <small>{pages.length}</small>
          </span>
        </h2>
        {filter === "all" && (
          <div className="filters">
            {[
              ["all", "全部"],
              ["question", "问答"],
              ["project", "项目"],
            ].map(([key, label]) => (
              <button
                className={`filter ${actual === key ? "active" : ""}`}
                key={key}
                onClick={() => setLocalFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {pages.length ? (
        <div className="workspace-grid">
          {pages.map((page) => (
            <a
              className="workspace-card"
              href={`#/page/${page.id}`}
              key={page.id}
            >
              <div className="card-top">
                <Icon name={page.kind === "project" ? "folder" : "note"} />
                <span
                  className={`tag ${page.kind === "question" ? "blue" : ""}`}
                >
                  {page.kind === "project" ? "WB 助手" : "知识页面"}
                </span>
              </div>
              <h3 className="truncate">{page.title}</h3>
              <p>{page.summary || "等待补充内容，让想法逐步清晰。"}</p>
              <div className="card-footer">
                <span>{page.modules.length} 个内容模块</span>
                <span>{timeLabel(page.updatedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Empty
          title="这里将装下你的下一个想法"
          description="在 WB 中开始聊天，或者先体验一个记账 App 的开发空间。"
        >
          <Button icon="spark" onClick={openDemo}>
            体验记账 App 示例
          </Button>
        </Empty>
      )}
      <div className="bottom-grid">
        <section>
          <div className="section-heading">
            <h2>最近动态</h2>
            <span className="eyebrow">ACTIVITY</span>
          </div>
          {state.events.length ? (
            state.events.slice(0, 5).map((event) => (
              <div className="activity" key={event.id}>
                <span className="activity-icon">
                  <Icon
                    name={
                      event.type === "created"
                        ? "plus"
                        : event.type === "development"
                          ? "code"
                          : "refresh"
                    }
                  />
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <p>
                    {state.pages.find((p) => p.id === event.pageId)?.title ||
                      "工作空间"}
                  </p>
                </div>
                <time>{timeLabel(event.at)}</time>
              </div>
            ))
          ) : (
            <p className="page-subtitle">
              开始后，创建、编辑与开发记录会出现在这里。
            </p>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>你的 AI，随时就位</h2>
            <Icon name="spark" />
          </div>
          <div className="connection-card">
            <h3>
              <span
                className={`status-dot ${status?.connected ? "" : "off"}`}
              />
              Codex{" "}
              {status?.connected
                ? "已连接"
                : status?.available
                  ? "已在本机检测到"
                  : "等待连接"}
            </h3>
            <p>
              沿用你熟悉的 AI
              能力。在目标项目里全局开发，或点选页面中的一个位置，继续对话。
            </p>
            <div className="actions">
              <Button small onClick={connect} icon="link">
                {status?.connected ? "检查连接" : "连接 Codex"}
              </Button>
              <Button small quiet onClick={() => go("/settings")}>
                查看设置
                <Icon name="arrow" />
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Button quiet onClick={openDemo}>
        体验记账 App 示例
        <Icon name="arrow" />
      </Button>
      <div className="footer-note">
        <Icon name="layers" />
        有结构的内容，有来路的决策，有记录的进展。
      </div>
    </div>
  );
}
export function Architecture() {
  return (
    <div className="page">
      <div className="eyebrow">PRODUCT BLUEPRINT · V0.1</div>
      <h1 className="page-title">一套 AI 能力，三个工作界面</h1>
      <p className="page-subtitle">
        Codex 提供大模型、Agent 与工具能力。WB
        在其上组织信息、承载交互，并管理开发过程。
      </p>
      <div className="diagram">
        <div className="diagram-card">
          <h3>Codex / CC</h3>
          <p>
            模型 · Agent · 工具 · MCP
            <br />
            第一版实际接入 Codex
          </p>
        </div>
        <div className="diagram-arrow">→</div>
        <div className="diagram-card">
          <h3>内容与交互引擎</h3>
          <p>
            页面生成、位置定位、会话管理
            <br />
            原始记录、结构化内容、分类同步
          </p>
        </div>
        <div className="diagram-arrow">→</div>
        <div className="diagram-card">
          <h3>WB 首页 / 项目 / 局部</h3>
          <p>
            WB 首页聊天与内容管理
            <br />
            目标项目开发窗口
            <br />
            项目专属管理页面
          </p>
        </div>
      </div>
      <table className="architecture-table">
        <thead>
          <tr>
            <th>核心部件</th>
            <th>职责</th>
            <th>当前实现</th>
          </tr>
        </thead>
        <tbody>
          {[
            [
              "WB 首页",
              "直接打开即可聊天、调研或确认项目，收纳对应记录、资源与搜索资料。",
              "首页总聊天 + 结构化内容管理",
            ],
            [
              "页面引擎",
              "生成问答页与项目专属 WB，支持独立 HTML 导出和自定义页面。",
              "React 界面 + 独立页面渲染",
            ],
            [
              "开发窗口",
              "启动项目后立即出现底部聊天框；页面生成后，上方预览成果。",
              "全局聊天 + 静态 Web 项目预览",
            ],
            [
              "局部交互",
              "点选目标页面区域，在附近打开小型聊天窗，传递位置和项目上下文。",
              "开发预览注入点选层，React 展示小窗口",
            ],
            [
              "Agent 连接",
              "连接已有 AI 能力，管理持续会话、流式回复、停止与交互请求。",
              "Codex App Server；CC 尚未接入",
            ],
            [
              "内容与记忆",
              "完整保留本产品内的对话和协议事件，关联资料、需求、方案。",
              "SQLite + 来源记录 + MCP 内容更新",
            ],
            [
              "同步与版本",
              "按类型自动或手动同步，保留用户编辑与历史版本。",
              "文件变化同步、对话记录、版本恢复",
            ],
          ].map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="notice">
        打开 WB → 首页聊天 / 调研 → 确认启动项目 → 生成目标项目开发窗口 →
        全局或局部下达指令 → Codex 开发目标项目 → WB 同步记录。
        <br />
        WB 自身可以被 AI 改造；目标项目的实际开发在其专属开发窗口中进行。
      </div>
      <div className="module">
        <h3>页面设计自由，项目数据保持独立</h3>
        <p style={{ marginTop: 13 }}>
          每个 WB 可以拥有完全不同的布局和功能。原始记录、模块
          ID、版本和项目关联保存在共享数据层，页面改版不会自动抹掉它们。浏览器中直接编辑的内容也会形成版本。
        </p>
      </div>
    </div>
  );
}
export function Settings() {
  const { status, connect, refreshStatus, notify } = useWB();
  const [provider, setProvider] = useState(null);
  const [claudeBinary, setClaudeBinary] = useState(null);
  const [saving, setSaving] = useState(false);
  const codex = status?.codex || status;
  return (
    <div className="page">
      <div className="eyebrow">CONNECTIONS & PREFERENCES</div>
      <h1 className="page-title">沿用你熟悉的 AI 能力</h1>
      <p className="page-subtitle">
        选择 Codex 或 Claude Code 提供模型和工具。WB 管理界面、位置上下文与开发记录。
      </p>
      <section className="module" style={{ marginTop: 28 }} aria-label="AI 接入设置">
        <h3>默认 AI</h3>
        <label className="field">新会话使用
          <select aria-label="默认 AI" value={provider ?? status?.settings?.provider ?? "codex"} onChange={(event) => setProvider(event.target.value)}>
            <option value="codex">Codex</option>
            <option value="claude">Claude Code</option>
          </select>
        </label>
        <label className="field">Claude Code 可执行文件路径（可选）
          <input aria-label="Claude Code 可执行文件路径" placeholder="留空自动检测 CLI 或 VS Code 插件" value={claudeBinary ?? status?.settings?.claudeBinary ?? ""} onChange={(event) => setClaudeBinary(event.target.value)} />
        </label>
        <p>只填写 claude 程序的完整路径，不要填写 API Key 或命令参数。切换后新会话使用所选 AI；已有会话继续使用原 AI。</p>
        <Button disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            await api("/agent/settings", { provider: provider ?? status?.settings?.provider ?? "codex", claudeBinary: claudeBinary ?? status?.settings?.claudeBinary ?? "" });
            await refreshStatus();
            notify("AI 设置已保存，新会话将使用所选 AI");
          } catch (error) { notify(error.message); }
          finally { setSaving(false); }
        }}>{saving ? "保存中…" : "保存 AI 设置"}</Button>
      </section>
      <div className="module" style={{ marginTop: 28 }}>
        <div className="module-head">
          <h3>Codex</h3>
          <span className="tag">
            {codex?.connected
              ? "进程已连接"
              : codex?.available
                ? "已检测到"
                : "未检测到"}
          </span>
        </div>
        <p>
          {codex?.version || "在本机安装 Codex 后，可以在这里连接。"}
          <br />
          连接时使用本机 Codex
          的现有配置。已有插件会话不会自动搬入新窗口；本产品的会话会持续保存。
        </p>
        <div className="actions" style={{ marginTop: 17 }}>
          <Button icon="link" primary onClick={() => connect("codex")}>
            连接 / 检查 Codex
          </Button>
        </div>
        {codex?.connected && (
          <div className="notice">
            {codex.signedIn
              ? "已读取到本机登录状态。发送指令将实际使用你的 Codex 账户。"
              : "尚未确认登录状态。请先在 Codex 中完成登录。"}
          </div>
        )}
      </div>
      <div className="module">
        <div className="module-head">
          <h3>Claude Code</h3>
          <span className="tag">{status?.claude?.available ? status.claude.signedIn ? "已检测到 · 已登录" : "已检测到 · 待登录" : "未检测到"}</span>
        </div>
        <p>{status?.claude?.version || "支持本机 Claude Code CLI 与 VS Code 插件内置程序。"}</p>
        {status?.claude?.binary && <p style={{ overflowWrap: "anywhere" }}>检测路径：{status.claude.binary}</p>}
        <p>使用本机 Claude Code 的登录与配置，不导入 VS Code 中的既有聊天。支持流式回复、独立子对话、续聊、停止及 WB MCP 工具。</p>
        <p>保留 Claude Code 权限限制，不使用跳过权限模式。当前 WB 不弹出 Claude 工具授权窗口：未获授权的文件修改或命令会被拒绝，请在 Claude Code 中配置所需权限后重试。运行可能使用你的账户额度。</p>
        <Button icon="link" onClick={() => connect("claude")}>检查 Claude Code</Button>
      </div>
      <div className="module">
        <h3>WB 内置聊天已经连接内容工具</h3>
        <p style={{ marginTop: 12 }}>
          在首页聊天即可提问、整理资料并确认创建项目。WB 启动的 Codex
          会话会自动加载本项目的 MCP 工具，不需要先回到 VS Code 发起对话。
        </p>
      </div>
      <div className="module">
        <h3>让原 Codex 聊天窗口生成问答页与 WB</h3>
        <p style={{ marginTop: 12 }}>
          本项目提供 MCP 工具。按 README 中的配置接入后，可以直接让 Codex
          创建页面、更新模块、保存记录和启动项目。工具操作与网页共享同一个本地内容库。
        </p>
        <div className="codebox" style={{ marginTop: 14 }}>
          npm run mcp
          <br />
          工具：wb_list_pages · wb_create_page · wb_start_project ·
          wb_update_page · wb_record · wb_sync_update
        </div>
        <p style={{ marginTop: 12 }}>
          MCP 配置需要在你的 Codex
          中启用；当前聊天窗口不会因网页启动而自动连接。
        </p>
      </div>
      <div className="module">
        <h3>同步设置属于每个项目</h3>
        <p style={{ marginTop: 12 }}>
          在项目 WB
          的「同步设置」中，分别设置资料、对话、进度和决策的同步方式。原始开发对话始终保存在记录库中，分类设置控制其管理信息的同步。
        </p>
      </div>
    </div>
  );
}
