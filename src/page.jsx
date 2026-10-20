import React, { useState, useEffect, useCallback, useRef } from "react";
import { api, download, timeLabel, go } from "./api";
import { useWB } from "./context";
import { Icon, Button, Empty } from "./components";
import { HubChat } from "./hub-chat";
import { ResourcePanel } from "./resource-panel";
import { HighlightPanel } from "./highlight-panel";
import { ProjectSidebar } from "./project-sidebar";
import { TodoPanel } from "./todo-panel";
import { ProjectPlanning } from "./project-planning";

export function PageView({ pageId, initialTab = "overview" }) {
  const { state, refresh, notify, setModal, createProject } = useWB();
  const [managementOpen, setManagementOpen] = useState(
    () => window.innerWidth > 1100,
  );
  const managementToggle = useRef(null);
  const closeManagement = () => {
    setManagementOpen(false);
    managementToggle.current?.focus();
  };
  const [detail, setDetail] = useState(null),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setDetail(await api(`/pages/${pageId}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [pageId]);
  useEffect(() => {
    load();
    const fn = (event) => {
      if (
        [
          "state-changed",
          "files-changed",
          "turn-completed",
          "message-completed",
          "tool",
        ].includes(event.detail.type) &&
        (!event.detail.pageId || event.detail.pageId === pageId)
      )
        load();
    };
    window.addEventListener("wb-event", fn);
    return () => window.removeEventListener("wb-event", fn);
  }, [load]);
  if (error)
    return (
      <div className="page">
        <Empty title="暂时无法打开页面" description={error} />
      </div>
    );
  if (!detail) return <div className="loading">正在打开内容…</div>;
  const { page, records, sessions, versions, events } = detail;
  const ManagementContainer = page.kind === "question" ? "aside" : "div";
  const PlanningContainer = page.kind === "project" ? ProjectPlanning : React.Fragment;
  const save = async (patch, label = "已保存") => {
    try {
      await api(
        `/pages/${page.id}`,
        { ...patch, expectedRevision: page.revision },
        "PATCH",
      );
      await load();
      await refresh();
      notify(label);
    } catch (err) {
      notify(err.message);
      throw err;
    }
  };
  const editModule = (module) =>
    setModal({
      type: "form",
      title: module ? "编辑内容模块" : "添加内容模块",
      fields: [
        {
          name: "title",
          label: "模块标题",
          value: module?.title,
          required: true,
        },
        {
          name: "type",
          label: "类型",
          type: "select",
          value: module?.type || "text",
          options: [
            { value: "text", label: "文字与方案" },
            { value: "tasks", label: "任务清单" },
            { value: "links", label: "资源链接" },
          ],
        },
        {
          name: "content",
          label: "内容",
          type: "textarea",
          value:
            module?.type === "tasks"
              ? module.items
                  .map((i) => `${i.done ? "[x] " : "[ ] "}${i.text}`)
                  .join("\n")
              : module?.type === "links"
                ? module.items.map((i) => `${i.text} | ${i.url}`).join("\n")
                : module?.content,
          hint: "任务每行一项，[x] 表示完成；资源链接每行填写：标题 | https://网址。",
        },
      ],
      onSubmit: async (input) => {
        const next = {
          ...module,
          title: input.title,
          type: input.type,
          content: input.type === "text" ? input.content : "",
          items:
            input.type === "tasks"
              ? input.content
                  .split("\n")
                  .filter((x) => x.trim())
                  .map((line, index) => ({
                    id: module?.items?.[index]?.id,
                    text: line.replace(/^\s*\[[ xX]\]\s*/, ""),
                    done: /^\s*\[[xX]\]/.test(line),
                  }))
              : input.type === "links"
                ? input.content
                    .split("\n")
                    .filter((x) => x.trim())
                    .map((line, index) => {
                      const split = line.indexOf("|");
                      return {
                        id: module?.items?.[index]?.id,
                        text: (split < 0 ? line : line.slice(0, split)).trim(),
                        url: (split < 0 ? "" : line.slice(split + 1)).trim(),
                      };
                    })
                : [],
        };
        await save({
          modules: module
            ? page.modules.map((m) => (m.id === module.id ? next : m))
            : [...page.modules, next],
        });
      },
    });
  const editPage = () =>
    setModal({
      type: "form",
      title: "编辑页面信息",
      fields: [
        { name: "title", label: "标题", value: page.title, required: true },
        {
          name: "summary",
          label: "简介",
          type: "textarea",
          value: page.summary,
        },
      ],
      onSubmit: (input) => save(input),
    });
  const importRecord = () =>
    setModal({
      type: "form",
      title: "保存原始资料 / 对话",
      description:
        "原文完整保存，不用摘要替代原始记录。已有 Codex 插件历史可以通过粘贴导入。",
      fields: [
        {
          name: "title",
          label: "记录名称",
          required: true,
          placeholder: "例如：关于技术选型的完整讨论",
        },
        { name: "raw", label: "原始内容", type: "textarea", required: true },
        { name: "origin", label: "来源", value: "手动导入" },
      ],
      onSubmit: async (input) => {
        await api(`/pages/${page.id}/records`, input);
        await load();
        notify("原始记录已完整保存");
      },
    });
  const showRecord = async (record) => {
    try {
      const all = await api(`/pages/${page.id}/records`);
      setModal({
        title: record.title,
        content: (
          <pre className="raw-text">
            {all.find((r) => r.id === record.id)?.raw}
          </pre>
        ),
      });
    } catch (err) {
      notify(err.message);
    }
  };
  const showSession = async (session) =>
    setModal({
      title:
        session.anchorKey === "global"
          ? "全局开发对话"
          : `局部对话 · ${session.anchor.label}`,
      content: (
        <>
          <p className="modal-description">
            会话 {session.id} · {session.messages.length} 条消息
          </p>
          <div className="raw-text">
            {session.messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 18 }}>
                <strong>
                  {m.role === "user" ? "你" : "Codex"} · {timeLabel(m.at)}
                </strong>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <Button
              onClick={async () => {
                const raw = await api(`/sessions/${session.id}/raw`);
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(raw, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `${session.id}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              导出完整协议记录
            </Button>
          </div>
        </>
      ),
    });
  const tasks = page.modules
      .filter((m) => m.type === "tasks")
      .flatMap((m) => m.items),
    done = tasks.filter((i) => i.done).length;
  return (
    <div
      className={`page ${page.kind === "question" ? `conversation-page with-management ${managementOpen ? "management-open" : ""}` : "project-management-page"}`}
    >
      {page.kind === "question" && (
        <div className="conversation-main">
          <header className={`conversation-toolbar ${managementOpen ? "" : "management-folded"}`}>
            <button
              ref={managementToggle}
              className="btn management-toggle"
              title={managementOpen ? "折叠资料与管理" : "展开资料与管理"}
              aria-expanded={managementOpen}
              aria-controls="wb-management"
              onClick={() => setManagementOpen(!managementOpen)}
            >
              <Icon name="sidebar" />
              <span>资料与管理</span>
              {!managementOpen && <Icon name="chevron" className="management-expand-arrow" />}
            </button>
          </header>
          <HubChat
            key={page.id}
            pageId={page.id}
            mode={page.entryType === "task" ? "task" : "chat"}
          />
        </div>
      )}
      {page.kind === "project" && <ProjectSidebar page={page} active={tab} onSelect={(key) => key === "development" ? go(`/develop/${page.id}`) : setTab(key)} />}
      <ManagementContainer
        id={page.kind === "question" ? "wb-management" : undefined}
        className={
          page.kind === "question" ? "wb-management-sidebar" : "project-management-content"
        }
        aria-label={page.kind === "question" ? "资料与管理" : undefined}
        hidden={page.kind === "question" && !managementOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented)
            closeManagement();
        }}
      >
        {page.kind === "question" && (
          <div className="management-sidebar-heading">
            <strong>资料与管理</strong>
            <Button
              quiet
              small
              icon="sidebar"
              aria-label="收起资料与管理"
              title="折叠资料与管理"
              onClick={closeManagement}
            />
          </div>
        )}
        <div className="eyebrow">
          {page.kind === "project"
            ? "PROJECT COMPANION / WB"
            : page.entryType === "task"
              ? "TASK COMPANION / WB"
              : "CONVERSATION / WB"}
        </div>
        <div className="page-heading">
          <div>
            {page.kind === "project" && (
              <h1 className="page-title">{page.title}</h1>
            )}
            <p className="page-subtitle">{page.summary}</p>
          </div>
          <div className="actions">
            <Button icon="edit" onClick={editPage}>
              编辑
            </Button>
            <Button
              icon="download"
              onClick={() =>
                download(page.id, page.title).catch((err) =>
                  notify(err.message),
                )
              }
            >
              导出
            </Button>
            {page.kind === "question" ? (
              <Button primary icon="arrow" onClick={() => createProject(page)}>
                启动项目
              </Button>
            ) : (
              <Button
                primary
                icon="code"
                onClick={() => go(`/develop/${page.id}`)}
              >
                进入开发窗口
              </Button>
            )}
          </div>
        </div>
        {page.kind === "question" && <nav className="tabs">
          {[
            ["overview", "项目规划"],
            ["resources", "资源"],
            ["highlights", "重点"],
            ["records", "原始记录"],
            ...(page.kind === "project"
              ? [
                  ["files", "开发资料"],
                  ["sync", "同步设置"],
                ]
              : []),
            ["versions", "版本历史"],
            ...(page.customHtml ? [["custom", "专属页面"]] : []),
          ].map(([key, label]) => (
            <button
              className={`tab ${key === tab ? "active" : ""}`}
              key={key}
              onClick={() => setTab(key)}
            >
              {page.kind === "question" && key === "overview"
                ? "内容概览"
                : label}
            </button>
          ))}
        </nav>}
        {page.kind === "project" && tab === "todo" && <TodoPanel page={page} onSave={(patch) => save(patch, "Todo 已保存")} />}
        {tab === "overview" && (
          <div className="management-layout">
            <div>
              <PlanningContainer {...(page.kind === "project" ? { page, onSave: (patch) => save(patch, "项目规划已保存") } : {})}>
              {page.modules.length ? (
                page.modules.filter((module) => !(page.kind === "project" && module.type === "text" && ["第一版范围", "开发规范", "参考项目"].includes(module.title))).map((module) => (
                  <section className="module" key={module.id}>
                    <div className="module-head">
                      <h3>{module.title}</h3>
                      <Button
                        quiet
                        small
                        icon="edit"
                        aria-label={`编辑${module.title}`}
                        onClick={() => editModule(module)}
                      />
                    </div>
                    {module.content && <p>{module.content}</p>}
                    {module.type === "tasks" &&
                      module.items.map((item) => (
                        <label
                          className={`task ${item.done ? "done" : ""}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(e) =>
                              save(
                                {
                                  modules: page.modules.map((m) =>
                                    m.id === module.id
                                      ? {
                                          ...m,
                                          items: m.items.map((i) =>
                                            i.id === item.id
                                              ? { ...i, done: e.target.checked }
                                              : i,
                                          ),
                                        }
                                      : m,
                                  ),
                                },
                                "任务状态已保存",
                              ).catch(() => {})
                            }
                          />
                          <span>{item.text}</span>
                        </label>
                      ))}
                    {module.type === "links" &&
                      module.items.map((item) => (
                        <div className="task" key={item.id}>
                          <Icon name="link" />
                          {/^https?:\/\//.test(item.url) ? (
                            <a href={item.url} target="_blank" rel="noreferrer">
                              {item.text}
                            </a>
                          ) : (
                            <span>{item.text}</span>
                          )}
                        </div>
                      ))}
                  </section>
                ))
              ) : (
                <Empty
                  title="内容正在生长"
                  description="添加模块，或者让 Codex 通过 WB 工具生成页面内容。"
                />
              )}
              </PlanningContainer>
              {page.kind !== "project" && <Button icon="plus" onClick={() => editModule()}>
                添加内容模块
              </Button>}
              {page.kind !== "project" && !!page.updates?.length && (
                <>
                  <div className="section-heading">
                    <h2>同步记录</h2>
                  </div>
                  {[...page.updates]
                    .reverse()
                    .slice(0, 10)
                    .map((update) => (
                      <div className="module" key={update.id}>
                        <div className="module-head">
                          <h3>
                            {update.content?.title ||
                              {
                                progress: "进度记录",
                                decisions: "项目决策",
                                conversations: "开发对话",
                              }[update.category]}
                          </h3>
                          <span className="tag">{timeLabel(update.at)}</span>
                        </div>
                        <p>
                          {typeof update.content === "string"
                            ? update.content
                            : update.content?.summary ||
                              JSON.stringify(update.content)}
                        </p>
                        {update.content?.sessionId && (
                          <Button
                            small
                            quiet
                            onClick={() => {
                              const session = sessions.find(
                                (s) => s.id === update.content.sessionId,
                              );
                              if (session) showSession(session);
                            }}
                          >
                            查看原始对话
                            <Icon name="arrow" />
                          </Button>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
            <aside className="management-aside">
              <div className="meta-card">
                <h3>工作空间信息</h3>
                <div className="meta-row">
                  <span>类型</span>
                  <strong>
                    {page.kind === "project"
                      ? "项目 WB"
                      : page.entryType === "task"
                        ? "任务 WB"
                        : "对话 WB"}
                  </strong>
                </div>
                <div className="meta-row">
                  <span>内容版本</span>
                  <strong>v{page.revision}</strong>
                </div>
                <div className="meta-row">
                  <span>上次更新</span>
                  <strong>{timeLabel(page.updatedAt)}</strong>
                </div>
                <div className="meta-row">
                  <span>原始记录</span>
                  <strong>{records.length + sessions.length} 组</strong>
                </div>
                {page.rootPath && (
                  <>
                    <div className="meta-row">
                      <span>目标项目目录</span>
                    </div>
                    <div className="meta-path mono">{page.rootPath}</div>
                  </>
                )}
              </div>
              {page.kind === "project" && (
                <div className="meta-card">
                  <h3>开发进度</h3>
                  <div className="meta-row">
                    <span>已确认完成</span>
                    <strong>
                      {done} / {tasks.length}
                    </strong>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="meta-path">
                    文件变化与 AI 回复不会自动将任务标记为完成。
                  </p>
                </div>
              )}
              <div className="meta-card">
                <h3>最近记录</h3>
                {events.slice(0, 4).map((event) => (
                  <div key={event.id} style={{ margin: "13px 0" }}>
                    <div style={{ fontSize: 11, color: "#75886a" }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: 9, color: "#a0ac96" }}>
                      {timeLabel(event.at)}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
        {tab === "highlights" && <HighlightPanel pageId={page.id} records={records} />}
        {tab === "resources" && (
          <ResourcePanel page={page} sessions={sessions} />
        )}
        {tab === "records" && (
          <>
            <div className="section-heading">
              <h2>完整记录，随时回溯</h2>
              <Button icon="plus" onClick={importRecord}>
                导入原始记录
              </Button>
            </div>
            <p className="page-subtitle">
              这里保留原文；整理后的结论放在管理模块中。通过开发窗口产生的全局与局部会话会自动记录。
            </p>
            {!records.length && !sessions.length && (
              <Empty
                title="还没有原始记录"
                description="导入已有资料，或进入开发窗口与 Codex 开始对话。"
              />
            )}
            {records.map((record) => (
              <div className="record-card" key={record.id}>
                <div>
                  <h3>{record.title}</h3>
                  <p>
                    {record.origin} · {record.length.toLocaleString()} 字符 ·{" "}
                    {timeLabel(record.at)}
                  </p>
                </div>
                <Button small onClick={() => showRecord(record)}>
                  查看原文
                </Button>
              </div>
            ))}
            {sessions.map((session) => (
              <div className="record-card" key={session.id}>
                <div>
                  <h3>
                    {session.anchorKey === "global"
                      ? "全局开发会话"
                      : `局部 · ${session.anchor.label || session.anchorKey}`}
                  </h3>
                  <p>
                    {session.messages.length} 条消息 ·{" "}
                    {timeLabel(session.createdAt)}
                  </p>
                </div>
                <Button small onClick={() => showSession(session)}>
                  查看完整对话
                </Button>
              </div>
            ))}
          </>
        )}
        {tab === "files" && (
          <>
            <div className="section-heading">
              <h2>目标项目文件</h2>
              <Button
                icon="refresh"
                onClick={async () => {
                  try {
                    await api(`/pages/${page.id}/sync`, {});
                    await load();
                    notify("已同步最新开发信息");
                  } catch (err) {
                    notify(err.message);
                  }
                }}
              >
                立即同步
              </Button>
            </div>
            <p className="page-subtitle">
              已关联 {page.files.length}{" "}
              个文件。这里只读跟踪文件变化；代码开发在目标项目中进行。
            </p>
            {page.files.length ? (
              page.files.map((file) => (
                <div className="file-row" key={file.path}>
                  <Icon name="file" />
                  <span className="mono">{file.path}</span>
                  <time>
                    {(file.size / 1024).toFixed(1)} KB ·{" "}
                    {timeLabel(file.modifiedAt)}
                  </time>
                </div>
              ))
            ) : (
              <Empty
                title="等待项目生成第一份文件"
                description="在项目开发窗口发送第一条指令后，生成的文件会出现在这里。"
              />
            )}
          </>
        )}
        {tab === "sync" && (
          <div className="module">
            <h3>根据内容选择同步方式</h3>
            <div className="setting-row">
              <div>
                <strong>开启自动同步</strong>
                <p>关闭后，信息会进入待同步列表，仍可手动同步。</p>
              </div>
              <input
                aria-label="开启自动同步"
                className="switch"
                type="checkbox"
                checked={page.sync.enabled}
                onChange={(e) =>
                  save({ sync: { enabled: e.target.checked } }).catch(() => {})
                }
              />
            </div>
            {[
              ["materials", "开发资料", "项目文件及其更新情况"],
              [
                "conversations",
                "开发对话",
                "同步开发会话的记录摘要，原始会话始终保留",
              ],
              ["progress", "任务进度", "通过工具提交的进度记录"],
              ["decisions", "项目决策", "通过工具提交的方案与决策记录"],
            ].map(([key, label, description]) => (
              <div className="setting-row" key={key}>
                <div>
                  <strong>{label}</strong>
                  <p>{description}</p>
                </div>
                <select
                  aria-label={`${label}同步方式`}
                  value={page.sync[key]}
                  onChange={(e) =>
                    save({ sync: { [key]: e.target.value } }).catch(() => {})
                  }
                >
                  <option value="auto">自动同步</option>
                  <option value="manual">手动同步</option>
                </select>
              </div>
            ))}
            <div className="setting-row">
              <div>
                <strong>{page.pending.length} 项待同步信息</strong>
                <p>手动同步将应用当前所有待同步记录。</p>
              </div>
              <Button
                icon="refresh"
                onClick={async () => {
                  await api(`/pages/${page.id}/sync`, {});
                  await load();
                  notify("同步完成");
                }}
              >
                立即同步
              </Button>
            </div>
          </div>
        )}
        {tab === "versions" && (
          <>
            <p className="page-subtitle">
              恢复旧版会形成一个新版本，原始对话与开发文件不受影响。
            </p>
            {versions.map((version) => (
              <div className="record-card" key={version.id}>
                <div>
                  <h3>
                    版本 {version.revision} · {version.reason}
                  </h3>
                  <p>{timeLabel(version.at)}</p>
                </div>
                <Button
                  small
                  disabled={version.revision === page.revision}
                  onClick={() =>
                    setModal({
                      type: "form",
                      title: `恢复到版本 ${version.revision}`,
                      description:
                        "将恢复此版本的标题、简介和内容模块。当前版本仍然保留，可再次恢复。",
                      fields: [],
                      submitLabel: "恢复此版本",
                      onSubmit: async () => {
                        await api(`/pages/${page.id}/restore`, {
                          versionId: version.id,
                        });
                        await load();
                        await refresh();
                        notify("已恢复，历史版本仍保留");
                      },
                    })
                  }
                >
                  恢复
                </Button>
              </div>
            ))}
          </>
        )}
        {tab === "custom" && (
          <iframe
            title={`${page.title}专属页面`}
            className="custom-preview"
            sandbox="allow-scripts"
            src={`${state.previewOrigin}/page/${page.id}`}
          />
        )}
      </ManagementContainer>
    </div>
  );
}
