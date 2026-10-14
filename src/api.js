export const token = document.querySelector('meta[name="wb-token"]').content;
export async function api(path, data, method) {
  const response = await fetch(`/api${path}`, {
    method: method || (data === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "X-WB-Token": token },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "请求失败");
  return value;
}
export async function download(pageId, title) {
  const response = await fetch(`/api/pages/${pageId}/export`, {
    headers: { "X-WB-Token": token },
  });
  if (!response.ok) throw new Error("导出失败");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const go = (path) => {
  location.hash = path;
};
export const timeLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "尚未同步";
