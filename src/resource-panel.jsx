import React, { useEffect, useState } from "react";
import { api, timeLabel } from "./api";
import { collectResources } from "./resources.mjs";
import { Empty } from "./components";

export function ResourcePanel({ page, sessions }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("正在读取工具来源…");
  useEffect(() => {
    let disposed = false;
    setEvents([]);
    setStatus("正在读取工具来源…");
    Promise.allSettled(sessions.map((s) => api(`/sessions/${s.id}/raw`))).then(
      (results) => {
        if (disposed) return;
        setEvents(
          results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
        );
        setStatus(
          results.some((r) => r.status === "rejected")
            ? "部分工具来源暂时无法读取，重新打开资源页可重试。"
            : "",
        );
      },
    );
    return () => {
      disposed = true;
    };
  }, [page.id, sessions]);
  const resources = collectResources(page, sessions, events);
  return (
    <section aria-label="对话资源">
      <div className="section-heading">
        <h2>资源</h2>
        <span className="tag">{resources.length} 项</span>
      </div>
      <p className="page-subtitle">
        自动汇集对话链接、搜索 /
        浏览来源和工具返回的资源，同一网址合并展示。保存来源链接，不自动下载文件，也不代表已验证内容。
      </p>
      {status && (
        <p role="status" className="page-subtitle">
          {status}
        </p>
      )}
      {!resources.length && !status && (
        <Empty
          title="暂无外部资源"
          description="对话中出现链接，或工具返回可用来源后，会自动收纳到这里。"
        />
      )}
      {resources.map((resource) => (
        <article className="resource-card" key={resource.url}>
          <a href={resource.url} target="_blank" rel="noreferrer">
            {resource.title} ↗
          </a>
          <small>{resource.url}</small>
          <details>
            <summary>来源 · {resource.sources.length} 处</summary>
            {resource.sources.map((source) => (
              <div key={source.id}>
                <small>
                  {source.label}
                  {source.at ? ` · ${timeLabel(source.at)}` : ""}
                </small>
                <p>{source.excerpt}</p>
              </div>
            ))}
          </details>
        </article>
      ))}
    </section>
  );
}
