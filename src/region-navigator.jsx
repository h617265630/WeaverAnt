import React, { useEffect, useState } from "react";
import { Button } from "./components";

export function RegionNavigator({ hierarchy, pending, onNavigate }) {
  const [childrenOpen, setChildrenOpen] = useState(false);
  useEffect(() => setChildrenOpen(false), [hierarchy?.token]);
  if (!hierarchy) return null;
  return <div className="region-navigator">
    <nav className="region-path" aria-label="选中区域层级">
      {hierarchy.path.map((node, index) => <React.Fragment key={node.id}>
        {index > 0 && <span aria-hidden="true">›</span>}
        <button type="button" title={node.label} aria-current={node.current ? "location" : undefined} disabled={pending} onClick={() => onNavigate(node.id)}>{node.label}</button>
      </React.Fragment>)}
    </nav>
    <div className="region-navigation-actions">
      <Button small quiet disabled={pending || hierarchy.parentId === null} onClick={() => onNavigate(hierarchy.parentId)}>选父级 ↑</Button>
      <Button small quiet disabled={pending || !hierarchy.children.length} aria-expanded={childrenOpen} aria-controls="region-children" onClick={() => setChildrenOpen(!childrenOpen)}>选子级 ↓ ({hierarchy.children.length})</Button>
      {pending && <small role="status">切换中…</small>}
    </div>
    {childrenOpen && <div id="region-children" className="region-children" role="group" aria-label="可选子元素">
      {hierarchy.children.map((node, index) => <button type="button" key={node.id} disabled={pending} title={node.label} onClick={() => onNavigate(node.id)}><small>{index + 1}</small>{node.label}</button>)}
    </div>}
  </div>;
}
