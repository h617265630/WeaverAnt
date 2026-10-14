export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderPage(page) {
  if (page.customHtml) return page.customHtml;
  const e = escapeHtml;
  const sections = page.modules
    .map(
      (m) =>
        `<section id="${e(m.id)}"><p class="label">${e(m.type === "tasks" ? "TASKS" : "NOTE")}</p><h2>${e(m.title)}</h2>${m.content ? `<p class="content">${e(m.content)}</p>` : ""}${m.type === "tasks" ? `<ul>${m.items.map((i) => `<li>${i.done ? "☑" : "☐"} ${e(i.text)}</li>`).join("")}</ul>` : m.type === "links" ? `<ul>${m.items.map((i) => `<li>${/^https?:\/\//.test(i.url) ? `<a href="${e(i.url)}" rel="noreferrer">${e(i.text)}</a>` : e(i.text)}</li>`).join("")}</ul>` : ""}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(page.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#26313b;font:16px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}main{max-width:960px;margin:64px auto;padding:0 28px}header{padding:36px 0}h1{font-size:40px;line-height:1.3;letter-spacing:-1.5px}header p{color:#687380}.label{font-size:11px;letter-spacing:2px;color:#75887c}nav{display:flex;gap:16px;flex-wrap:wrap;margin:28px 0}a{color:#47735b}section{background:white;border:1px solid #e6e9e8;border-radius:14px;padding:24px 30px;margin:16px 0}h2{font-size:22px}.content{white-space:pre-wrap}li{margin:10px 0}footer{color:#84908a;font-size:12px;padding:28px 0}@media(max-width:600px){main{margin:24px auto;padding:0 18px}h1{font-size:28px}}</style></head><body><main><header><p class="label">WB / ${page.kind === "project" ? "PROJECT" : "KNOWLEDGE"}</p><h1>${e(page.title)}</h1><p>${e(page.summary)}</p></header><nav>${page.modules.map((m) => `<a href="#${e(m.id)}">${e(m.title)}</a>`).join("")}</nav>${sections}<footer>由 WB 整理 · 版本 ${page.revision} · 可独立离线阅读</footer></main></body></html>`;
}
