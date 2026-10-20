import React, { useState } from "react";

const palettes = [
  { name: "极简黑白", colors: ["#FFFFFF", "#F4F4F5", "#18181B", "#52525B"], note: "内容优先，适合工具与工作台" },
  { name: "清爽蓝", colors: ["#FFFFFF", "#EFF6FF", "#1D4ED8", "#0F172A"], note: "清晰可信，适合数据与管理界面" },
  { name: "自然绿", colors: ["#FAFAF9", "#ECFDF5", "#047857", "#1C1917"], note: "柔和安静，适合生活与记录类界面" },
  { name: "暖陶色", colors: ["#FFFBF5", "#FFF1E6", "#9A3412", "#292524"], note: "温暖克制，适合阅读与内容展示" },
];
const components = [
  { name: "信息卡片", kind: "cards", note: "把一组内容整理成有主次的卡片", instruction: "整理成响应式信息卡片：标题、关键内容、辅助说明分层，统一间距与圆角。" },
  { name: "标签页", kind: "tabs", note: "同一位置切换不同类别的内容", instruction: "改成可切换的标签页，保留所有已有内容，支持键盘操作、选中状态和正确的 ARIA 语义。" },
  { name: "数据列表", kind: "list", note: "提高重复信息的浏览与比较效率", instruction: "整理成紧凑的数据列表，字段对齐，保留已有操作，兼顾移动端阅读和空状态。" },
  { name: "折叠面板", kind: "accordion", note: "收起次要信息，减少页面拥挤", instruction: "改成可展开与收起的面板，标题始终可见，使用语义化按钮或 details，保留原有内容与交互。" },
];
const suggestions = [
  ["怎么改更好", "请分析选中区域的设计与交互，给出 3 条按优先级排列的改进建议，分别说明问题、修改方法和影响范围。只提供建议，不修改文件，不执行写入操作。"],
  ["推荐配色", "请结合选中区域与项目风格推荐 3 套配色，每套列出背景、表面、主色、正文的 HEX 色值，说明用途及对比度注意事项。只提供建议，不修改文件，不执行写入操作。"],
  ["推荐组件", "请分析选中区域的信息结构，推荐 3 种合适的 UI 组件方案，说明各自的优缺点、交互方式和移动端表现。优先复用现有技术栈，不安装依赖。只提供建议，不修改文件，不执行写入操作。"],
];

export function DesignSuggestions({ disabled, onChoose }) {
  const [panel, setPanel] = useState(null);
  const [selected, setSelected] = useState(null);
  const choosePanel = (next) => { setPanel(panel === next ? null : next); setSelected(null); };
  return <section className="design-suggestions" aria-label="局部设计助手">
    <div className="design-suggestion-nav">
      {[["advice", "AI 建议"], ["palette", "配色卡"], ["component", "UI 组件"]].map(([key, title]) =>
        <button type="button" key={key} aria-expanded={panel === key} onClick={() => choosePanel(key)}>{title}</button>)}
    </div>
    {panel && <div className="design-suggestion-panel">
      <p>{panel === "advice" ? "将分析请求填入输入框，发送后在左侧查看 AI 建议。" : "内置方案 · 先选预览，再填入指令；发送后才执行修改。"}</p>
      {panel === "advice" ? <div className="design-advice-options">{suggestions.map(([title, prompt]) =>
        <button type="button" disabled={disabled} key={title} onClick={() => onChoose(prompt)}>{title}</button>)}</div> : <>
        <div className="design-option-grid">
          {(panel === "palette" ? palettes : components).map((item) => <button type="button" key={item.name} className="design-option" aria-pressed={selected === item} onClick={() => setSelected(item)}>
            {item.colors ? <span className="design-swatches">{item.colors.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}</span> :
              <span aria-hidden="true" className={`design-component-preview ${item.kind}`}><i /><i /><i /></span>}
            <strong>{item.name}</strong><small>{item.note}</small>
          </button>)}
        </div>
        {selected && <div className="design-selection">
          {selected.colors && <div className="design-color-values">{selected.colors.map((color, i) => <span key={color}>{["背景", "表面", "主色", "正文"][i]} <code>{color}</code></span>)}</div>}
          <button type="button" disabled={disabled} onClick={() => onChoose(selected.colors ?
            `仅修改当前选中区域的配色，采用「${selected.name}」：背景 ${selected.colors[0]}，表面 ${selected.colors[1]}，主色 ${selected.colors[2]}，正文 ${selected.colors[3]}。保持现有布局与功能，检查文字和交互状态的对比度，不要修改全局主题或其他区域。` :
            `仅修改当前选中区域：${selected.instruction}保留现有数据与业务功能，优先复用项目已有组件，不影响其他区域。`)}>将「{selected.name}」填入指令</button>
        </div>}
      </>}
    </div>}
  </section>;
}
