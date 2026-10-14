import React from "react";
import { useWB } from "./context";
import { Button } from "./components";

export function ProjectTools({ type, page, onSave }) {
  const { state, setModal } = useWB();
  const links = page.modules.filter((m) => m.type === "links").flatMap((m) => m.items).filter((item) => /^https?:\/\//i.test(item.url));
  if (type === "urls") return <section className="project-tools-panel">
    <h2>URL 链接</h2>
    <p>当前项目的本地入口与常用链接。</p>
    {[{ text: "打开项目预览", url: `${state.previewOrigin}/app/${page.id}/` }, { text: "打开 WB 管理页", url: `${location.origin}/#/page/${page.id}` }, ...links].map((item, index) => <a className="project-tool-link" key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.text || item.url}</strong><small>{item.url}</small></a>)}
    <Button small icon="plus" onClick={() => setModal({ type: "form", title: "添加项目链接", fields: [{ name: "text", label: "链接名称", required: true }, { name: "url", label: "URL", placeholder: "https://…", required: true }], onSubmit: async (input) => {
      let url;
      try { url = new URL(input.url.trim()); } catch { throw new Error("请输入完整的 http 或 https 地址"); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("仅支持不含账号密码的 http / https 地址");
      const group = page.modules.find((m) => m.type === "links" && m.title === "项目 URL");
      const item = { text: input.text.trim(), url: url.href };
      await onSave({ modules: group ? page.modules.map((m) => m.id === group.id ? { ...m, items: [...m.items, item] } : m) : [...page.modules, { title: "项目 URL", type: "links", items: [item] }] });
    } })}>添加链接</Button>
    <p>链接保存在当前项目资料中。不会自动访问或验证外部地址，请勿保存带密钥的 URL。</p>
  </section>;
  if (type === "database") return <section className="project-tools-panel">
    <h2>数据库</h2><span className="tag">目标项目数据库尚未接入管理</span>
    <p>这里预留目标项目的数据库管理入口。目前不能在 WB 中查看数据库表、执行 SQL 或验证连接。</p>
    <h3>WB 自身的数据</h3><p>对话、Todo 和资料版本保存在 WB 的本地 SQLite 中。这不代表目标项目也使用 SQLite。</p>
    <h3>后续可管理</h3><ul><li>数据库类型与环境</li><li>表结构、迁移记录与备份</li><li>连接状态与访问权限</li></ul>
    <p>请勿把数据库密码或连接密钥保存到普通项目资料。</p>
  </section>;
  return <section className="project-tools-panel">
    <h2>运行与部署</h2><span className="tag">本地预览</span>
    <h3>目标项目目录</h3><code>{page.rootPath || "未关联本地目录"}</code>
    <h3>预览规则</h3><p>WB 优先展示 dist/index.html；不存在时使用项目根目录的 index.html。此规则不代表构建已成功。</p>
    <h3>线上部署</h3><p>暂未接入部署服务、域名绑定或部署状态查询。当前操作不会发布项目或运行构建命令。</p>
    <h3>上线前检查</h3><ul><li>构建命令与产物目录</li><li>环境变量与密钥配置</li><li>域名、HTTPS 与接口地址</li><li>数据库迁移、备份与回滚方案</li></ul>
  </section>;
}
