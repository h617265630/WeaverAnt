import React, { useState } from "react";
import { Button } from "./components";
import { FileTree } from "./file-tree";

export function ProjectSidebar({ page, active, onSelect }) {
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  const tasks = page.modules.filter((m) => m.type === "tasks").flatMap((m) => m.items);
  return <aside className={`project-sidebar ${open ? "" : "is-folded"}`} aria-label="项目内部侧边栏">
    <Button quiet icon="sidebar" aria-label={open ? "折叠项目侧边栏" : "展开项目侧边栏"} aria-expanded={open} onClick={() => setOpen(!open)}>{open && "项目管理"}</Button>
    {open && <>
      <p className="project-sidebar-title">{page.title}</p>
      <nav aria-label="项目管理栏目">
        {[["development", "开发窗口"], ["overview", "项目概览"], ["todo", "Todo"], ["resources", "资源"], ["highlights", "重点"], ["records", "原始记录"], ["files", "开发资料"], ["sync", "同步设置"], ["versions", "版本历史"], ...(page.customHtml ? [["custom", "专属页面"]] : [])].map(([key, label]) =>
          <button key={key} className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined} onClick={() => onSelect(key)}>{label}{key === "todo" && <small>{tasks.filter((t) => !t.done).length}</small>}</button>)}
      </nav>
      <FileTree files={page.files || []} />
    </>}
  </aside>;
}
