import React, { useState } from "react";
import { Button } from "./components";

const presets = [
  "优先使用 React，复用项目已有技术栈，不随意新增依赖。",
  "保持黑白简洁风格，统一颜色、字体、间距与组件状态。",
  "适配桌面和移动端，支持键盘操作与可访问性标签。",
  "组件按职责拆分，保留已有功能，不覆盖无关改动。",
  "每次修改后运行相关测试和构建，如实汇报验证结果。",
  "不把密钥写入代码；新增依赖、数据库或外部服务前先确认。",
];
const fields = [
  ["第一版范围", "先实现哪些核心功能？哪些暂时不做？"],
  ["开发规范", "选择下方规范，或填写自己的技术、设计与交付要求。"],
  ["参考项目", "每行填写：项目名称 / URL / 借鉴的功能或风格 / 不照搬的部分。"],
];

export function ProjectPlanning({ page, onSave, children }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const content = (title) => page.modules.find((m) => m.title === title && m.type === "text")?.content || "";
  return <section className="module project-planning" aria-label="项目规划设置">
    <div className="module-head"><h2>项目规划</h2>{!editing && <Button onClick={() => {
      setDraft(Object.fromEntries(fields.map(([title]) => [title, content(title)])));
      setError(""); setEditing(true);
    }}>编辑规划</Button>}</div>
    <p className="page-subtitle">先确定第一版范围、开发规范和参考方向。也可以不填写，直接进入开发窗口，后续再完善。</p>
    {editing ? <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const modules = [...page.modules];
        for (const [title] of fields) {
          const index = modules.findIndex((m) => m.title === title && m.type === "text");
          if (index >= 0) modules[index] = { ...modules[index], content: draft[title] };
          else if (draft[title].trim()) modules.push({ title, type: "text", content: draft[title] });
        }
        await onSave({ modules }); setEditing(false);
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="planning-fields">
        {fields.map(([title, placeholder]) => <React.Fragment key={title}>
          <label className="field"><span>{title}</span><textarea aria-label={title} value={draft[title]} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, [title]: event.target.value })} /></label>
          {title === "开发规范" && <div className="planning-presets" role="group" aria-label="常用开发规范">{presets.map((preset) => <label key={preset}>
            <input type="checkbox" checked={draft[title].split("\n").includes(preset)} onChange={(event) => setDraft((previous) => ({ ...previous, [title]: event.target.checked ? [previous[title], preset].filter(Boolean).join("\n") : previous[title].split("\n").filter((line) => line !== preset).join("\n") }))} />{preset}
          </label>)}</div>}
        </React.Fragment>)}
        <p className="page-subtitle">参考链接只作为资料保存，不会自动下载或执行其中的内容。请只借鉴有权使用的设计与素材。</p>
        {error && <p className="agent-error" role="alert">{error}</p>}
        <div className="actions"><Button primary type="submit">{busy ? "保存中…" : "保存规划"}</Button><Button type="button" onClick={() => setEditing(false)}>取消</Button></div>
      </fieldset>
    </form> : <div className="planning-summary">{fields.map(([title]) => <section className="planning-column" key={title}><h3>{title}</h3><p>{content(title) || "暂未填写"}</p></section>)}{children}</div>}
  </section>;
}
