import React, { memo, useState, useRef } from "react";
import { contentBlocks, safeLink } from "./content-blocks.mjs";
import { Icon, Button } from "./components";
import { timeLabel } from "./api";
import { SelectionThread, useTextSelection } from "./selection-threads";
import { ThreadLabels } from "./thread-labels";

function Inline({ text }) {
  const parts = String(text).split(
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g,
  );
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && safeLink(link[2]))
      return (
        <a key={i} href={safeLink(link[2])} target="_blank" rel="noreferrer">
          {link[1]}
          <Icon name="external" />
        </a>
      );
    return part;
  });
}
export const StructuredContent = memo(function StructuredContent({
  text,
  selectable = false,
}) {
  return (
    <div className="structured-content">
      {contentBlocks(text).map((block, index) => (
        <div className="content-block-row" key={index}>
          <div
            className={selectable ? "selectable-block" : undefined}
            data-block-index={index}
          >
            {(() => {
              if (block.type === "heading")
                return (
                  <h3
                    key={index}
                    className={`content-heading level-${block.level}`}
                  >
                    <Inline text={block.text} />
                  </h3>
                );
              if (block.type === "code")
                return (
                  <div key={index} className="content-code">
                    <div>
                      {block.language || "代码"}
                      {!block.complete && <span>片段未结束</span>}
                    </div>
                    <pre>
                      <code>{block.text}</code>
                    </pre>
                  </div>
                );
              if (block.type === "table")
                return (
                  <div
                    key={index}
                    className="content-table"
                    tabIndex={0}
                    role="region"
                    aria-label="对话表格"
                  >
                    <table>
                      <thead>
                        <tr>
                          {block.headers.map((cell, i) => (
                            <th key={i}>
                              <Inline text={cell} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, i) => (
                          <tr key={i}>
                            {block.headers.map((_, j) => (
                              <td key={j}>
                                <Inline text={row[j] || ""} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              if (block.type === "list") {
                const Tag = block.ordered ? "ol" : "ul";
                return (
                  <Tag
                    key={index}
                    start={block.ordered ? block.start : undefined}
                    className={`content-list ${block.ordered ? "steps" : "cards"}`}
                  >
                    {block.items.map((item, i) => (
                      <li key={i}>
                        {item.checked !== null ? (
                          <span
                            className="content-check"
                            aria-label={
                              item.checked ? "原文标记已完成" : "原文标记待处理"
                            }
                          >
                            {item.checked ? "☑" : "☐"}
                          </span>
                        ) : block.ordered ? (
                          <span className="step-number">{block.start + i}</span>
                        ) : (
                          <span className="list-dot" />
                        )}
                        <div>
                          <Inline text={item.text} />
                        </div>
                      </li>
                    ))}
                  </Tag>
                );
              }
              if (block.type === "quote")
                return (
                  <blockquote key={index}>
                    <Inline text={block.text} />
                  </blockquote>
                );
              if (block.type === "rule") return <hr key={index} />;
              return (
                <p key={index}>
                  <Inline text={block.text} />
                </p>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
});

const Message = memo(function Message({ message, streaming = false }) {
  const [copied, setCopied] = useState("");
  const user = message.role === "user";
  return (
    <div className="canvas-message-shell">
      <article
        data-message-id={message.id}
        className={`chat-msg canvas-message ${user ? "user" : "assistant"} ${streaming ? "is-streaming" : ""}`}
      >
        <div className="canvas-message-head">
          <span className="canvas-role">
            <Icon name={user ? "chat" : "spark"} />
            {user ? "你的提问" : "AI 回复"}
            {streaming && (
              <span className="tag">
                <span className="status-dot connecting" />
                实时生成中
              </span>
            )}
            {message.partial && <span className="tag amber">未完成</span>}
          </span>
          {message.at && <time>{timeLabel(message.at)}</time>}
        </div>
        {!user && !streaming && (
          <details className="canvas-message-original">
            <summary>查看原文</summary>
            <pre>{message.text}</pre>
          </details>
        )}
        {user ? (
          <div className="content-block-row">
            <div
              className="canvas-prompt selectable-block"
              data-block-index={-1}
            >
              {message.text}
            </div>
          </div>
        ) : (
          <StructuredContent text={message.text} selectable={!streaming} />
        )}
        {!user && !streaming && (
          <div className="canvas-message-actions">
            <Button
              small
              quiet
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.text);
                  setCopied("已复制");
                } catch {
                  setCopied("复制失败，请从原文复制");
                }
              }}
            >
              {copied || "复制回复"}
            </Button>
          </div>
        )}
      </article>
    </div>
  );
});

export function ConversationCanvas({
  pageId,
  session,
  streams = [],
  pending,
  busy,
}) {
  const root = useRef(null);
  const [popupRoot, setPopupRoot] = useState(null);
  const { selection, threads, error, save, open, close } = useTextSelection(
    pageId,
    root,
  );
  const [focusedThread, setFocusedThread] = useState(null);
  const reopen = (thread, event, showPopup = true) => {
    setFocusedThread(thread.anchor.key);
    const article = root.current?.querySelector(
      `[data-message-id="${thread.anchor.messageId}"]`,
    );
    article
      ?.querySelector(`[data-block-index="${thread.anchor.blockIndex}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    const rect = event.currentTarget.getBoundingClientRect();
    if (showPopup) open(
      { ...thread.anchor, x: rect.right + 8, y: rect.top },
      thread.anchor.action,
    );
    const target = document.getElementById(`reply-${thread.anchor.key}`);
    const panel = target?.closest(".zone-c-content");
    if (panel)
      panel.scrollTo({
        top: target.offsetTop - panel.offsetTop,
        behavior: "smooth",
      });
  };
  const hasReplies = threads.some(
    (s) => s.messages.length || s.status === "running",
  );
  return (
    <section ref={root} className="conversation-canvas" aria-label="对话内容区">
      <div className="canvas-heading">
        <div>
          <span className="eyebrow">LIVE CONTENT</span>
          <h2>对话与思路</h2>
        </div>
        <span className="tag">{busy ? "正在回复" : "内容随对话更新"}</span>
      </div>
      <p className="selection-hint">
        选中一段文字，可针对这段提问或搜索相关资源。
      </p>
      {error && (
        <p role="alert" className="agent-error">
          {error}
        </p>
      )}
      {selection && (
        <div
          className="selection-popup"
          role="dialog"
          aria-label="选段聊天浮窗"
          style={{
            left: `clamp(8px, ${selection.x}px, max(8px, calc(100vw - 388px)))`,
            top: `clamp(8px, ${selection.y}px, max(8px, calc(100dvh - 350px)))`,
          }}
        >
          <div className="selection-thread-head">
            <strong>围绕选中文字聊聊</strong>
            <Button
              small
              quiet
              icon="close"
              aria-label="关闭选段聊天浮窗"
              onClick={close}
            />
          </div>
          <div className="selection-popup-modes">
            <Button
              small
              aria-pressed={selection.action === "question"}
              onClick={() => open(selection, "question")}
              icon="chat"
            >
              提问
            </Button>
            <Button
              small
              aria-pressed={selection.action === "resources"}
              onClick={() => open(selection, "resources")}
              icon="search"
            >
              搜索相关资源
            </Button>
          </div>
          <div ref={setPopupRoot} />
        </div>
      )}
      <div className="conversation-columns">
        <aside className="conversation-zone zone-a" aria-label="A 子对话标签">
          <h3 className="zone-heading">
            <span>A</span> 子对话标签
          </h3>
          {!hasReplies && (
            <p className="zone-empty">
              选中主对话文字提问后，标签会出现在这里。
            </p>
          )}
          <ThreadLabels threads={threads} focusedThread={focusedThread} onOpen={(thread, event) => reopen(thread, event, false)} />
        </aside>
        <section className="conversation-zone zone-b" aria-label="B 主对话">
          <h3 className="zone-heading">
            <span>B</span> 主对话
          </h3>
          <div className="canvas-messages">
            {session?.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {pending && <Message message={{ role: "user", text: pending }} />}
            {streams.map((item) => (
              <Message
                key={item.id}
                message={{ role: "assistant", text: item.text }}
                streaming
              />
            ))}
          </div>
          {busy && !streams.length && (
            <div className="canvas-waiting" role="status">
              <span className="status-dot connecting" />
              正在处理，回复到达后会直接呈现在这里…
            </div>
          )}
          {!busy && !session?.messages.length && (
            <div className="canvas-empty">
              <Icon name="spark" />
              <h3>让对话，在这里展开</h3>
              <p>在底部提出问题，回复会逐步呈现为段落、清单、表格等内容。</p>
            </div>
          )}
          <div className="canvas-latest" />
        </section>
        <aside className="conversation-zone zone-c" aria-label="C 子对话回复">
          <h3 className="zone-heading">
            <span>C</span> 子对话回复
          </h3>
          <div className="zone-c-content">
            {!hasReplies && (
              <p className="zone-empty">
                选段追问的回答会集中展示在这里，不混入主对话。
              </p>
            )}
            {threads.map((s) => (
              <div
                id={`reply-${s.anchor.key}`}
                className={`selection-response-slot ${focusedThread === s.anchor.key ? "is-focused" : ""}`}
                key={s.anchor.key}
              >
                <SelectionThread
                  initial={s}
                  active={selection?.key === s.anchor.key}
                  popupRoot={popupRoot}
                  parentNumber={
                    threads.findIndex(
                      (parent) =>
                        parent.anchor.key === s.anchor.parentThreadKey,
                    ) + 1
                  }
                  onLocateParent={() => {
                    setFocusedThread(s.anchor.parentThreadKey);
                    const target = document.getElementById(
                      `reply-${s.anchor.parentThreadKey}`,
                    );
                    const panel = target?.closest(".zone-c-content");
                    if (panel)
                      panel.scrollTo({
                        top: target.offsetTop - panel.offsetTop,
                        behavior: "smooth",
                      });
                  }}
                  onSaved={save}
                  onOpen={(event) => reopen(s, event)}
                  renderContent={(text, selectable = false) => (
                    <StructuredContent text={text} selectable={selectable} />
                  )}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
