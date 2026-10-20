import { test, expect } from "@playwright/test";

test("floating composer has a compact toolbar, circular send control and growing input", async ({ page }) => {
  const turns = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/turn")) turns.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("输入框样式测试");
  await page.getByLabel("WB 聊天输入").press("Enter");
  await expect(page.locator(".canvas-message.assistant")).toHaveCount(1);
  const dock = page.getByRole("region", { name: "底部悬浮聊天窗口" });
  const input = dock.getByLabel("WB 聊天输入");
  const send = dock.getByLabel("发送 WB 消息");
  await expect(dock.locator(".dock-head")).toHaveCount(0);
  await expect(send).toBeDisabled();
  expect(await send.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("50%");
  const originalHeight = (await input.boundingBox()).height;
  await input.fill(Array.from({ length: 8 }, (_, i) => `第 ${i + 1} 行输入`).join("\n"));
  await expect(send).toBeEnabled();
  await expect.poll(async () => (await input.boundingBox()).height).toBeGreaterThan(originalHeight);
  expect((await input.boundingBox()).height).toBeLessThanOrEqual(120);
  await dock.getByRole("button", { name: "最新回复" }).click();
  expect(turns).toHaveLength(1);
  await expect(input).toHaveValue(/第 8 行输入/);
  await input.fill("");
  await expect.poll(async () => (await input.boundingBox()).height).toBe(originalHeight);
});

for (const width of [1440, 390]) {
  test(`main replies follow streaming above the dock and respect history scrolling (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByLabel("WB 聊天输入").fill("测试滚动跟随");
    await page.getByLabel("WB 聊天输入").press("Enter");
    await expect(page.locator(".zone-b")).toBeVisible();
    const closeManagement = page.getByLabel("收起资料与管理");
    if (width === 390 && await closeManagement.isVisible()) await closeManagement.click();
    const visibleTail = async () => page.evaluate(() => {
      const tail = document.querySelector(".canvas-latest").getBoundingClientRect();
      const dock = document.querySelector(".wb-floating-dock").getBoundingClientRect();
      const panel = document.querySelector(".zone-b-content");
      const bounds = panel.getBoundingClientRect();
      return panel.scrollHeight - panel.clientHeight - panel.scrollTop < 2 &&
        tail.bottom <= bounds.bottom && tail.bottom >= bounds.top && bounds.bottom < dock.top;
    });
    await expect(page.locator(".conversation-toolbar .page-title")).toHaveCount(0);
    await expect(page.locator(".zone-b .canvas-message.user").first()).toContainText("测试滚动跟随");
    const panelsBefore = await page.locator(".conversation-columns").boundingBox();
    await expect(page.getByRole("heading", { name: "跟随片段 2", exact: true })).toBeVisible();
    await expect.poll(visibleTail).toBe(true);
    await page.evaluate(() => {
      const panel = document.querySelector(".zone-b-content");
      panel.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, bubbles: true }));
      panel.scrollBy(0, -300);
    });
    const pausedY = await page.locator(".zone-b-content").evaluate((el) => el.scrollTop);
    await expect(page.getByRole("heading", { name: "跟随片段 3", exact: true })).toBeVisible();
    expect(Math.abs(await page.locator(".zone-b-content").evaluate((el) => el.scrollTop) - pausedY)).toBeLessThan(5);
    await page.getByRole("button", { name: "最新回复" }).click();
    await expect.poll(visibleTail).toBe(true);
    await expect(page.getByLabel("停止执行")).toHaveCount(0, { timeout: 15000 });
    await expect.poll(visibleTail).toBe(true);
    // Sending from a history position re-enables following for the new turn.
    await page.locator(".zone-b-content").evaluate((el) => el.scrollTo(0, 0));
    await page.getByLabel("WB 聊天输入").fill("再问一个问题");
    await page.getByLabel("WB 聊天输入").press("Enter");
    await expect(page.locator(".zone-b .canvas-message.assistant")).toHaveCount(2);
    await expect(page.locator(".canvas-role")).toHaveCount(0);
    await expect(page.getByText(/^(你的提问|你的追问|AI 回复)$/)).toHaveCount(0);
    await expect.poll(visibleTail).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const panelsAfter = await page.locator(".conversation-columns").boundingBox();
    expect(panelsAfter.y).toBeCloseTo(panelsBefore.y, 0);
    expect(await page.locator(".zone-c-content").evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
    await page.screenshot({ path: `test-results/wb-fixed-panels-${width}.png` });
  });
}

test("child replies can create recursive independent sub-conversations", async ({
  page,
}) => {
  const turns = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/turn"))
      turns.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("多层子对话测试");
  await page.getByLabel("WB 聊天输入").press("Enter");
  const popup = page.getByRole("dialog", { name: "选段聊天浮窗" });
  const select = async (block) => {
    if (await popup.isVisible())
      await popup.getByLabel("关闭选段聊天浮窗").click();
    await block.scrollIntoViewIfNeeded();
    await block.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await expect(popup.getByLabel("选段追问输入")).toBeVisible();
  };
  const root = page
    .locator(".zone-b .canvas-message.assistant .selectable-block")
    .first();
  await expect(root).toContainText("测试回复");
  await select(root);
  await popup.getByLabel("选段追问输入").fill("解释原文");
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(page.locator(".selection-reply.assistant")).toHaveCount(1);
  const parentKey = turns[1].anchor.key;
  const parent = page.locator(`[data-thread-key="${parentKey}"]`);
  const parentMessage = parent.locator(".selection-reply.assistant");
  const sourceMessageId = await parentMessage.getAttribute("data-message-id");
  await select(parentMessage.locator(".selectable-block").first());
  await popup
    .getByRole("button", { name: "搜索相关资源", exact: true })
    .click();
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(page.locator(".selection-reply.assistant")).toHaveCount(2);
  const childKey = turns[2].anchor.key;
  expect(turns[2].anchor.parentThreadKey).toBe(parentKey);
  expect(turns[2].anchor.messageId).toBe(sourceMessageId);
  expect(turns[2].anchor.depth).toBe(2);
  expect(turns[2].anchor.sourceSessionId).toBe(
    await parent.getAttribute("data-session-id"),
  );
  const child = page.locator(`[data-thread-key="${childKey}"]`);
  await select(
    child.locator(".selection-reply.assistant .selectable-block").first(),
  );
  await popup.getByLabel("选段追问输入").fill("进一步说明");
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(page.locator(".selection-reply.assistant")).toHaveCount(3);
  expect(turns[3].anchor.parentThreadKey).toBe(childKey);
  expect(turns[3].anchor.depth).toBe(3);
  const grandchildKey = turns[3].anchor.key;
  await page.reload();
  const grandchild = page.locator(`[data-thread-key="${grandchildKey}"]`);
  await expect(grandchild).toHaveAttribute("data-thread-depth", "3");
  await expect(page.locator(".zone-a .selection-marker")).toHaveCount(3);
  const label = (key) => page.locator(`[data-label-key="${key}"] > .selection-marker`);
  const toggle = (key) => page.locator(`[data-label-key="${key}"] > .thread-label-toggle`);
  await expect(label(parentKey)).toBeVisible();
  await expect(label(childKey)).toBeHidden();
  await expect(label(grandchildKey)).toBeHidden();
  await expect(toggle(parentKey)).toHaveAttribute("aria-expanded", "false");
  await toggle(parentKey).click();
  await expect(label(childKey)).toBeVisible();
  await expect(label(grandchildKey)).toBeHidden();
  await toggle(childKey).focus();
  await toggle(childKey).press("Enter");
  await expect(label(grandchildKey)).toBeVisible();
  await label(grandchildKey).click();
  await expect(popup).toBeHidden();
  await expect(page.locator(`#reply-${grandchildKey}`)).toHaveClass(/is-focused/);
  await toggle(parentKey).click();
  await expect(label(grandchildKey)).toBeHidden();
  await expect(page.locator(".zone-c .selection-thread")).toHaveCount(3);
  const mainScroll = await page.locator(".zone-b-content").evaluate((el) => el.scrollTop);
  const childPanel = page.locator(".zone-c-content");
  expect(await childPanel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await childPanel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await childPanel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator(".zone-b-content").evaluate((el) => el.scrollTop)).toBe(mainScroll);
  await expect(page.locator(".zone-b .canvas-message")).toHaveCount(2);
  await grandchild.getByRole("button", { name: "查看上级" }).click();
  await expect(page.locator(`#reply-${childKey}`)).toHaveClass(/is-focused/);
  await grandchild.getByRole("button", { name: "继续聊" }).click();
  await popup.getByLabel("选段追问输入").fill("继续第三层");
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(grandchild.locator(".selection-reply.assistant")).toHaveCount(2);
  expect(turns[4].anchor.key).toBe(grandchildKey);
});

test("topbar is fixed and aligned when scrolling or toggling navigation", async ({
  page,
}) => {
  await page.goto("/#/architecture");
  const bar = page.locator(".topbar");
  expect(await bar.evaluate((e) => getComputedStyle(e).position)).toBe("fixed");
  expect((await bar.boundingBox()).x).toBe(0);
  const content = await page.locator(".main > .page").boundingBox();
  expect(content.y).toBeGreaterThanOrEqual(70);
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await bar.boundingBox()).y).toBe(0);
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  const sidebar = await page.locator(".shell > .sidebar").boundingBox();
  expect((await bar.boundingBox()).x).toBe(sidebar.x + sidebar.width);
  await page.getByRole("button", { name: "收起侧边栏" }).click();
  expect((await bar.boundingBox()).x).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await bar.boundingBox();
  expect(mobile.x).toBe(0);
  expect(mobile.y).toBe(0);
  expect(mobile.width).toBe(390);
  expect(mobile.height).toBe(54);
});

test("selection popup accepts typing directly, markers only locate and continue buttons reopen discussion", async ({
  page,
}) => {
  const turns = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/turn"))
      turns.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("选段浮窗测试");
  await page.getByLabel("WB 聊天输入").press("Enter");
  const original = page
    .locator(
      ".canvas-message.assistant > .structured-content > .content-block-row > .selectable-block",
    )
    .first();
  await expect(original).toContainText("测试回复：已接收。");
  const zoneA = page.getByRole("complementary", { name: "A 子对话标签" });
  const zoneB = page.getByRole("region", { name: "B 主对话" });
  const zoneC = page.getByRole("complementary", { name: "C 子对话回复" });
  await expect(zoneA).toHaveCount(1);
  await expect(zoneB).toHaveCount(1);
  await expect(zoneC).toHaveCount(1);
  const aBounds = await zoneA.boundingBox(),
    bBounds = await zoneB.boundingBox(),
    cBounds = await zoneC.boundingBox();
  expect(aBounds.x + aBounds.width).toBeLessThanOrEqual(bBounds.x);
  expect(bBounds.x + bBounds.width).toBeLessThanOrEqual(cBounds.x);
  await expect(zoneC).toContainText("回答会集中展示");
  const popup = page.getByRole("dialog", { name: "选段聊天浮窗" });
  const select = async () => {
    await original.scrollIntoViewIfNeeded();
    await original.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await expect(popup.getByLabel("选段追问输入")).toBeVisible();
  };
  await select();
  await expect(page.locator(".canvas-messages textarea")).toHaveCount(0);
  await expect(popup.locator("blockquote")).toHaveCount(0);
  await popup.getByLabel("选段追问输入").click();
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "搜索相关资源", exact: true }).click();
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "提问", exact: true }).click();
  await page.getByRole("heading", { name: "对话与思路" }).click();
  await expect(popup).toBeHidden();
  await select();
  await popup.getByLabel("选段追问输入").fill("请解释这段");
  await expect(popup).toBeVisible();
  await popup.getByLabel("选段追问输入").press("Enter");
  const reply = page.getByRole("region", { name: "选段回复" }).first();
  await expect(reply.locator(".selection-reply.assistant")).toContainText(
    "针对引用内容的回答",
  );
  expect(turns[1].anchor.quote).toBe("测试回复：已接收。");
  const article = page.locator("article.canvas-message.assistant").first();
  const originalDetails = article.locator(".canvas-message-original");
  await expect(originalDetails).toBeVisible();
  expect(await originalDetails.evaluate((element) =>
    !!(element.compareDocumentPosition(element.parentElement.querySelector(".structured-content")) & Node.DOCUMENT_POSITION_FOLLOWING)
  )).toBe(true);
  await originalDetails.locator("summary").click();
  await expect(originalDetails.locator("pre")).toContainText("测试回复：已接收。");
  await originalDetails.locator("summary").click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.__copiedReply = text; },
    } });
  });
  const copy = article.getByRole("button", { name: "复制回复", exact: true });
  await expect(copy.locator("svg")).toHaveCount(1);
  await expect(article.locator(".canvas-message-actions")).toHaveCount(0);
  const copyBounds = await copy.boundingBox();
  const headBounds = await article.locator(".canvas-message-head").boundingBox();
  expect(copyBounds.x + copyBounds.width).toBeCloseTo(headBounds.x + headBounds.width, 0);
  await copy.click();
  await expect(article.getByRole("button", { name: "已复制", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__copiedReply)).toBe(await originalDetails.locator("pre").textContent());
  await reply.getByRole("button", { name: "继续聊" }).click();
  const left = await article.boundingBox(),
    right = await reply.boundingBox();
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  await expect(
    article.locator(".selection-thread, .selection-marker"),
  ).toHaveCount(0);
  const management = await page
    .getByRole("complementary", { name: "资料与管理" })
    .boundingBox();
  expect(left.x).toBeGreaterThanOrEqual(management.x + management.width);
  expect(right.x + right.width).toBeLessThanOrEqual(1440);
  await expect(
    page.locator(".canvas-messages > .canvas-message-shell > .canvas-message"),
  ).toHaveCount(2);
  await popup.getByLabel("关闭选段聊天浮窗").click();
  const marker = page.getByRole("button", { name: /这里有额外提问/ }).first();
  await expect(marker).toBeVisible();
  await expect(zoneA.locator(".selection-marker")).toHaveCount(1);
  await expect(
    zoneB.locator(".selection-thread, .selection-marker"),
  ).toHaveCount(0);
  await expect(zoneC.locator(".selection-thread")).toHaveCount(1);
  const markerBounds = await marker.boundingBox();
  expect(markerBounds.x + markerBounds.width).toBeLessThanOrEqual(left.x);
  await marker.click();
  await expect(popup).toBeHidden();
  await reply.getByRole("button", { name: "继续聊" }).click();
  await popup.getByLabel("选段追问输入").fill("再举一个例子");
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(reply.locator(".selection-reply.assistant")).toHaveCount(2);
  expect(turns[2].anchor.key).toBe(turns[1].anchor.key);
  await page.reload();
  await expect(reply.locator(".selection-reply.assistant")).toHaveCount(2);
  await marker.click();
  await expect(popup).toBeHidden();
  await reply.getByRole("button", { name: "继续聊" }).click();
  await expect(popup.getByLabel("选段追问输入")).toBeVisible();
  await popup
    .getByRole("button", { name: "搜索相关资源", exact: true })
    .click();
  await expect(popup.getByLabel("选段追问输入")).toHaveValue(/请搜索/);
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(
    page.getByRole("region", { name: "选段回复" }).nth(1),
  ).toContainText("参考资料");
  await expect(zoneA.locator(".selection-marker")).toHaveCount(2);
  await expect(zoneC.locator(".selection-thread")).toHaveCount(2);
  await popup.getByLabel("关闭选段聊天浮窗").click();
  await page
    .getByRole("complementary", { name: "资料与管理" })
    .getByRole("button", { name: "资源", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "对话资源" })
      .getByRole("link", { name: "参考资料" }),
  ).toHaveAttribute("href", "https://example.com/selection");
  await marker.click();
  await expect(popup).toBeHidden();
  await reply.getByRole("button", { name: "继续聊" }).click();
  await page.screenshot({ path: "test-results/wb-selection-popup.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await popup.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  const mobileMain = await zoneB.boundingBox();
  const mobileChildren = await zoneC.boundingBox();
  expect(mobileChildren.y).toBeGreaterThanOrEqual(
    mobileMain.y + mobileMain.height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("settings can select Claude Code for new conversations", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByLabel("默认 AI", { exact: true }).selectOption("claude");
  await page.getByRole("button", { name: "保存 AI 设置" }).click();
  await expect(page.locator("#toast")).toContainText("AI 设置已保存");
  await page.reload();
  await expect(page.getByLabel("默认 AI", { exact: true })).toHaveValue("claude");
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("测试 Claude 接入界面");
  await page.getByLabel("WB 聊天输入").press("Enter");
  await expect(page.locator(".wb-floating-dock .composer-agent")).toHaveText("Claude Code");
  await expect(page.locator(".canvas-message.assistant:not(.is-streaming)")).toContainText("测试回复");
  await page.goto("/#/settings");
  await page.getByLabel("默认 AI", { exact: true }).selectOption("codex");
  await page.getByRole("button", { name: "保存 AI 设置" }).click();
  await expect(page.locator("#toast")).toContainText("AI 设置已保存");
});

test("selected text can be saved as a highlight and reopened after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("保存重点测试");
  await page.getByLabel("WB 聊天输入").press("Enter");
  const original = page.locator(".canvas-message.assistant .selectable-block").first();
  await expect(original).toContainText("测试回复：已接收。");
  const quote = await original.innerText();
  await original.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  const popup = page.getByRole("dialog", { name: "选段聊天浮窗" });
  await popup.getByRole("button", { name: "保存信息", exact: true }).click();
  await expect(popup.getByRole("status")).toContainText("已保存到");
  await expect(popup.getByRole("button", { name: "已保存", exact: true })).toBeDisabled();
  await popup.getByLabel("关闭选段聊天浮窗").click();
  const sidebar = page.getByRole("complementary", { name: "资料与管理" });
  await sidebar.getByRole("button", { name: "重点", exact: true }).click();
  const highlights = page.getByRole("region", { name: "保存的重点" });
  await highlights.getByRole("button", { name: quote, exact: true }).click();
  await expect(highlights.getByRole("article", { name: "重点内容" })).toContainText(quote);
  await page.reload();
  await sidebar.getByRole("button", { name: "重点", exact: true }).click();
  await highlights.getByRole("button", { name: quote, exact: true }).click();
  await expect(highlights.locator(".highlight-text")).toHaveText(quote);
  await expect(highlights.getByRole("button")).toHaveCount(1);
});

test("internal sidebar keeps chat visible and collects persisted external resources", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("测试资源收纳");
  await page.getByLabel("WB 聊天输入").press("Enter");
  await expect(page.locator(".canvas-message.assistant")).toContainText(
    "示例文档",
  );
  const sidebar = page.getByRole("complementary", { name: "资料与管理" });
  await expect(sidebar.getByText("工作空间信息")).toBeVisible();
  await expect(page.locator(".conversation-main .module")).toHaveCount(0);
  const bounds = await sidebar.boundingBox();
  const dock = await page
    .getByRole("region", { name: "底部悬浮聊天窗口" })
    .boundingBox();
  expect(dock.x).toBeGreaterThanOrEqual(bounds.x + bounds.width);
  await sidebar.getByRole("button", { name: "资源", exact: true }).click();
  const resources = page.getByRole("region", { name: "对话资源" });
  await expect(resources.locator(".resource-card")).toHaveCount(2);
  await expect(
    resources.getByRole("link", { name: "示例文档" }),
  ).toHaveAttribute("href", "https://example.com/guide");
  await expect(page.getByRole("region", { name: "对话内容区" })).toBeVisible();
  await page.reload();
  await sidebar.getByRole("button", { name: "资源", exact: true }).click();
  await expect(resources.locator(".resource-card")).toHaveCount(2);
  await page.screenshot({ path: "test-results/wb-resources-sidebar.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect
    .poll(async () => {
      const main = await page.locator(".conversation-main").boundingBox();
      const columns = await page.locator(".conversation-columns").boundingBox();
      const mainConversation = await page.locator(".zone-b").boundingBox();
      const composer = await page
        .getByRole("region", { name: "底部悬浮聊天窗口" })
        .boundingBox();
      return (
        main.width > 960 &&
        Math.abs(main.width - columns.width) < 1 &&
        Math.abs(composer.width - 720) < 1 &&
        Math.abs(mainConversation.x + mainConversation.width / 2 - composer.x - composer.width / 2) < 1
      );
    })
    .toBe(true);
  const expandedWidth = (await page.locator(".conversation-main").boundingBox()).width;
  await page.getByLabel("收起资料与管理").click();
  await expect(sidebar).toBeHidden();
  const managementToggle = page.getByRole("button", { name: "资料与管理", exact: true });
  await expect(managementToggle).toHaveAttribute("aria-expanded", "false");
  expect((await managementToggle.boundingBox()).width).toBe(44);
  expect((await page.locator(".conversation-main").boundingBox()).width).toBeGreaterThan(expandedWidth);
  await page.screenshot({ path: "test-results/wb-management-folded.png" });
  await expect.poll(async () => {
    const mainConversation = await page.locator(".zone-b").boundingBox();
    const composer = await page.locator(".wb-floating-dock").boundingBox();
    return Math.abs(mainConversation.x + mainConversation.width / 2 - composer.x - composer.width / 2);
  }).toBeLessThan(1);
  await managementToggle.focus();
  await managementToggle.press("Enter");
  await expect(managementToggle).toHaveAttribute("aria-expanded", "true");
  await expect(resources.locator(".resource-card")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBeLessThanOrEqual(390);
  await page.getByLabel("收起资料与管理").click();
  await expect(page.getByLabel("WB 聊天输入")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("reply UI streams before completion; composer floats on desktop and mobile without hiding page end", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("WB 聊天输入").fill("测试流式结构");
  await page.getByLabel("发送 WB 消息").click();
  await expect(
    page.getByRole("heading", { name: "流式方案", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("停止执行")).toBeVisible();
  await expect(page.locator(".is-streaming .content-list li")).toHaveCount(2);
  await expect(page.locator(".content-table tbody")).toContainText("MVP");
  await expect(page.getByLabel("停止执行")).toBeVisible();
  await expect(page.locator(".content-code pre")).toContainText(
    "const result =",
  );
  await expect(page.getByLabel("停止执行")).toHaveCount(0);
  await expect(page.locator(".canvas-message.assistant")).toHaveCount(1);
  await expect(
    page.locator(".canvas-message.assistant .structured-content"),
  ).toContainText("<script>window.__unsafe = true</script>");
  expect(await page.evaluate(() => window.__unsafe)).toBeUndefined();
  const dock = page.getByRole("region", { name: "底部悬浮聊天窗口" });
  await expect(dock.locator(".chat-msg")).toHaveCount(0);
  expect(await dock.evaluate((e) => getComputedStyle(e).position)).toBe(
    "fixed",
  );
  const before = await dock.boundingBox();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  expect(Math.abs((await dock.boundingBox()).y - before.y)).toBeLessThan(2);
  await page.getByRole("button", { name: "添加内容模块", exact: true }).click();
  await page.getByLabel("关闭弹窗").click();
  await page.getByRole("button", { name: "原始记录", exact: true }).click();
  await expect(page.getByLabel("WB 聊天输入")).toBeVisible();
  await expect(page.getByRole("region", { name: "对话内容区" })).toBeVisible();
  await page.getByRole("button", { name: "最新回复" }).click();
  await expect(page.getByRole("region", { name: "对话内容区" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("收起资料与管理").click();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const mobile = await dock.boundingBox();
  expect(mobile.x).toBeGreaterThanOrEqual(0);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);
  expect(mobile.y + mobile.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/wb-canvas-mobile.png",
    fullPage: false,
  });
});

test("WB home chat is the entry; explicit project creation opens the target development window", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天，想从什么开始？" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-grid")).toHaveCount(0);
  await expect(page.locator(".hub-chat .chat-msg")).toHaveCount(0);
  await page.screenshot({ path: "test-results/wb-entry.png", fullPage: true });
  await expect(page.locator(".shell > .sidebar")).toBeHidden();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeVisible();
  await page.getByLabel("WB 聊天输入").fill("你好");
  const input = page.getByLabel("WB 聊天输入");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("你好\n");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(page).not.toHaveURL(/#\/page\/question_/);
  await input.dispatchEvent("compositionend");
  await input.fill("你好");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await expect(input).toHaveValue("你好");
  await input.dispatchEvent("keydown", { key: "Enter", keyCode: 229 });
  await expect(input).toHaveValue("你好");
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/page\/question_/);
  await expect(page.locator(".shell > .sidebar")).toBeHidden();
  await expect(page.locator(".hub-chat .chat-msg").last()).toContainText(
    "测试回复：已接收。",
  );
  await page.reload();
  await expect(page.locator(".hub-chat .chat-msg").last()).toContainText(
    "测试回复：已接收。",
  );
  const wbUrl = page.url();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".hub-chat .chat-msg")).toHaveCount(0);
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page
    .getByRole("region", { name: "历史对话", exact: true })
    .getByRole("link", { name: "你好", exact: true })
    .click();
  await expect(page).toHaveURL(wbUrl);
  await expect(page.locator(".hub-chat .chat-msg").first()).toContainText(
    "你好",
  );
  await page.screenshot({ path: "test-results/wb-home.png", fullPage: true });
  await page.getByLabel("搜索所有内容").click();
  await page.getByLabel("搜索关键词").fill("你好");
  await page
    .locator(".search-result")
    .filter({ hasText: "完整对话" })
    .first()
    .click();
  await expect(page.locator("dialog .raw-text")).toContainText("你好");
  await page.locator("dialog").getByLabel("关闭").click();
  await page.getByLabel("WB 聊天输入").fill("测试启动项目");
  await page.getByLabel("WB 聊天输入").press("Enter");
  await expect(page).toHaveURL(/#\/develop\/project_/);
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("heading", { name: "从第一条开发指令开始" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("development tabs switch only the left panel and preserve drafts and preview", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const tabs = page.getByRole("tablist", { name: "开发辅助面板" });
  await expect(tabs.getByRole("tab", { name: "AI 汇报" })).toHaveAttribute("aria-selected", "true");
  const preview = page.frameLocator("iframe");
  const checkFloatingLayout = async () => {
    await expect(page.locator(".dev-dock")).toHaveCSS("position", "fixed");
    await expect.poll(async () => {
      const surface = await page.locator(".dev-surface").boundingBox();
      const dock = await page.locator(".dev-dock").boundingBox();
      return Math.abs(surface.x + surface.width / 2 - dock.x - dock.width / 2) < 1 && Math.abs(surface.y + surface.height - page.viewportSize().height) < 1 && dock.y > surface.y && dock.y + dock.height < surface.y + surface.height;
    }).toBe(true);
  };
  await checkFloatingLayout();
  await page.getByLabel("打开侧边栏", { exact: true }).click();
  await checkFloatingLayout();
  await page.locator(".development-layout > .sidebar").getByLabel("收起侧边栏", { exact: true }).click();
  await expect(preview.getByRole("heading", { name: "每一笔，都好好记录。" })).toBeVisible();
  await page.locator("iframe").evaluate((frame) => { frame.dataset.testIdentity = "retained"; });
  await tabs.getByRole("tab", { name: "Todo", exact: true }).click();
  await page.getByRole("tabpanel", { name: "Todo", exact: true }).getByLabel("新增 Todo").fill("尚未提交的任务");
  await tabs.getByRole("tab", { name: "文件目录", exact: true }).click();
  const files = page.getByRole("tabpanel", { name: "文件目录", exact: true });
  await files.locator("summary").filter({ hasText: /^src$/ }).click();
  await expect(files.getByText("App.jsx", { exact: true })).toBeVisible();
  await tabs.getByRole("tab", { name: "Todo", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Todo", exact: true }).getByLabel("新增 Todo")).toHaveValue("尚未提交的任务");
  await tabs.getByRole("tab", { name: "Todo", exact: true }).press("ArrowRight");
  await expect(files.getByText("App.jsx", { exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute("data-test-identity", "retained");
  await expect(preview.getByRole("heading", { name: "每一笔，都好好记录。" })).toBeVisible();
  await page.locator(".dev-dock").getByRole("button", { name: "最新回复" }).click();
  await expect(tabs.getByRole("tab", { name: "AI 汇报" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("折叠项目侧边栏").click();
  await checkFloatingLayout();
  await page.setViewportSize({ width: 390, height: 844 });
  await checkFloatingLayout();
});

test("version tab restores WB materials after confirmation without replacing preview", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const tabs = page.getByRole("tablist", { name: "开发辅助面板" });
  await tabs.getByRole("tab", { name: "Todo", exact: true }).click();
  const todo = page.getByRole("tabpanel", { name: "Todo", exact: true });
  await todo.getByLabel("新增 Todo").fill("用于验证恢复的任务");
  await todo.getByRole("button", { name: "添加", exact: true }).click();
  await expect(todo.getByRole("checkbox", { name: "用于验证恢复的任务" })).toBeVisible();
  await page.getByRole("button", { name: "开发工具菜单" }).click();
  await page.getByRole("menuitem", { name: "版本控制", exact: true }).click();
  const versions = page.getByRole("tabpanel", { name: "版本控制" });
  await expect(versions).toContainText("这不是 Git 代码版本控制");
  await expect(versions.locator(".project-version-card").first().getByRole("button")).toBeDisabled();
  await versions.getByRole("button", { name: "恢复此版本" }).last().click();
  await expect(page.getByRole("dialog")).toContainText("代码文件与原始聊天记录不受影响");
  await page.getByRole("dialog").getByRole("button", { name: "确认恢复资料" }).click();
  await expect(versions.locator(".project-version-card").first()).toContainText("恢复到版本");
  await tabs.getByRole("tab", { name: "Todo", exact: true }).click();
  await expect(todo.getByRole("checkbox", { name: "用于验证恢复的任务" })).toHaveCount(0);
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "每一笔，都好好记录。" })).toBeVisible();
});

test("development tools dropdown opens panels and saves project URLs", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const trigger = page.getByRole("button", { name: "开发工具菜单" });
  await trigger.click();
  await expect(page.getByRole("menu", { name: "开发工具" })).toBeVisible();
  await page.getByRole("menuitem", { name: "数据库", exact: true }).click();
  await expect(page.getByRole("region", { name: "数据库", exact: true })).toContainText("目标项目数据库尚未接入管理");
  await trigger.click();
  await page.getByRole("menuitem", { name: "运行与部署", exact: true }).click();
  await expect(page.getByRole("region", { name: "运行与部署", exact: true })).toContainText("本地预览");
  await trigger.click();
  await page.getByRole("menuitem", { name: "URL 链接", exact: true }).click();
  const urls = page.getByRole("region", { name: "URL 链接", exact: true });
  await expect(urls.getByRole("link", { name: /打开项目预览/ })).toHaveAttribute("href", /\/app\/project_/);
  await urls.getByRole("button", { name: "添加链接" }).click();
  await page.getByLabel("链接名称", { exact: true }).fill("接口文档测试");
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/api");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(urls.getByRole("link", { name: /接口文档测试/ })).toHaveAttribute("href", "https://example.com/api");
  await page.reload();
  await trigger.click();
  await page.getByRole("menuitem", { name: "URL 链接", exact: true }).click();
  await expect(urls.getByRole("link", { name: /接口文档测试/ })).toBeVisible();
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "版本控制", exact: true })).toBeFocused();
  await page.getByRole("menuitem", { name: "版本控制", exact: true }).press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("tab", { name: "AI 汇报", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("project sidebar Todo persists and is shared with project management", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  await expect(page).toHaveURL(/#\/develop/);
  const projectId = page.url().split("/develop/")[1];
  const navigation = page.getByRole("navigation", { name: "项目管理栏目" });
  await navigation.getByRole("button", { name: /^Todo/ }).click();
  const panel = page.getByRole("region", { name: "项目 Todo 管理" });
  await panel.getByLabel("新增 Todo").fill("验证登录功能");
  await panel.getByRole("button", { name: "添加", exact: true }).click();
  await expect(panel.getByRole("checkbox", { name: "验证登录功能" })).toBeVisible();
  await panel.getByRole("checkbox", { name: "验证登录功能" }).click();
  await expect(panel.getByRole("checkbox", { name: "验证登录功能" })).toBeChecked();
  await page.goto(`/#/page/${projectId}/todo`);
  await expect(panel.getByRole("checkbox", { name: "验证登录功能" })).toBeChecked();
  await panel.getByRole("button", { name: "编辑任务：验证登录功能" }).click();
  await page.getByLabel("任务内容").fill("验证登录与退出");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(panel.getByRole("checkbox", { name: "验证登录与退出" })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("checkbox", { name: "验证登录与退出" })).toBeChecked();
  await page.getByLabel("折叠项目侧边栏").click();
  await expect(navigation).toHaveCount(0);
  await page.getByLabel("打开侧边栏", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "工作空间导航" })).toBeVisible();
  await page.getByLabel("展开项目侧边栏").click();
  await expect(navigation).toBeVisible();
  await panel.getByRole("button", { name: "删除任务：验证登录与退出" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();
  await expect(panel.getByRole("checkbox", { name: "验证登录与退出" })).toHaveCount(0);
});

test("local region hierarchy navigates nested elements and sends the updated target", async ({ page }) => {
  const turns = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/agent/turn")) turns.push(request.postDataJSON()); });
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const frame = page.frameLocator("iframe");
  await frame.locator("body").evaluate((body) => {
    const outer = document.createElement("div"); outer.id = "hierarchy-outer";
    outer.style.cssText = "position:fixed;left:20px;top:20px;width:220px;background:white;padding:20px;z-index:9999";
    const inner = document.createElement("div"); inner.id = "hierarchy-inner";
    const leaf = document.createElement("span"); leaf.id = "hierarchy-leaf"; leaf.textContent = "层级测试区域";
    inner.append(leaf); outer.append(inner); body.append(outer);
  });
  await frame.locator("#hierarchy-leaf").dblclick();
  const popup = page.getByLabel("局部 AI 聊天窗口");
  const path = popup.getByRole("navigation", { name: "选中区域层级" });
  await expect(path.locator('[aria-current="location"]')).toHaveText("div#hierarchy-inner");
  await popup.getByLabel("局部开发指令").fill("保留这条未发送指令");
  await popup.getByRole("button", { name: "选父级 ↑", exact: true }).click();
  await expect(path.locator('[aria-current="location"]')).toHaveText("div#hierarchy-outer");
  await expect(popup.getByLabel("局部开发指令")).toHaveValue("保留这条未发送指令");
  await popup.getByRole("button", { name: /选子级/ }).click();
  await popup.getByRole("group", { name: "可选子元素" }).getByRole("button", { name: /div#hierarchy-inner/ }).click();
  await expect(path.locator('[aria-current="location"]')).toHaveText("div#hierarchy-inner");
  await popup.getByRole("button", { name: /选子级/ }).click();
  await popup.getByRole("group", { name: "可选子元素" }).getByRole("button", { name: /span#hierarchy-leaf/ }).click();
  await expect(path.locator('[aria-current="location"]')).toHaveText("span#hierarchy-leaf");
  await expect(popup.getByRole("button", { name: /选子级/ })).toBeDisabled();
  await popup.getByLabel("局部开发指令").press("Enter");
  await expect.poll(() => turns.length).toBe(1);
  expect(turns[0].anchor.selector).toBe("#hierarchy-leaf");
  expect(turns[0].anchor.html).toMatch(/^<span/);
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText("测试回复");
  await path.getByRole("button", { name: "div#hierarchy-outer", exact: true }).click();
  await expect(path.locator('[aria-current="location"]')).toHaveText("div#hierarchy-outer");
  await path.getByRole("button", { name: "body", exact: true }).click();
  await expect(popup.getByRole("button", { name: "选父级 ↑", exact: true })).toBeDisabled();
});

test("design suggestions preview cards and fill scoped instructions without automatically sending", async ({ page }) => {
  const turns = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/agent/turn")) turns.push(request.postDataJSON()); });
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  await page.frameLocator("iframe").getByRole("heading", { name: "每一笔，都好好记录。" }).dblclick();
  const popup = page.getByLabel("局部 AI 聊天窗口");
  const input = popup.getByLabel("局部开发指令");
  await input.fill("保留我的要求");
  await popup.getByRole("button", { name: "配色卡", exact: true }).click();
  await popup.getByRole("button", { name: /清爽蓝/ }).click();
  await expect(popup.locator(".design-color-values")).toContainText("#1D4ED8");
  await popup.getByRole("button", { name: "将「清爽蓝」填入指令" }).click();
  await expect(input).toHaveValue(/保留我的要求[\s\S]*#1D4ED8/);
  expect(turns).toHaveLength(0);
  await popup.getByRole("button", { name: "UI 组件", exact: true }).click();
  await popup.getByRole("button", { name: /信息卡片/ }).click();
  await popup.getByRole("button", { name: "将「信息卡片」填入指令" }).click();
  await expect(input).toHaveValue(/响应式信息卡片/);
  expect(turns).toHaveLength(0);
  await input.fill("");
  await popup.getByRole("button", { name: "AI 建议", exact: true }).click();
  await popup.getByRole("button", { name: "怎么改更好", exact: true }).click();
  await expect(input).toHaveValue(/只提供建议，不修改文件/);
  expect(turns).toHaveLength(0);
  await input.press("Enter");
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText("测试回复");
  expect(turns).toHaveLength(1);
  expect(turns[0].anchor.kind).toBe("project-element");
  await expect(popup.locator(".chat-msg")).toHaveCount(0);
});

test("double click selects the containing div and keeps a visible region highlight", async ({ page }) => {
  const turns = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/agent/turn")) turns.push(request.postDataJSON()); });
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const frame = page.frameLocator("iframe");
  const heading = frame.getByRole("heading", { name: "每一笔，都好好记录。" });
  await heading.dblclick();
  await expect(page.getByLabel("局部 AI 聊天窗口")).toBeVisible();
  await expect(frame.locator("[data-wb-overlay]")).toBeVisible();
  const selectedBounds = await heading.evaluate((el) => { const r = el.closest("div").getBoundingClientRect(); return { width: r.width, height: r.height }; });
  const highlightBounds = await frame.locator("[data-wb-overlay]").boundingBox();
  expect(Math.abs(highlightBounds.width - selectedBounds.width)).toBeLessThan(1);
  expect(Math.abs(highlightBounds.height - selectedBounds.height)).toBeLessThan(1);
  await page.getByLabel("局部开发指令").fill("把这个 div 的间距缩小");
  await page.getByLabel("局部开发指令").press("Enter");
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText("测试回复");
  await expect(page.locator(".local-chat .chat-msg")).toHaveCount(0);
  expect(turns.at(-1).anchor.kind).toBe("project-element");
  expect(turns.at(-1).anchor.html).toMatch(/^<div/);
  await expect(frame.locator("[data-wb-overlay]")).toBeVisible();
  await page.getByLabel("关闭局部聊天").click();
  await expect(frame.locator("[data-wb-overlay]")).toBeHidden();
  await frame.getByRole("button", { name: "＋ 记一笔" }).click();
  await frame.getByLabel("用途").fill("双击保留编辑");
  await frame.getByLabel("用途").dblclick();
  await expect(page.getByLabel("局部 AI 聊天窗口")).toHaveCount(0);
});

test("preview text selection opens a local instruction chat with source context", async ({ page }) => {
  const turns = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/agent/turn")) turns.push(request.postDataJSON()); });
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  const frame = page.frameLocator("iframe");
  const heading = frame.getByRole("heading", { name: "每一笔，都好好记录。" });
  await expect(heading).toBeVisible();
  const selectText = async () => {
    await heading.evaluate((element) => {
      const range = document.createRange(); range.selectNodeContents(element);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await expect(page.getByLabel("局部 AI 聊天窗口")).toBeVisible();
  };
  await selectText();
  await page.getByLabel("局部开发指令").fill("把选中的标题改成简短的欢迎语");
  await page.getByLabel("局部开发指令").press("Enter");
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText("测试回复");
  await expect(page.locator(".local-chat .chat-msg")).toHaveCount(0);
  expect(turns.at(-1).anchor.kind).toBe("project-text");
  expect(turns.at(-1).anchor.quote).toBe("每一笔，都好好记录。");
  expect(turns.at(-1).anchor.sourceFile).toBeTruthy();
  expect(turns.at(-1).anchor.selector).toBeTruthy();
  const key = turns.at(-1).anchor.key;
  await page.getByRole("tab", { name: "AI 汇报", exact: true }).click();
  await expect(page.getByLabel("局部 AI 聊天窗口")).toHaveCount(0);
  await selectText();
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText("测试回复");
  await page.getByLabel("局部开发指令").fill("再改一次");
  await page.getByLabel("局部开发指令").press("Enter");
  await expect.poll(() => turns.length).toBe(2);
  expect(turns[1].anchor.key).toBe(key);
  await page.getByLabel("局部开发指令").press("Escape");
  await expect(page.getByLabel("局部 AI 聊天窗口")).toHaveCount(0);
  await frame.getByRole("button", { name: "＋ 记一笔" }).click();
  await frame.getByLabel("用途").fill("输入内容不触发选择");
  await frame.getByLabel("用途").press("ControlOrMeta+A");
  await expect(page.getByLabel("局部 AI 聊天窗口")).toHaveCount(0);
});

test("real React target app, scoped popup chat, separate histories and WB records", async ({
  page,
}) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  await expect(page).toHaveURL(/#\/develop/);
  const frame = page.frameLocator("iframe");
  const fileTree = page.getByRole("region", { name: "项目文件目录" });
  await expect(fileTree.getByText("package.json", { exact: true })).toBeVisible();
  await expect(fileTree.getByText("App.jsx", { exact: true })).toBeHidden();
  await fileTree.locator("summary").filter({ hasText: /^src$/ }).click();
  await expect(fileTree.getByText("App.jsx", { exact: true })).toBeVisible();
  await fileTree.locator("summary").filter({ hasText: /^src$/ }).click();
  await expect(fileTree.getByText("App.jsx", { exact: true })).toBeHidden();
  await expect(
    frame.getByRole("heading", { name: "每一笔，都好好记录。" }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "＋ 记一笔" }).click();
  await frame.getByLabel("用途").fill("测试午餐");
  await frame.getByLabel("金额").fill("32");
  await frame.getByRole("button", { name: "保存记录" }).click();
  await expect(frame.getByText("测试午餐", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "点选局部" }).click();
  await frame
    .locator('[data-ai-id="expense-card"]')
    .click({ position: { x: 20, y: 20 } });
  await expect(page.getByLabel("局部 AI 聊天窗口")).toBeVisible();
  await page.getByLabel("局部开发指令").fill("请调整这个卡片");
  await page.getByLabel("局部开发指令").press("Enter");
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText(
    "测试回复",
  );
  await expect(page.locator(".dev-dock .chat-msg")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/wb-local-chat.png",
    fullPage: true,
  });
  await page.getByLabel("关闭局部聊天").click();
  await page.getByLabel("全局开发指令").fill("请查看整个项目");
  await page.getByLabel("全局开发指令").press("Enter");
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText(
    "测试回复",
  );
  await page.reload();
  await expect(page.locator(".development-reports .chat-msg").last()).toContainText(
    "测试回复",
  );
  await page.getByRole("button", { name: "WB 管理" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeHidden();
  await expect(page.getByRole("region", { name: "之前的开发对话" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加内容模块", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "同步记录", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "原始记录", exact: true }).click();
  await expect(page.getByText("2 条消息", { exact: false })).toHaveCount(2);
});

test("sidebar opens a selected local project and reuses its existing workspace", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
  const destination = page.url();
  const projectId = destination.split("/develop/")[1];
  const rootPath = await page.evaluate(async (id) => {
    const response = await fetch(`/api/pages/${id}`, { headers: { "X-WB-Token": document.querySelector('meta[name="wb-token"]').content } });
    return (await response.json()).page.rootPath;
  }, projectId);
  await page.route("**/api/local-projects/choose", (route) => route.fulfill({ json: { path: rootPath } }));
  await page.getByRole("button", { name: "打开侧边栏", exact: true }).click();
  await page.getByRole("button", { name: "打开本地 Web 项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "打开本地 Web 项目" });
  await expect(dialog.getByRole("button", { name: "打开并继续开发" })).toBeDisabled();
  await dialog.getByRole("button", { name: "选择文件夹" }).click();
  await expect(dialog.getByLabel("本地项目路径")).toHaveValue(rootPath);
  await dialog.getByRole("button", { name: "打开并继续开发" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(destination);
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
});

test("project creation can skip planning and open development directly", async ({ page }) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: /让一个想法落地/ }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("直接开发测试");
  await page.getByLabel("启动方式").selectOption("develop");
  await page.getByRole("button", { name: "创建项目并继续" }).click();
  await expect(page).toHaveURL(/\/develop\/project_/);
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
  await page.getByRole("button", { name: "项目规划", exact: true }).click();
  await expect(page.getByRole("heading", { name: "项目规划", exact: true })).toBeVisible();
});

test("question editing, standalone export, promotion, settings and mobile layout", async ({
  page,
}) => {
  await page.goto("/#/questions");
  await page.getByRole("button", { name: /从一个问题开始/ }).click();
  await page.getByLabel("问题 / 主题").fill("产品调研");
  await page.getByLabel("回答内容").fill("这是需要保存的资料。");
  await page.getByRole("button", { name: "创建问答页面" }).click();
  await expect(page.locator(".topbar .crumb strong")).toHaveText("产品调研");
  await page.getByLabel("编辑回答").click();
  await page.getByLabel("内容", { exact: true }).fill("用户亲自修改的结论。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText("用户亲自修改的结论。", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.html$/);
  await page.getByRole("button", { name: "启动项目", exact: true }).click();
  await page.getByLabel("启动方式").selectOption("plan");
  await page.getByRole("button", { name: "创建项目并继续" }).click();
  await expect(page).toHaveURL(/\/page\/project_.*\/overview/);
  await expect(page.getByRole("heading", { name: "项目规划", exact: true })).toBeVisible();
  await expect(page.getByText("用户亲自修改的结论。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑规划" }).click();
  await page.getByLabel("第一版范围", { exact: true }).fill("只实现记录与查询，暂不做支付");
  await page.getByRole("checkbox", { name: /优先使用 React/ }).check();
  await page.getByLabel("参考项目", { exact: true }).fill("示例 / https://example.com / 借鉴导航结构，不复制素材");
  await page.getByRole("button", { name: "保存规划" }).click();
  await expect(page.getByRole("button", { name: "编辑规划" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("项目规划设置")).toContainText("只实现记录与查询");
  await expect(page.getByLabel("项目规划设置")).toContainText("优先使用 React");
  await expect(page.getByLabel("项目规划设置")).toContainText("https://example.com");
  await page.getByRole("button", { name: "进入开发窗口", exact: true }).click();
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
  await page.getByLabel("返回 WB").click();
  await page.getByRole("button", { name: "同步设置", exact: true }).click();
  await expect(
    page.getByText("自动同步", { exact: false }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("WB 聊天输入")).toBeVisible();
  await page.getByLabel("WB 聊天输入").fill("规划流程的独立历史记录");
  await page.getByLabel("WB 聊天输入").press("Enter");
  await expect(page.locator(".canvas-message.assistant")).toHaveCount(1);
  await page.goto("/");
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "历史对话" })
    .getByRole("link", { name: "规划流程的独立历史记录", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".canvas-message.user").first()).toContainText(
    "规划流程的独立历史记录",
  );
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/wb-mobile.png", fullPage: true });
});

test("tasks have their own WB and sidebar entry; opening Entry does not create empty histories", async ({
  page,
}) => {
  await page.goto("/");
  const total = () =>
    page.evaluate(async () => {
      const token = document.querySelector('meta[name="wb-token"]').content;
      return (
        await (
          await fetch("/api/state", { headers: { "X-WB-Token": token } })
        ).json()
      ).conversations.length;
    });
  const before = await total();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await page.reload();
  expect(await total()).toBe(before);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await page.getByLabel("WB 聊天输入").fill("整理一份咖啡店调研任务");
  await page.getByLabel("发送 WB 消息").click();
  await expect(page).toHaveURL(/#\/page\/question_/);
  await expect(page.locator(".hub-chat .chat-msg").last()).toContainText(
    "测试回复",
  );
  await expect(
    page.getByRole("heading", { name: "任务清单", exact: true }),
  ).toBeVisible();
  const destination = page.url();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page
    .getByRole("region", { name: "任务列表" })
    .getByRole("link", { name: "整理一份咖啡店调研任务", exact: true })
    .click();
  await expect(page).toHaveURL(destination);
  await expect(page.locator(".hub-chat .chat-msg").first()).toContainText(
    "整理一份咖啡店调研任务",
  );
  await page.getByLabel("WB 聊天输入").fill("继续这个任务，补充评价标准");
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await page.getByLabel("发送 WB 消息").click();
  await expect(page.locator(".hub-chat .chat-msg")).toHaveCount(4);
  await page.screenshot({ path: "test-results/wb-task.png", fullPage: true });
  await expect(page.locator(".shell > .sidebar")).toBeVisible();
  await page.getByRole("button", { name: "收起侧边栏" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeHidden();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeVisible();
});
