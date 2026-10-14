import React, { useState, useEffect, useRef, useCallback } from "react";
import { api, go } from "./api";
import { useWB } from "./context";
import { Icon, Button, Modal } from "./components";
import { ProjectSidebar } from "./project-sidebar";
import { TodoPanel } from "./todo-panel";
import { DevelopmentReports } from "./development-reports";
import { RegionNavigator } from "./region-navigator";

export function ChatPane({
  session,
  stream = "",
  onSend,
  onStop,
  global = false,
  busy,
  tool,
  hub = false,
  welcome = false,
  composerOnly = false,
  initialText = "",
  inputLabel,
  inputPlaceholder,
  composerActions,
  autoGrow = false,
}) {
  const [text, setText] = useState(initialText),
    [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const scroll = useRef(null);
  const composing = useRef(false);
  const input = useRef(null);
  useEffect(() => {
    if (!autoGrow || !input.current) return;
    const element = input.current;
    const resize = () => {
      element.style.height = "0px";
      element.style.height = `${Math.min(120, Math.max(44, element.scrollHeight))}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [text, autoGrow]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [session?.messages?.length, stream]);
  const submit = async (event) => {
    event.preventDefault();
    if (
      !text.trim() ||
      busy ||
      sending ||
      !session ||
      session.status === "running"
    )
      return;
    const value = text;
    setSending(true);
    setError("");
    setText("");
    try {
      await onSend(value);
    } catch (err) {
      setText(value);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      {!composerOnly && (
        <div className="chat-messages" ref={scroll} aria-live="polite">
          {session?.messages.map((message) => (
            <div className={`chat-msg ${message.role}`} key={message.id}>
              {message.partial && <span className="tag">未完成</span>}
              <div className="text">{message.text}</div>
            </div>
          ))}
          {stream && (
            <div className="chat-msg">
              <span className="connecting" role="status" aria-label="正在生成">●</span>
              <div className="text">{stream}</div>
            </div>
          )}
        </div>
      )}
      {!composerOnly && !welcome && !session?.messages.length && !stream && (
        <div className="chat-welcome">
          {hub
            ? "提一个问题、调研一个想法，或者一起确定你的下一个项目。"
            : global
              ? "开发窗口已就绪。描述你的想法，或给出第一条整体开发指令。"
              : "围绕选中的位置继续追问，或告诉 Codex 你希望怎样修改。"}
        </div>
      )}
      {tool && (
        <div className="tool-line">
          <Icon
            name="code"
            style={{ width: 12, height: 12, verticalAlign: "middle" }}
          />{" "}
          {tool}
        </div>
      )}
      {error && (
        <div className="agent-error" role="alert">
          {error}
        </div>
      )}
      {session?.error && !error && (
        <div className="agent-error">{session.error}</div>
      )}
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={input}
          aria-label={
            inputLabel ||
            (hub ? "WB 聊天输入" : global ? "全局开发指令" : "局部开发指令")
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            inputPlaceholder ||
            (hub
              ? "我想做一个… / 帮我研究… / 我有一个问题…"
              : global
                ? "例如：帮我开发一个简洁的记账 App，支持添加收入与支出…"
                : "例如：把这个区域改成月度支出趋势图…")
          }
          rows={global ? 2 : 3}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !composing.current &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229
            ) {
              e.preventDefault();
              if (!e.repeat) e.currentTarget.form.requestSubmit();
            }
          }}
        />
        {composerActions && <div className="composer-actions">{composerActions}</div>}
        {session?.status === "running" ? (
          <button
            className="send-button"
            type="button"
            aria-label="停止执行"
            title="停止执行"
            onClick={onStop}
          >
            <Icon name="stop" />
          </button>
        ) : (
          <button
            className="send-button"
            type="submit"
            aria-label={
              hub ? "发送 WB 消息" : global ? "发送全局指令" : "发送局部指令"
            }
            disabled={busy || sending || !text.trim() || !session}
            title="发送到 AI"
          >
            <Icon name="send" />
          </button>
        )}
      </form>
      {sending && <div className="tool-line connecting">正在接入 AI…</div>}
    </>
  );
}

export function Approval({ request, onReply }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const questions = request.params.questions || [];
  const isQuestion = request.method === "item/tool/requestUserInput";
  const reply = async (value) => {
    setBusy(true);
    try {
      await onReply(value);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={isQuestion ? "Codex 需要你补充信息" : "Codex 请求执行操作"}
      onClose={() => reply(isQuestion ? { answers: {} } : { approve: false })}
    >
      <p className="modal-description">来自当前目标项目的开发会话。</p>
      {isQuestion ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            reply({
              answers: Object.fromEntries(
                questions.map((q) => [
                  q.id,
                  { answers: [String(values.get(q.id) || "")] },
                ]),
              ),
            });
          }}
        >
          {questions.map((q) => (
            <label key={q.id} className="field">
              <span>{q.question || q.header}</span>
              <input name={q.id} list={`options-${q.id}`} required />
              <datalist id={`options-${q.id}`}>
                {q.options?.map((o) => (
                  <option key={o.label} value={o.label} />
                ))}
              </datalist>
            </label>
          ))}
          <div className="modal-actions">
            <Button primary disabled={busy} type="submit">
              提交回答
            </Button>
          </div>
        </form>
      ) : (
        <>
          <pre className="raw-text">
            {request.params.command ||
              request.params.reason ||
              JSON.stringify(request.params, null, 2)}
          </pre>
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => reply({ approve: false })}>
              拒绝
            </Button>
            <Button
              primary
              disabled={busy}
              onClick={() => reply({ approve: true })}
            >
              允许本次
            </Button>
          </div>
        </>
      )}
      {error && <div className="agent-error">{error}</div>}
    </Modal>
  );
}

export function Development({ pageId, initialSessionId, onOpenSidebar }) {
  const [section, setSection] = useState("development");
  const { state, status, notify } = useWB();
  const [page, setPage] = useState(null),
    [sessions, setSessions] = useState({}),
    [globalId, setGlobalId] = useState(null),
    [local, setLocal] = useState(null),
    [pick, setPick] = useState(false),
    [streams, setStreams] = useState({}),
    [tools, setTools] = useState({}),
    [loadingError, setLoadingError] = useState(""),
    [approvals, setApprovals] = useState([]),
    [submitting, setSubmitting] = useState(false),
    [reload, setReload] = useState(0);
  const iframe = useRef(),
    pageRef = useRef();
  const reports = useRef(null);
  const [versions, setVersions] = useState([]);
  const workbench = useRef(null);
  const floatingDock = useRef(null);
  const selectionSequence = useRef(0);
  const dismissLocal = useCallback((clearPreview = true) => {
    selectionSequence.current += 1;
    setLocal(null);
    if (clearPreview) iframe.current?.contentWindow.postMessage({ source: "wb-host", type: "clear-selection" }, state.previewOrigin);
  }, [state.previewOrigin]);
  useEffect(() => {
    const outside = (event) => { if (!event.target.closest(".local-chat")) dismissLocal(); };
    const escape = (event) => { if (event.key === "Escape" && !event.isComposing) dismissLocal(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [dismissLocal]);
  useEffect(() => {
    const area = workbench.current;
    const dock = floatingDock.current;
    if (!area || !dock) return;
    const update = () => {
      const rect = area.getBoundingClientRect();
      dock.style.setProperty("--dev-dock-center", `${rect.left + rect.width / 2}px`);
      dock.style.setProperty("--dev-dock-width", `${Math.max(0, rect.width - 24)}px`);
      area.style.setProperty("--dev-dock-height", `${dock.offsetHeight + 32}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(area);
    observer.observe(dock);
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [page?.id, state.previewOrigin]);
  pageRef.current = page;
  const loadSessions = useCallback(async () => {
    const data = await api(`/pages/${pageId}`);
    setPage(data.page);
    setVersions(data.versions);
    setSessions(Object.fromEntries(data.sessions.map((s) => [s.id, s])));
    return data;
  }, [pageId]);
  useEffect(() => {
    let active = true;
    Promise.all([
      loadSessions(),
      api(`/pages/${pageId}/session`, {
        anchor: { key: "global", label: "全局开发" },
      }),
    ])
      .then(([data, global]) => {
        if (active) {
          setGlobalId(global.id);
          setSessions((prev) => ({ ...prev, [global.id]: global }));
          if (initialSessionId) {
            const selected = data.sessions.find(
              (s) => s.id === initialSessionId,
            );
            if (!selected) throw new Error("这条对话不属于当前项目或已不存在");
            if (selected.anchorKey !== "global")
              setLocal({
                sessionId: selected.id,
                anchor: selected.anchor,
                x: Math.max(12, innerWidth - 390),
                y: Math.max(70, Math.min(130, innerHeight - 440)),
              });
          }
        }
      })
      .catch((err) => setLoadingError(err.message));
    api("/agent/approvals")
      .then((items) => setApprovals(items.filter((r) => r.pageId === pageId)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pageId, loadSessions, initialSessionId]);
  useEffect(() => {
    const handler = async (event) => {
      const data = event.detail;
      if (data.pageId && data.pageId !== pageId) return;
      if (data.type === "agent-delta")
        setStreams((prev) => ({
          ...prev,
          [data.sessionId]: (prev[data.sessionId] || "") + data.delta,
        }));
      if (data.type === "message-completed") {
        const session = await api(`/sessions/${data.sessionId}`);
        setSessions((prev) => ({ ...prev, [session.id]: session }));
        setStreams((prev) => ({ ...prev, [session.id]: "" }));
      }
      if (
        ["turn-started", "turn-completed", "state-changed"].includes(data.type)
      )
        await loadSessions();
      if (data.type === "turn-completed") {
        setStreams((prev) => ({ ...prev, [data.sessionId]: "" }));
        setTools((prev) => ({
          ...prev,
          [data.sessionId]:
            data.status === "completed"
              ? "本轮执行结束，请检查预览和成果。"
              : data.status === "interrupted"
                ? "已停止本轮开发。"
                : data.error || "执行未成功",
        }));
        setApprovals((prev) =>
          prev.filter((x) => x.sessionId !== data.sessionId),
        );
      }
      if (data.type === "tool")
        setTools((prev) => ({
          ...prev,
          [data.sessionId]:
            data.item.type === "fileChange"
              ? "项目文件已修改"
              : data.item.type === "commandExecution"
                ? `执行命令：${data.item.command || ""}`
                : data.item.type === "webSearch"
                  ? "完成资料搜索"
                  : "完成工具调用",
        }));
      if (data.type === "files-changed") setReload((value) => value + 1);
      if (data.type === "approval")
        setApprovals((prev) =>
          prev.some((x) => x.id === data.id) ? prev : [...prev, data],
        );
      if (data.type === "agent-notice") notify(data.message);
    };
    const listener = (event) =>
      handler(event).catch((err) => notify(err.message));
    window.addEventListener("wb-event", listener);
    return () => window.removeEventListener("wb-event", listener);
  }, [pageId, loadSessions, notify]);
  useEffect(() => {
    const listener = async (event) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.origin !== state.previewOrigin ||
        event.data?.source !== "wb-preview"
      )
        return;
      const data = event.data;
      if (data.type === "selection-invalid") { dismissLocal(); notify("页面结构已变化，请重新选择区域"); }
      if (data.type === "dismiss-local") dismissLocal(false);
      if (data.type === "selection") {
        const request = ++selectionSequence.current;
        setPick(false);
        const anchor = data.anchor;
        if (!anchor || typeof anchor.key !== "string") return;
        try {
          const session = await api(`/pages/${pageId}/session`, { anchor });
          if (request !== selectionSequence.current) return;
          setSessions((prev) => ({ ...prev, [session.id]: session }));
          const frame = iframe.current.getBoundingClientRect();
          const width = Math.min(365, innerWidth - 24);
          setLocal((previous) => ({
            sessionId: session.id,
            anchor,
            hierarchy: data.hierarchy,
            navigating: false,
            x: data.navigation && previous ? previous.x : Math.max(
              12,
              Math.min(
                frame.left + anchor.rect.x + Math.min(anchor.rect.width, 160),
                innerWidth - width - 12,
              ),
            ),
            y: data.navigation && previous ? previous.y : Math.max(
              70,
              Math.min(frame.top + anchor.rect.y + (anchor.kind === "project-text" ? anchor.rect.height + 8 : 0), innerHeight - 440),
            ),
          }));
        } catch (err) {
          setLocal((previous) => previous ? { ...previous, navigating: false } : previous);
          notify(err.message);
        }
      }
      if (data.type === "pick-cancelled") setPick(false);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [pageId, state.previewOrigin, notify, dismissLocal]);
  const togglePick = () => {
    const value = !pick;
    setPick(value);
    iframe.current?.contentWindow.postMessage(
      { source: "wb-host", type: "pick-mode", enabled: value },
      state.previewOrigin,
    );
  };
  const send = async (sessionId, message, anchor) => {
    setSubmitting(true);
    try {
      const session = sessions[sessionId];
      const result = await api("/agent/turn", {
        pageId,
        anchor: anchor || session.anchor,
        message,
      });
      setSessions((prev) => ({ ...prev, [result.id]: result }));
      await loadSessions();
    } finally {
      setSubmitting(false);
    }
  };
  const stop = async (sessionId) => {
    try {
      await api("/agent/interrupt", { sessionId });
    } catch (err) {
      notify(err.message);
    }
  };
  const busy =
    submitting || Object.values(sessions).some((s) => s.status === "running");
  if (loadingError)
    return (
      <div className="page">
        <div className="agent-error">{loadingError}</div>
        <Button onClick={() => go("/")}>回到工作空间</Button>
      </div>
    );
  if (!page || !state.previewOrigin)
    return <div className="loading">正在准备项目专属开发窗口…</div>;
  return (
    <div className="project-development-layout">
      <ProjectSidebar page={page} active={section} onSelect={(key) => ["development", "todo"].includes(key) ? setSection(key) : go(`/page/${pageId}/${key}`)} />
    <div className="dev-shell">
      <header className="dev-toolbar">
        <div className="dev-title">
          <Button icon="sidebar" quiet className="icon sidebar-toggle" aria-label="打开侧边栏" onClick={onOpenSidebar} />
          <Button
            icon="back"
            quiet
            className="icon"
            aria-label="返回 WB"
            onClick={() => go(`/page/${pageId}`)}
          />
          <span className="divider" />
          <span>{page.title}</span>
          <small>开发窗口</small>
        </div>
        <div className="actions">
          <Button
            small
            icon="refresh"
            aria-label="刷新预览"
            onClick={() => setReload((value) => value + 1)}
          >
            <span className="hide-mobile">刷新</span>
          </Button>
          <Button
            small
            icon="select"
            className={pick ? "selected" : ""}
            onClick={togglePick}
          >
            {pick ? "取消点选" : "点选局部"}
          </Button>
          <Button small icon="layers" onClick={() => go(`/page/${pageId}`)}>
            <span className="hide-mobile">WB 管理</span>
          </Button>
        </div>
      </header>
      <div className="dev-workspace">
      <DevelopmentReports ref={reports} sessions={sessions} streams={streams} page={page} versions={versions} busy={busy} onRestore={async (versionId) => {
        const latest = await api(`/pages/${pageId}`);
        if (latest.sessions.some((s) => s.status === "running")) throw new Error("请等待 AI 任务结束后再恢复资料版本");
        await api(`/pages/${pageId}/restore`, { versionId });
        await loadSessions();
        notify("管理资料已恢复，代码文件未改动");
      }} onSave={async (patch) => {
        await api(`/pages/${pageId}`, { ...patch, expectedRevision: page.revision }, "PATCH");
        await loadSessions();
      }} />
      <div className="dev-workbench" ref={workbench}>
      <div className="dev-surface">
        {section === "todo" && <div className="development-todos"><TodoPanel page={page} onSave={async (patch) => {
          await api(`/pages/${pageId}`, { ...patch, expectedRevision: page.revision }, "PATCH");
          await loadSessions();
        }} /></div>}
        <iframe
          hidden={section !== "development"}
          key={reload}
          ref={iframe}
          title="目标项目开发预览"
          className="preview-frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
          src={`${state.previewOrigin}/app/${page.id}/`}
          onLoad={() => {
            if (pick)
              iframe.current?.contentWindow.postMessage(
                { source: "wb-host", type: "pick-mode", enabled: true },
                state.previewOrigin,
              );
          }}
        />
        {pick && (
          <div className="pick-banner">
            点击页面中的任意区域，就地打开 AI 对话 · Esc 取消
          </div>
        )}
      </div>
      <section className="dev-dock" ref={floatingDock} aria-label="全局开发聊天窗口">
        <ChatPane
          composerOnly
          autoGrow
          inputPlaceholder="描述你想实现的功能或修改…"
          composerActions={<>
            <span className="composer-agent">{(sessions[globalId]?.provider || (sessions[globalId]?.threadId ? "codex" : status?.provider)) === "claude" ? "Claude Code" : "Codex"}</span>
            <span className="composer-agent">项目开发</span>
            <Button type="button" quiet small onClick={() => reports.current?.latest()}><Icon name="arrow" className="latest-reply-icon" />最新回复</Button>
          </>}
          session={sessions[globalId]}
          stream={streams[globalId]}
          tool={busy ? tools[globalId] : ""}
          busy={busy}
          global
          onSend={(message) => { reports.current?.latest(); return send(globalId, message); }}
          onStop={() => stop(globalId)}
        />
        <div className="dock-footer">
          <span>在目标项目中执行 · 原始对话保存在 WB</span>
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </section>
      </div>
      </div>
      {local && (
        <aside
          className="local-chat"
          style={{ left: local.x, top: local.y }}
          aria-label="局部 AI 聊天窗口"
        >
          <div className="local-head">
            <div className="label">
              <Icon name="select" />
              <span>{local.anchor.label || "选中的位置"}</span>
            </div>
            <Button
              quiet
              icon="close"
              className="icon"
              aria-label="关闭局部聊天"
              onClick={dismissLocal}
            />
          </div>
          <div className="chat-body">
            <RegionNavigator hierarchy={local.hierarchy} pending={local.navigating} onNavigate={(nodeId) => {
              setLocal((previous) => ({ ...previous, navigating: true }));
              iframe.current?.contentWindow.postMessage({ source: "wb-host", type: "navigate-selection", token: local.hierarchy.token, nodeId }, state.previewOrigin);
            }} />
            <div className="selection-label mono">
              {local.anchor.sourceFile} · {local.anchor.selector}
            </div>
            <ChatPane
              key="local-project-composer"
              composerOnly
              inputPlaceholder={local.anchor.kind === "project-text" ? "描述要怎样修改选中的文字或所在区域…" : "描述要怎样修改这个区域…"}
              session={sessions[local.sessionId]}
              stream={streams[local.sessionId]}
              busy={busy || local.navigating}
              onSend={(message) => { reports.current?.latest(); return send(local.sessionId, message, local.anchor); }}
              onStop={() => stop(local.sessionId)}
            />
          </div>
        </aside>
      )}
      {approvals[0] && (
        <Approval
          key={approvals[0].id}
          request={approvals[0]}
          onReply={async (answer) => {
            await api("/agent/respond", { id: approvals[0].id, ...answer });
            setApprovals((prev) => prev.slice(1));
          }}
        />
      )}
    </div>
    </div>
  );
}
