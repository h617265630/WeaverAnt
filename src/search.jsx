import React, { useEffect, useState } from "react";
import { api, go } from "./api";
import { Modal, Button } from "./components";
const labels = {
  page: "页面",
  module: "结构化内容",
  record: "原始资料",
  session: "完整对话",
};
export function Search({ onClose }) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(query)}`)
        .then((data) => {
          if (active) setResults(data);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  const open = async (result) => {
    try {
      if (result.type === "session") {
        const session = await api(`/sessions/${result.id}`);
        setDetail({
          ...result,
          text: session.messages
            .map((m) => `${m.role === "user" ? "你" : "Codex"}\n${m.text}`)
            .join("\n\n"),
        });
      } else if (result.type === "record") {
        const records = await api(`/pages/${result.pageId}/records`);
        setDetail({
          ...result,
          text: records.find((r) => r.id === result.id).raw,
        });
      } else {
        go(`/page/${result.pageId}`);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal
      title={detail ? detail.title : "搜索内容与完整记录"}
      onClose={onClose}
    >
      {detail ? (
        <>
          <Button small onClick={() => setDetail(null)}>
            返回搜索结果
          </Button>
          <pre className="raw-text">{detail.text}</pre>
          <Button
            onClick={() => {
              go(`/page/${detail.pageId}`);
              onClose();
            }}
          >
            打开所属管理页
          </Button>
        </>
      ) : (
        <>
          <label className="field">
            <span>输入关键词</span>
            <input
              autoFocus
              aria-label="搜索关键词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索问题、资料、方案或某一句对话…"
            />
          </label>
          <p className="modal-description">
            搜索本机记录；不发送给 AI。最多显示 60 个结果。
          </p>
          {results.map((result) => (
            <button
              className="search-result"
              key={`${result.pageId}:${result.id}`}
              onClick={() => open(result)}
            >
              <span className="tag">{labels[result.type]}</span>
              <strong>{result.title}</strong>
              <small>{result.pageTitle}</small>
              <p>{result.snippet}</p>
            </button>
          ))}
          {query.trim() && !results.length && <p>没有找到对应记录。</p>}
        </>
      )}
      {error && <p className="agent-error">{error}</p>}
    </Modal>
  );
}
