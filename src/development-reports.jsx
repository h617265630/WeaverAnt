import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TodoPanel } from "./todo-panel";
import { FileTree } from "./file-tree";
import { VersionPanel } from "./version-panel";
import { ProjectTools } from "./project-tools";

export const DevelopmentReports = forwardRef(function DevelopmentReports({ sessions, streams, page, onSave, versions = [], onRestore, busy }, ref) {
  const [tab, setTab] = useState("reports");
  const tabs = [["reports", "AI 汇报"], ["todo", "Todo"], ["files", "文件目录"]];
  const options = [["versions", "版本控制"], ["urls", "URL 链接"], ["database", "数据库"], ["deployment", "运行与部署"]];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRoot = useRef(null);
  const menuButton = useRef(null);
  useEffect(() => {
    const outside = (event) => { if (!menuRoot.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const scroll = useRef(null);
  const following = useRef(true);
  const messages = Object.values(sessions).flatMap((session) => session.messages.map((message) => ({ ...message, session }))).sort((a, b) => a.at.localeCompare(b.at));
  const latest = () => {
    following.current = true;
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  };
  useImperativeHandle(ref, () => ({ latest: () => { setTab("reports"); setMenuOpen(false); latest(); } }));
  useEffect(() => {
    if (tab === "reports" && following.current) latest();
  }, [sessions, streams, tab]);
  return <aside className="development-reports" aria-label="AI 开发汇报">
    <div className="development-panel-navigation">
    <header className="development-report-tabs" role="tablist" aria-label="开发辅助面板">
      {tabs.map(([key, label], index) => <button key={key} role="tab" id={`dev-tab-${key}`} aria-controls={`dev-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key || (!tabs.some(([key]) => key === tab) && index === 0) ? 0 : -1} onClick={() => { setTab(key); setMenuOpen(false); }} onKeyDown={(event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); setTab(tabs[next][0]); document.getElementById(`dev-tab-${tabs[next][0]}`)?.focus(); }
      }}>{label}</button>)}
    </header>
    <div className="development-tools-dropdown" ref={menuRoot} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus(); }
    }}>
      <button ref={menuButton} className="development-tools-trigger" aria-label="开发工具菜单" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="dev-tools-menu" onClick={() => setMenuOpen(!menuOpen)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setMenuOpen(true); requestAnimationFrame(() => menuRoot.current?.querySelector('[role="menuitem"]')?.focus()); }
      }}>{options.find(([key]) => key === tab)?.[1] || "版本控制"}<span aria-hidden="true">⌄</span></button>
      {menuOpen && <div className="development-tools-menu" id="dev-tools-menu" role="menu" aria-label="开发工具" onKeyDown={(event) => {
        const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
        const index = items.indexOf(document.activeElement);
        const next = event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (next !== null) { event.preventDefault(); items[next]?.focus(); }
        if (event.key === "Tab") setMenuOpen(false);
      }}>{options.map(([key, label]) => <button key={key} role="menuitem" onClick={() => { setTab(key); setMenuOpen(false); menuButton.current?.focus(); }}>{label}</button>)}</div>}
    </div>
    </div>
    <div className="development-report-panel" role="tabpanel" id="dev-panel-reports" aria-labelledby="dev-tab-reports" hidden={tab !== "reports"}>
    <div className="development-report-scroll" ref={scroll} tabIndex={0} role="region" aria-label="开发汇报滚动区"
      onWheel={(event) => { if (event.deltaY < 0) following.current = false; }}
      onScroll={(event) => { const el = event.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
      {!messages.length && !Object.values(streams).some(Boolean) && <p className="development-report-empty">在下方发送开发任务，AI 的回复和汇报会显示在这里。</p>}
      {messages.map((message) => <article key={message.id} className={`chat-msg development-report ${message.role}`}>
        {message.session.anchorKey !== "global" && <small className="development-report-scope">{message.session.anchor.label || "局部开发"}</small>}
        {message.partial && <small>未完成</small>}
        <div className="text">{message.text}</div>
      </article>)}
      {Object.entries(streams).filter(([, text]) => text).map(([id, text]) => <article key={id} className="chat-msg development-report assistant streaming">
        <small role="status">正在回复…</small><div className="text">{text}</div>
      </article>)}
      {Object.values(sessions).some((s) => s.status === "running") && !Object.values(streams).some(Boolean) && <p role="status" className="development-report-empty">AI 正在处理任务…</p>}
    </div>
    </div>
    <div className="development-report-panel auxiliary-panel" role="tabpanel" id="dev-panel-todo" aria-labelledby="dev-tab-todo" hidden={tab !== "todo"}>
      <TodoPanel page={page} onSave={onSave} />
    </div>
    <div className="development-report-panel auxiliary-panel" role="tabpanel" id="dev-panel-files" aria-labelledby="dev-tab-files" hidden={tab !== "files"}>
      <FileTree files={page.files || []} />
    </div>
    <div className="development-report-panel auxiliary-panel" role="tabpanel" id="dev-panel-versions" aria-label="版本控制" hidden={tab !== "versions"}>
      <VersionPanel page={page} versions={versions} onRestore={onRestore} busy={busy} />
    </div>
    {options.filter(([key]) => key !== "versions").map(([key, label]) => <div key={key} className="development-report-panel auxiliary-panel" role="region" aria-label={label} hidden={tab !== key}><ProjectTools type={key} page={page} onSave={onSave} /></div>)}
  </aside>;
});
