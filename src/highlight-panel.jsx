import React, { useEffect, useState } from "react";
import { api, timeLabel } from "./api";

export function HighlightPanel({ pageId, records }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    api(`/pages/${pageId}/records`).then((result) => {
      if (!disposed) {
        setItems(result.filter((record) => record.kind === "highlight"));
        setError("");
      }
    }).catch((err) => { if (!disposed) setError(err.message); });
    return () => { disposed = true; };
  }, [pageId, records]);
  const active = items?.find((item) => item.id === selected);
  return <section className="highlight-panel" aria-label="保存的重点">
    {error && <p role="alert">{error}</p>}
    {!items && !error && <p role="status">正在加载重点…</p>}
    {items?.length === 0 && <p className="muted">选中文字后，点击浮窗里的「保存信息」，即可收纳到这里。</p>}
    <div className="highlight-labels" aria-label="重点标签">
      {items?.map((item) => <button key={item.id} className="btn" aria-pressed={item.id === selected} aria-controls="highlight-content" onClick={() => setSelected(item.id)}>{item.title}</button>)}
    </div>
    {active ? <article id="highlight-content" className="module" aria-label="重点内容">
      <h3>{active.title}</h3>
      <small>{active.origin} · {timeLabel(active.at)}</small>
      <div className="highlight-text">{active.raw}</div>
    </article> : !!items?.length && <p className="muted">点击上方标签查看保存的内容。</p>}
  </section>;
}
