import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { api, token, go } from "./api";
import { Context } from "./context";
import { Icon, Button, FormModal, Modal } from "./components";
import { Dashboard, Architecture, Settings } from "./overview";
import { PageView } from "./page";
import { Development } from "./development";
import { Search } from "./search";
import { Sidebar } from "./sidebar";
import { HubChat } from "./hub-chat";

function MobileSidebar({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      className="mobile-sidebar-dialog"
      ref={ref}
      aria-label="导航菜单"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <aside className="sidebar">{children}</aside>
    </dialog>
  );
}

function App() {
  const [state, setState] = useState({
      pages: [],
      conversations: [],
      events: [],
      previewOrigin: "",
    }),
    [path, setPath] = useState(location.hash.slice(1) || "/"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [status, setStatus] = useState(null),
    [error, setError] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(true),
    [mobileSidebar, setMobileSidebar] = useState(false),
    [entryMode, setEntryMode] = useState("chat"),
    [entryKey, setEntryKey] = useState(0);
  const refresh = useCallback(async () => {
    try {
      setState(await api("/state"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api("/agent/status"));
    } catch {}
  }, []);
  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 4200);
  }, []);
  useEffect(() => {
    refresh();
    refreshStatus();
    const hash = () => setPath(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", hash);
    const events = new EventSource(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    events.onmessage = (event) => {
      const data = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent("wb-event", { detail: data }));
      if (
        ["state-changed", "turn-started", "turn-completed"].includes(data.type)
      )
        refresh();
      if (data.type === "sync-error") notify(data.message);
    };
    events.onopen = refresh;
    return () => {
      events.close();
      window.removeEventListener("hashchange", hash);
    };
  }, [refresh, refreshStatus, notify]);
  useEffect(() => {
    setMobileSidebar(false);
    if (/^\/(page|develop)\//.test(path)) setSidebarCollapsed(true);
  }, [path]);
  const newEntry = (mode = "chat") => {
    setSidebarCollapsed(true);
    setEntryMode(mode);
    setEntryKey((key) => key + 1);
    setMobileSidebar(false);
    go("/");
  };
  const closeModal = () => setModal(null);
  const createQuestion = () =>
    setModal({
      type: "form",
      title: "新建问答页面",
      description:
        "将 Codex 的问答整理成轻量网页。接入 WB MCP 后，Codex 也可以直接创建页面。",
      fields: [
        {
          name: "title",
          label: "问题 / 主题",
          required: true,
          placeholder: "例如：如何设计一个轻量记账 App？",
        },
        {
          name: "content",
          label: "回答内容",
          type: "textarea",
          placeholder: "粘贴已有回答，也可以先留空…",
        },
      ],
      submitLabel: "创建问答页面",
      onSubmit: async (input) => {
        const page = await api("/pages", {
          title: input.title,
          kind: "question",
          summary: "从一个问题开始，逐步整理思路。",
          modules: input.content
            ? [{ title: "回答", content: input.content }]
            : [],
        });
        await refresh();
        go(`/page/${page.id}`);
      },
    });
  const createProject = (source) =>
    setModal({
      type: "form",
      title: source ? "从问答启动项目" : "启动新项目",
      description:
        "将创建专属 WB 和开发窗口。底部聊天框立即就绪，页面可以在开发过程中逐步生成。",
      fields: [
        {
          name: "title",
          label: "项目名称",
          value: source?.title,
          required: true,
          placeholder: "给你的想法取个名字",
        },
        {
          name: "summary",
          label: "项目想法",
          type: "textarea",
          value: source?.summary,
          placeholder: "你希望这个项目解决什么问题？",
        },
        {
          name: "rootPath",
          label: "已有项目目录（可选）",
          placeholder: "留空则创建全新的目标项目目录",
          hint: "开发指令只在绑定的目标项目中执行。",
        },
      ],
      submitLabel: "启动项目，打开开发窗口",
      onSubmit: async (input) => {
        let page;
        if (source) {
          page = await api(`/pages/${source.id}/promote`, {
            title: input.title,
            rootPath: input.rootPath || undefined,
          });
          if (input.summary !== source.summary)
            page = await api(
              `/pages/${page.id}`,
              { summary: input.summary },
              "PATCH",
            );
        } else
          page = await api("/pages", {
            kind: "project",
            title: input.title,
            summary: input.summary,
            rootPath: input.rootPath || undefined,
            modules: [
              {
                title: "项目目标",
                content: input.summary || "在开发窗口中进一步明确目标。",
              },
              {
                title: "开发计划",
                type: "tasks",
                items: [
                  { text: "明确第一版需求" },
                  { text: "实现核心功能" },
                  { text: "测试并验证成果" },
                ],
              },
            ],
          });
        await refresh();
        go(`/develop/${page.id}`);
      },
    });
  const openDemo = async () => {
    try {
      const page = await api("/demo", {});
      await refresh();
      go(`/develop/${page.id}`);
    } catch (err) {
      notify(err.message);
    }
  };
  const connect = async () => {
    try {
      notify("正在连接本机 Codex…");
      const info = await api("/agent/connect", {});
      setStatus(info);
      notify(
        info.signedIn
          ? "Codex 已连接，可以在目标项目里开始开发。"
          : "进程已连接，请先在原 Codex 中完成登录。",
      );
    } catch (err) {
      notify(err.message);
      refreshStatus();
    }
  };
  const context = {
    state,
    refresh,
    notify,
    setModal,
    closeModal,
    createQuestion,
    createProject,
    openDemo,
    status,
    connect,
  };
  const selected = state.pages.find((p) => path.endsWith(p.id));
  const develop = path.startsWith("/develop/");
  const sidebarProps = {
    path,
    onSearch: () => setSearchOpen(true),
    onNewChat: () => newEntry("chat"),
    onNewTask: () => newEntry("task"),
    onNavigate: () => setMobileSidebar(false),
  };
  let content =
    path === "/" ? (
      <div className="welcome-page">
        <HubChat
          key={entryKey}
          welcome
          mode={entryMode}
          onModeChange={setEntryMode}
        />
      </div>
    ) : path === "/architecture" ? (
      <Architecture />
    ) : path === "/settings" ? (
      <Settings />
    ) : path.startsWith("/page/") ? (
      <PageView key={path} pageId={path.split("/")[2]} />
    ) : (
      <Dashboard
        filter={
          path === "/projects"
            ? "project"
            : path === "/questions"
              ? "question"
              : "all"
        }
      />
    );
  return (
    <Context.Provider value={context}>
      {develop ? (
        <Development
          key={path}
          pageId={path.split("/")[2]}
          initialSessionId={path.split("/")[3]}
        />
      ) : (
        <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <aside className="sidebar">
            <Sidebar
              {...sidebarProps}
              onClose={() => setSidebarCollapsed(true)}
            />
          </aside>
          <main className="main">
            <header className="topbar">
              <div className="crumb">
                <Button
                  quiet
                  className="icon sidebar-toggle"
                  icon="sidebar"
                  aria-label="打开侧边栏"
                  onClick={() => {
                    if (matchMedia("(max-width: 760px)").matches)
                      setMobileSidebar(true);
                    else setSidebarCollapsed(false);
                  }}
                />
                <Icon
                  name={selected?.kind === "project" ? "folder" : "layers"}
                />
                <span>个人空间</span>
                <span>/</span>
                <strong>
                  {selected?.title ||
                    (path === "/settings"
                      ? "连接与设置"
                      : path === "/architecture"
                        ? "产品架构"
                        : "工作空间")}
                </strong>
              </div>
              <div className="topbar-right">
                <Button
                  small
                  quiet
                  icon="search"
                  onClick={() => setSearchOpen(true)}
                  aria-label="搜索所有内容"
                >
                  搜索
                </Button>
                <span className="tag">本地优先</span>
                <span className="avatar">我</span>
              </div>
            </header>
            {error ? (
              <div className="page">
                <div className="agent-error">{error}</div>
                <Button onClick={refresh}>重新连接</Button>
              </div>
            ) : (
              content
            )}
          </main>
        </div>
      )}
      {mobileSidebar && (
        <MobileSidebar onClose={() => setMobileSidebar(false)}>
          <Sidebar {...sidebarProps} onClose={() => setMobileSidebar(false)} />
        </MobileSidebar>
      )}
      {searchOpen && <Search onClose={() => setSearchOpen(false)} />}
      {modal &&
        (modal.type === "form" ? (
          <FormModal
            key={modal.key || modal.title}
            {...modal}
            onClose={closeModal}
          />
        ) : (
          <Modal title={modal.title} onClose={closeModal}>
            {modal.content}
          </Modal>
        ))}
      <div
        id="toast"
        className={toast ? "show" : ""}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </Context.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
