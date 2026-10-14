import React, { useMemo } from "react";
import { Icon } from "./components";

function buildTree(files) {
  const root = new Map();
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let children = root;
    parts.forEach((name, index) => {
      if (!children.has(name)) children.set(name, {
        name, path: parts.slice(0, index + 1).join("/"),
        directory: index < parts.length - 1, children: new Map(),
      });
      children = children.get(name).children;
    });
  }
  return root;
}

function Branch({ nodes }) {
  const sorted = [...nodes.values()].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
  return <ul>{sorted.map((node) => <li key={node.path}>
    {node.directory ? <details>
      <summary title={node.path}><Icon name="folder" /><span>{node.name}</span></summary>
      <Branch nodes={node.children} />
    </details> : <div className="project-tree-file" title={node.path}><Icon name="code" /><span>{node.name}</span></div>}
  </li>)}</ul>;
}

export function FileTree({ files = [] }) {
  const tree = useMemo(() => buildTree(files), [files]);
  return <section className="project-file-tree" aria-label="项目文件目录">
    <details open>
      <summary className="project-tree-heading">文件目录 <small>{files.length}</small></summary>
      <div className="project-tree-scroll">
        {files.length ? <Branch nodes={tree} /> : <p className="project-tree-empty">暂无已索引文件，项目生成或同步后会显示在这里。</p>}
      </div>
      <p className="project-tree-note">已索引源码 · 不含隐藏文件、依赖及构建目录</p>
    </details>
  </section>;
}
