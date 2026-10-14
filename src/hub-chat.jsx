import React, { useState, useEffect, useRef } from "react";
import { api, go } from "./api";
import { useWB } from "./context";
import { Icon, Button } from "./components";
import { ChatPane, Approval } from "./development";
import { ConversationCanvas } from "./conversation-canvas";

export function HubChat({
  pageId,
  welcome = false,
  mode = "chat",
  onModeChange,
  showContent = true,
  onShowContent,
}) {
  const { refresh, notify } = useWB();
  const [hub, setHub] = useState(null);
  const [session, setSession] = useState(
    welcome ? { messages: [], status: "idle" } : null,
  );
  const [streams, setStreams] = useState({});
  const [pending, setPending] = useState("");
  const finishedItems = useRef(new Set());
  const dock = useRef(null);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [loadError, setLoadError] = useState("");
  const hubRef = useRef(null);
  const sessionIdRef = useRef(null);
  useEffect(() => {
    if (welcome || !dock.current) return;
    const page = dock.current.closest(".page");
    const observer = new ResizeObserver(() =>
      page?.style.setProperty(
        "--dock-height",
        `${dock.current.offsetHeight + 44}px`,
      ),
    );
    observer.observe(dock.current);
    return () => {
      observer.disconnect();
      page?.style.removeProperty("--dock-height");
    };
  }, [welcome, hub]);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      if (welcome) return null;
      const { page } = await api(`/pages/${pageId}`);
      const session = await api(`/pages/${pageId}/session`, {
        anchor: { key: "global", label: "WB 对话" },
      });
      if (page.kind !== "question")
        throw new Error("请在目标项目开发窗口打开此对话");
      return { session, page };
    };
    load()
      .then(async (data) => {
        if (disposed || !data) return;
        hubRef.current = data.page;
        setHub(data.page);
        setSession(data.session);
        sessionIdRef.current = data.session.id;
        const pending = await api("/agent/approvals");
        if (!disposed)
          setApprovals(pending.filter((r) => r.pageId === data.page.id));
        refresh();
      })
      .catch((error) => {
        if (!disposed) setLoadError(error.message);
      });
    const handler = async (event) => {
      const data = event.detail;
      if (data.type === "project-ready") {
        go(`/develop/${data.pageId}`);
        return;
      }
      if (data.pageId !== hubRef.current?.id) return;
      if (data.type === "approval") setApprovals((prev) => [...prev, data]);
      if (data.sessionId && data.sessionId !== sessionIdRef.current) return;
      if (
        data.type === "agent-delta" &&
        !finishedItems.current.has(data.itemId)
      )
        setStreams((prev) => ({
          ...prev,
          [data.itemId]: (prev[data.itemId] || "") + data.delta,
        }));
      if (
        ["message-completed", "turn-started", "turn-completed"].includes(
          data.type,
        )
      ) {
        const current = await api(`/sessions/${data.sessionId}`);
        if (disposed) return;
        setSession(current);
        setPending("");
        if (data.type === "message-completed") {
          finishedItems.current.add(data.itemId);
          setStreams((prev) => {
            const next = { ...prev };
            delete next[data.itemId];
            return next;
          });
        }
        if (data.type === "turn-completed") setStreams({});
      }
      if (data.type === "tool")
        setTool(
          data.item.type === "webSearch"
            ? "搜索资料已返回"
            : data.item.type === "mcpToolCall"
              ? "正在整理内容与资源…"
              : "正在处理你的问题…",
        );
      if (data.type === "turn-completed") {
        setTool(
          data.status === "completed"
            ? "对话已保存，相关内容可在管理页面中查看。"
            : data.error || "本轮对话已停止",
        );
        refresh();
      }
    };
    const listener = (event) =>
      handler(event).catch((err) => notify(err.message));
    window.addEventListener("wb-event", listener);
    return () => {
      disposed = true;
      window.removeEventListener("wb-event", listener);
    };
  }, [refresh, notify, pageId, welcome]);

  if (loadError)
    return (
      <div className="agent-error" role="alert">
        {loadError}
      </div>
    );

  return (
    <section
      className={`hub-chat ${welcome ? "entry-chat" : "workspace-chat"}`}
      aria-label="WB 聊天窗口"
    >
      {welcome && (
        <div className="entry-intro">
          <span className="entry-mark">
            <Icon name="spark" />
          </span>
          <h1>
            {mode === "task" ? "有什么任务需要完成？" : "今天，想从什么开始？"}
          </h1>
          <p>聊一个想法，提出一个问题，或开始一项任务。</p>
          <div className="entry-modes" aria-label="开始方式">
            <button
              className={mode === "chat" ? "active" : ""}
              aria-pressed={mode === "chat"}
              onClick={() => onModeChange("chat")}
            >
              <Icon name="chat" />
              开始聊天
            </button>
            <button
              className={mode === "task" ? "active" : ""}
              aria-pressed={mode === "task"}
              onClick={() => onModeChange("task")}
            >
              <Icon name="check" />
              开始任务
            </button>
          </div>
        </div>
      )}
      {!welcome && showContent && (
        <ConversationCanvas
          pageId={pageId}
          session={session}
          streams={Object.entries(streams).map(([id, text]) => ({ id, text }))}
          pending={pending}
          busy={busy || session?.status === "running"}
        />
      )}
      <div
        ref={dock}
        className={welcome ? "" : "wb-floating-dock"}
        role={welcome ? undefined : "region"}
        aria-label={welcome ? undefined : "底部悬浮聊天窗口"}
      >
        {!welcome && (
          <div className="dock-head">
            <div className="dock-label">
              <Icon name="spark" />
              <strong>{mode === "task" ? "任务对话" : "和 WB 聊聊"}</strong>
              <span className="scope">
                {mode === "task"
                  ? "需求 · 过程 · 成果"
                  : "问答 · 调研 · 项目构想"}
              </span>
            </div>
            {hub && (
              <div className="actions">
                <Button
                  quiet
                  small
                  onClick={() => {
                    onShowContent?.();
                    setTimeout(
                      () =>
                        document
                          .querySelector(".canvas-latest")
                          ?.scrollIntoView({
                            block: "end",
                            behavior: "smooth",
                          }),
                      50,
                    );
                  }}
                >
                  最新回复
                  <Icon name="arrow" />
                </Button>
                <span className="scope">
                  {session?.messages.length || 0} 条消息 · 自动保存
                </span>
              </div>
            )}
          </div>
        )}
        <ChatPane
          hub
          global
          welcome={welcome}
          composerOnly={!welcome}
          session={session}
          stream={Object.values(streams).join("\n")}
          tool={tool}
          busy={busy || session?.status === "running"}
          onSend={async (message) => {
            setBusy(true);
            setPending(message);
            let destination = hub;
            try {
              if (welcome) {
                const created = await api("/chats", {
                  mode,
                  title: message.replace(/\s+/g, " ").trim().slice(0, 60),
                });
                destination = created.page;
                hubRef.current = created.page;
                setHub(created.page);
                setSession(created.session);
                sessionIdRef.current = created.session.id;
                await refresh();
              }
              const result = await api("/agent/turn", {
                pageId: destination.id,
                anchor: {
                  key: "global",
                  label: mode === "task" ? "任务对话" : "WB 对话",
                },
                message,
              });
              setSession(result);
              setPending("");
            } finally {
              setBusy(false);
              setPending("");
              if (welcome && destination) go(`/page/${destination.id}`);
            }
          }}
          onStop={async () => {
            try {
              await api("/agent/interrupt", { sessionId: session.id });
            } catch (err) {
              notify(err.message);
            }
          }}
        />
        <div className="dock-footer">
          <span>Codex 提供 AI 能力 · WB 收纳对话、资料与资源</span>
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
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
    </section>
  );
}
