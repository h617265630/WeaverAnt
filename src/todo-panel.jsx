import React, { useState } from "react";
import { Button } from "./components";
import { useWB } from "./context";

export function TodoPanel({ page, onSave }) {
  const { setModal } = useWB();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const groups = page.modules.filter((m) => m.type === "tasks");
  const tasks = groups.flatMap((m) => m.items.map((item) => ({ ...item, moduleId: m.id, group: m.title })));
  const done = tasks.filter((t) => t.done).length;
  const save = async (modules) => {
    setBusy(true); setError("");
    try { await onSave({ modules }); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  };
  const change = (task, patch, remove = false) => save(page.modules.map((m) => m.id !== task.moduleId ? m : { ...m, items: remove ? m.items.filter((t) => t.id !== task.id) : m.items.map((t) => t.id === task.id ? { ...t, ...patch } : t) }));
  return <section className="todo-panel" aria-label="项目 Todo 管理">
    <h2>Todo</h2><p className="muted">{done} / {tasks.length} 已完成 · 当前项目的开发任务</p>
    <form className="todo-add" onSubmit={async (event) => {
      event.preventDefault(); if (busy || !text.trim()) return;
      const item = { text: text.trim(), done: false };
      const modules = groups.length ? page.modules.map((m) => m.id === groups[0].id ? { ...m, items: [...m.items, item] } : m) : [...page.modules, { title: "开发 Todo", type: "tasks", items: [item] }];
      if (await save(modules)) setText("");
    }}>
      <input aria-label="新增 Todo" placeholder="添加一个开发任务…" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" disabled={busy || !text.trim()} icon="plus">添加</Button>
    </form>
    <div className="todo-filters">{[["all", "全部"], ["pending", "未完成"], ["done", "已完成"]].map(([key, label]) => <Button key={key} small aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</Button>)}</div>
    {error && <p role="alert">{error}</p>}
    {!tasks.length && <p className="muted">还没有任务，先添加一项吧。</p>}
    {tasks.filter((t) => filter === "all" || (filter === "done" ? t.done : !t.done)).map((task) => <div className={`todo-row ${task.done ? "done" : ""}`} key={`${task.moduleId}:${task.id}`}>
      <label><input type="checkbox" checked={task.done} disabled={busy} onChange={(e) => change(task, { done: e.target.checked })} /><span>{task.text}</span></label>
      <small>{task.group}</small>
      <Button small quiet icon="edit" aria-label={`编辑任务：${task.text}`} disabled={busy} onClick={() => setModal({ type: "form", title: "编辑 Todo", fields: [{ name: "text", label: "任务内容", value: task.text, required: true }], onSubmit: async (input) => { if (!await change(task, { text: input.text.trim() })) throw new Error("保存失败，请刷新后重试"); } })} />
      <Button small quiet icon="close" aria-label={`删除任务：${task.text}`} disabled={busy} onClick={() => setModal({ type: "form", title: "删除 Todo", description: `确认删除「${task.text}」？删除后可通过项目版本历史恢复。`, fields: [], submitLabel: "删除", onSubmit: async () => { if (!await change(task, null, true)) throw new Error("删除失败，请刷新后重试"); } })} />
    </div>)}
  </section>;
}
