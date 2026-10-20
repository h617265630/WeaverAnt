import React, { useState } from "react";
import { Icon } from "./components";
import { useWB } from "./context";

function groupHistory(conversations) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const week = new Date(today);
  week.setDate(today.getDate() - 7);
  const groups = { 今天: [], 昨天: [], "过去 7 天": [], 更早: [] };
  for (const item of conversations) {
    const date = new Date(item.updatedAt);
    groups[
      date >= today
        ? "今天"
        : date >= yesterday
          ? "昨天"
          : date >= week
            ? "过去 7 天"
            : "更早"
    ].push(item);
  }
  return Object.entries(groups).filter(([, entries]) => entries.length);
}

export function Sidebar({
  path,
  onSearch,
  onNewChat,
  onNewTask,
  onClose,
  onNavigate,
}) {
  const { state, createProject, openLocalProject } = useWB();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const projects = state.pages.filter((page) => page.kind === "project");
  const conversations = (state.conversations || []).filter(
    (item) => item.entryType !== "task",
  );
  const tasks = (state.conversations || []).filter(
    (item) => item.entryType === "task",
  );
  return (
    <>
      <div className="sidebar-header">
        <a className="brand" href="#/" onClick={onNavigate}>
          <span className="brand-mark">w</span>
          <span>WB Studio</span>
        </a>
        <button
          className="sidebar-icon"
          aria-label="收起侧边栏"
          title="收起侧边栏"
          onClick={onClose}
        >
          <Icon name="sidebar" />
        </button>
      </div>
      <nav className="sidebar-shortcuts" aria-label="工作空间导航">
        <button className="nav-link new-chat" onClick={onNewChat}>
          <Icon name="edit" />
          <span>新对话</span>
          <Icon name="plus" />
        </button>
        <button
          className="nav-link"
          onClick={() => { openLocalProject(); onNavigate(); }}
        >
          <Icon name="folder" />
          <span>打开本地 Web 项目</span>
        </button>
        <button
          className="nav-link"
          onClick={() => {
            onSearch();
            onNavigate();
          }}
        >
          <Icon name="search" />
          <span>搜索对话与资料</span>
        </button>
        <a
          className={`nav-link ${path === "/" ? "active" : ""}`}
          href="#/"
          onClick={onNavigate}
        >
          <Icon name="home" />
          <span>工作空间</span>
        </a>
        <a
          className={`nav-link ${path === "/questions" ? "active" : ""}`}
          href="#/questions"
          onClick={onNavigate}
        >
          <Icon name="note" />
          <span>知识与资料</span>
        </a>
      </nav>
      <div className="sidebar-scroll">
        <section className="sidebar-section" aria-label="项目列表">
          <div className="sidebar-section-head">
            <button
              className="section-toggle"
              aria-expanded={projectsOpen}
              onClick={() => setProjectsOpen((value) => !value)}
            >
              <Icon name="chevron" className={projectsOpen ? "expanded" : ""} />
              <span>项目</span>
              <small>{projects.length}</small>
            </button>
            <button
              className="sidebar-icon"
              aria-label="创建项目"
              title="创建项目"
              onClick={() => {
                createProject();
                onNavigate();
              }}
            >
              <Icon name="plus" />
            </button>
          </div>
          {projectsOpen && (
            <>
              {projects.map((page) => (
                <a
                  key={page.id}
                  className={`nav-link sidebar-project ${path === `/page/${page.id}` ? "active" : ""}`}
                  href={`#/page/${page.id}`}
                  title={page.title}
                  onClick={onNavigate}
                >
                  <Icon name="folder" />
                  <span className="truncate">{page.title}</span>
                </a>
              ))}
              {!projects.length && (
                <p className="sidebar-empty">把一个想法，变成第一个项目。</p>
              )}
              <a
                className={`nav-link all-projects ${path === "/projects" ? "active" : ""}`}
                href="#/projects"
                onClick={onNavigate}
              >
                <Icon name="layers" />
                <span>全部项目</span>
                <Icon name="arrow" />
              </a>
            </>
          )}
        </section>
        <section className="sidebar-section" aria-label="任务列表">
          <div className="sidebar-section-head">
            <button
              className="section-toggle"
              aria-expanded={tasksOpen}
              onClick={() => setTasksOpen((value) => !value)}
            >
              <Icon name="chevron" className={tasksOpen ? "expanded" : ""} />
              <span>任务</span>
              <small>{tasks.length}</small>
            </button>
            <button
              className="sidebar-icon"
              aria-label="开始新任务"
              onClick={onNewTask}
            >
              <Icon name="plus" />
            </button>
          </div>
          {tasksOpen && (
            <>
              {tasks.map((task) => (
                <a
                  className={`history-link ${path === `/page/${task.pageId}` ? "active" : ""}`}
                  key={task.id}
                  href={`#/page/${task.pageId}`}
                  title={task.title}
                  onClick={onNavigate}
                >
                  <Icon name="check" />
                  <span className="truncate">{task.title}</span>
                </a>
              ))}
              {!tasks.length && (
                <p className="sidebar-empty">
                  从入口提出任务，在专属 WB 中推进。
                </p>
              )}
            </>
          )}
        </section>
        <section className="sidebar-section" aria-label="历史对话">
          <div className="sidebar-section-head">
            <button
              className="section-toggle"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <Icon name="chevron" className={historyOpen ? "expanded" : ""} />
              <span>历史对话</span>
              <small>{conversations.length}</small>
            </button>
          </div>
          {historyOpen && (
            <>
              {!conversations.length && (
                <p className="sidebar-empty">开始聊天后，对话会保存在这里。</p>
              )}
              {groupHistory(conversations).map(([label, entries]) => (
                <div key={label} className="history-group">
                  <h3>{label}</h3>
                  {entries.map((item) => {
                    const destination = `/page/${item.pageId}`;
                    const scope =
                      item.scope === "local" ? "局部开发" : "全局开发";
                    return (
                      <a
                        key={item.id}
                        href={`#${destination}`}
                        className={`history-link ${path === destination ? "active" : ""}`}
                        title={`${item.title}${item.kind === "project" ? ` · ${item.pageTitle} · ${scope}` : ""}`}
                        aria-current={path === destination ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <Icon
                          name={item.kind === "project" ? "code" : "chat"}
                        />
                        <span className="history-copy">
                          <span className="truncate">{item.title}</span>
                          {item.kind === "project" && (
                            <small className="truncate">
                              {item.pageTitle} · {scope}
                            </small>
                          )}
                        </span>
                        {item.status === "running" && (
                          <span
                            className="status-dot connecting"
                            aria-label="正在回复"
                          />
                        )}
                      </a>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </section>
      </div>
      <footer className="sidebar-bottom">
        <a
          className={`nav-link ${path === "/architecture" ? "active" : ""}`}
          href="#/architecture"
          onClick={onNavigate}
        >
          <Icon name="layers" />
          <span>产品架构</span>
        </a>
        <a
          className={`nav-link ${path === "/settings" ? "active" : ""}`}
          href="#/settings"
          onClick={onNavigate}
        >
          <Icon name="settings" />
          <span>连接与设置</span>
        </a>
        <div className="sidebar-account">
          <span className="avatar">我</span>
          <div>
            <strong>个人工作空间</strong>
            <small>
              <span className="status-dot" /> 内容保存在本机
            </small>
          </div>
          <span className="tag">LOCAL</span>
        </div>
      </footer>
    </>
  );
}
