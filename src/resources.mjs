// A derived index over persisted messages/tool events; originals remain untouched.
export function collectResources(page, sessions = [], events = []) {
  const found = new Map();
  const add = (value, title, source) => {
    title = typeof title === "string" ? title : "";
    let url;
    try {
      url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return;
    } catch {
      return;
    }
    const key = url.href;
    if (!found.has(key))
      found.set(key, { url: key, title: title || url.hostname, sources: [] });
    const entry = found.get(key);
    if (title && entry.title === url.hostname) entry.title = title;
    if (!entry.sources.some((s) => s.id === source.id))
      entry.sources.push(source);
  };
  const textLinks = (text, source) => {
    if (typeof text !== "string") return;
    const plain = text
      .replace(/(```|~~~)[\s\S]*?\1/g, "")
      .replace(/`[^`]*`/g, "");
    for (const match of plain.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g))
      add(match[2], match[1], source);
    for (const match of plain.matchAll(/https?:\/\/[^\s<>"'\]）]+/g))
      add(match[0].replace(/[.,;:!?，。；！？”）)]+$/, ""), "", source);
  };
  const visit = (value, source) => {
    if (typeof value === "string") {
      textLinks(value, source);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, source));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const key of ["url", "uri", "href"])
      if (typeof value[key] === "string")
        add(value[key], value.title || value.name || "", source);
    for (const [key, child] of Object.entries(value)) {
      if (
        ![
          "url",
          "uri",
          "href",
          "arguments",
          "input",
          "query",
          "queries",
        ].includes(key)
      )
        visit(child, source);
    }
  };
  for (const session of sessions)
    for (const message of session.messages || []) {
      textLinks(message.text, {
        id: message.id,
        label: message.role === "user" ? "用户分享" : "AI 回复",
        at: message.at,
        excerpt: message.text,
      });
    }
  for (const event of events) {
    const item = event.params?.item;
    if (
      event.method !== "item/completed" ||
      !["webSearch", "mcpToolCall"].includes(item?.type)
    )
      continue;
    const source = {
      id: item.id || event.at,
      label: item.type === "webSearch" ? "搜索 / 浏览来源" : "工具返回资源",
      at: event.at,
      excerpt: item.query || item.tool || "",
    };
    visit(item.type === "mcpToolCall" ? item.result : item, source);
  }
  for (const module of page.modules || [])
    if (module.type === "links") {
      for (const item of module.items || [])
        add(item.url, item.text, {
          id: module.id,
          label: "资源模块",
          excerpt: module.title,
        });
    }
  return [...found.values()];
}
