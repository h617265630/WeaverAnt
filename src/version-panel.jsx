import React from "react";
import { Button } from "./components";
import { timeLabel } from "./api";
import { useWB } from "./context";

export function VersionPanel({ page, versions, onRestore, busy }) {
  const { setModal } = useWB();
  return <section className="project-version-panel" aria-label="项目版本控制">
    <h2>版本控制</h2>
    <p className="version-scope">WB 管理资料 · 当前 v{page.revision}</p>
    <p className="version-explanation">记录标题、简介、Todo 和内容模块的历史。恢复会生成新版本，保留历史；不会回滚代码文件，也不会删除聊天记录。这不是 Git 代码版本控制。</p>
    {busy && <p role="status" className="version-explanation">AI 正在执行任务，结束后可恢复资料版本。</p>}
    {!versions.length && <p className="version-explanation">暂无版本记录。</p>}
    {versions.map((version) => <article className="project-version-card" key={version.id}>
      <div className="project-version-title"><strong>v{version.revision}</strong>{version.revision === page.revision && <span className="tag">当前版本</span>}</div>
      <p>{version.reason}</p>
      <time dateTime={version.at} title={version.at}>{timeLabel(version.at)}</time>
      <Button small disabled={busy || version.revision === page.revision} onClick={() => setModal({
        type: "form", title: `恢复资料到 v${version.revision}`,
        description: "将恢复标题、简介、Todo、内容模块及专属页面配置，并生成一个新版本。代码文件与原始聊天记录不受影响，当前资料版本仍可再次恢复。",
        fields: [], submitLabel: "确认恢复资料", onSubmit: () => onRestore(version.id),
      })}>恢复此版本</Button>
    </article>)}
  </section>;
}
