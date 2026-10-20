import React, { useState } from "react";
import { api } from "./api";
import { Button } from "./components";

export function OpenLocalProject({ onOpened }) {
  const [rootPath, setRootPath] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState("");
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (busy || choosing) return;
    setBusy(true); setError("");
    try { await onOpened(await api("/local-projects/open", { rootPath, title })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }}>
    <p className="modal-description">绑定已有 Web 项目的根目录，直接在原文件上继续开发，不复制或覆盖项目。已绑定的目录会打开原来的 WB 项目。</p>
    <label className="field"><span>本地项目路径</span><input required value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder="/Users/你的名字/projects/my-web-app" disabled={busy || choosing} /></label>
    <Button type="button" icon="folder" disabled={busy || choosing} onClick={async () => {
      setChoosing(true); setError("");
      try { const result = await api("/local-projects/choose", {}); if (result.path) setRootPath(result.path); }
      catch (err) { setError(err.message); }
      finally { setChoosing(false); }
    }}>{choosing ? "请在系统窗口选择…" : "选择文件夹"}</Button>
    <label className="field" style={{ marginTop: 18 }}><span>项目名称（可选）</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="默认使用文件夹名称" disabled={busy} /></label>
    <p className="modal-description">选择包含 index.html 或 package.json 的文件夹。静态页面可直接预览；React 等框架项目通常需先构建到 dist。此次打开不会安装依赖、运行脚本或自动调用 AI。</p>
    {error && <p className="agent-error" role="alert">{error}</p>}
    <div className="modal-actions"><Button primary type="submit" disabled={busy || choosing || !rootPath.trim()}>{busy ? "正在打开…" : "打开并继续开发"}</Button></div>
  </form>;
}
