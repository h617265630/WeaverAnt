// Presentation only: no HTML evaluation, no summarization, no changes to source records.
export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((value) => value.trim());
export function contentBlocks(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const blocks = [];
  const list = (line) => line.match(/^\s*(?:([-+*])\s+|(\d+)[.)]\s+)(.*)$/);
  const special = (line) =>
    /^\s*(?:#{1,6}\s|```|~~~|>\s|[-*_]{3,}\s*$)/.test(line) || list(line);
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*(```|~~~)(.*)$/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1]))
        body.push(lines[i++]);
      const complete = i < lines.length;
      if (complete) i++;
      blocks.push({
        type: "code",
        language: fence[2].trim(),
        text: body.join("\n"),
        complete,
      });
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      i++;
      continue;
    }
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const headers = cells(line),
        rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|"))
        rows.push(cells(lines[i++]));
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    const first = list(line);
    if (first) {
      const ordered = !!first[2],
        items = [];
      let match;
      while (
        i < lines.length &&
        (match = list(lines[i])) &&
        !!match[2] === ordered
      ) {
        const check = match[3].match(/^\[([ xX])\]\s+(.*)$/);
        items.push({
          text: check ? check[2] : match[3],
          checked: check ? check[1].toLowerCase() === "x" : null,
        });
        i++;
      }
      blocks.push({
        type: "list",
        ordered,
        start: Number(first[2] || 1),
        items,
      });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !special(lines[i])) {
      if (
        lines[i].includes("|") &&
        i + 1 < lines.length &&
        cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
      )
        break;
      paragraph.push(lines[i++]);
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}
