import React, { useState } from "react";
import { Button } from "./components";

export function ThreadLabels({ threads, focusedThread, onOpen }) {
  const [expanded, setExpanded] = useState(new Set());
  const nodes = new Map(
    threads
      .map((thread, index) => ({ thread, number: index + 1, children: [] }))
      .filter(({ thread }) => thread.messages.length || thread.status === "running")
      .map((node) => [node.thread.anchor.key, node]),
  );
  const roots = [];
  for (const node of nodes.values()) {
    const key = node.thread.anchor.key;
    const parent = nodes.get(node.thread.anchor.parentThreadKey);
    const seen = new Set([key]);
    let ancestor = parent;
    while (ancestor && !seen.has(ancestor.thread.anchor.key)) {
      seen.add(ancestor.thread.anchor.key);
      ancestor = nodes.get(ancestor.thread.anchor.parentThreadKey);
    }
    // Missing parents and malformed cycles remain accessible as root labels.
    if (parent && !ancestor) parent.children.push(node);
    else roots.push(node);
  }
  const render = (items) => (
    <ul className="thread-label-list">
      {items.map(({ thread, number, children }) => {
        const { anchor } = thread;
        const isExpanded = expanded.has(anchor.key);
        return (
          <li key={anchor.key} data-label-key={anchor.key}>
            <Button
              className="selection-marker"
              small
              aria-label={`这里有额外提问：${anchor.quote.slice(0, 35)}`}
              aria-pressed={focusedThread === anchor.key}
              onClick={(event) => onOpen(thread, event)}
            >
              <span className="thread-label-number">{number}</span>
              <span className="thread-label-copy">
                {anchor.quote}
                <small>
                  第 {anchor.depth || 1} 级 · {anchor.action === "resources" ? "资源搜索" : "选段提问"} · {thread.messages.length} 条消息
                </small>
              </span>
            </Button>
            {!!children.length && (
              <>
                <button
                  type="button"
                  className="thread-label-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={`label-children-${anchor.key}`}
                  onClick={() => setExpanded((previous) => {
                    const next = new Set(previous);
                    if (next.has(anchor.key)) next.delete(anchor.key);
                    else next.add(anchor.key);
                    return next;
                  })}
                >
                  <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                  {isExpanded ? "收起" : "展开"}下级提问（{children.length}）
                </button>
                <div id={`label-children-${anchor.key}`} hidden={!isExpanded}>
                  {render(children)}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
  return <div className="zone-a-labels">{render(roots)}</div>;
}
