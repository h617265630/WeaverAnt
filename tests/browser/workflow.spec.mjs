import { test, expect } from "@playwright/test";

test("selection popup accepts typing directly, replies appear on the right and markers reopen saved discussion", async ({
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
  await popup.getByLabel("选段追问输入").fill("请解释这段");
  await expect(popup).toBeVisible();
  await popup.getByLabel("选段追问输入").press("Enter");
  const reply = page.getByRole("region", { name: "选段回复" }).first();
  await expect(reply.locator(".selection-reply.assistant")).toContainText(
    "针对引用内容的回答",
  );
  expect(turns[1].anchor.quote).toBe("测试回复：已接收。");
  const left = await original.boundingBox(),
    right = await reply.boundingBox();
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  await expect(page.locator(".canvas-messages > .canvas-message")).toHaveCount(
    2,
  );
  await popup.getByLabel("关闭选段聊天浮窗").click();
  const marker = page.getByRole("button", { name: /这里有额外提问/ }).first();
  await expect(marker).toBeVisible();
  expect((await marker.boundingBox()).x).toBeLessThan(left.x);
  await marker.click();
  await popup.getByLabel("选段追问输入").fill("再举一个例子");
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(reply.locator(".selection-reply.assistant")).toHaveCount(2);
  expect(turns[2].anchor.key).toBe(turns[1].anchor.key);
  await page.reload();
  await expect(reply.locator(".selection-reply.assistant")).toHaveCount(2);
  await marker.click();
  await expect(popup.getByLabel("选段追问输入")).toBeVisible();
  await popup
    .getByRole("button", { name: "搜索相关资源", exact: true })
    .click();
  await expect(popup.getByLabel("选段追问输入")).toHaveValue(/请搜索/);
  await popup.getByLabel("选段追问输入").press("Enter");
  await expect(
    page.getByRole("region", { name: "选段回复" }).nth(1),
  ).toContainText("参考资料");
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
  await page.screenshot({ path: "test-results/wb-selection-popup.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await popup.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
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
  expect(dock.x + dock.width).toBeLessThanOrEqual(bounds.x);
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
  await page.getByLabel("收起资料与管理").click();
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "资料与管理", exact: true }).click();
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
  await expect(page.locator(".hub-chat .chat-msg").last()).toContainText(
    "测试回复：已接收。",
  );
  await page.reload();
  await expect(page.locator(".hub-chat .chat-msg").last()).toContainText(
    "测试回复：已接收。",
  );
  const wbUrl = page.url();
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".hub-chat .chat-msg")).toHaveCount(0);
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

test("real React target app, scoped popup chat, separate histories and WB records", async ({
  page,
}) => {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "体验记账 App 示例" }).last().click();
  await expect(page).toHaveURL(/#\/develop/);
  const frame = page.frameLocator("iframe");
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
  await expect(page.locator(".local-chat .chat-msg").last()).toContainText(
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
  await expect(page.locator(".dev-dock .chat-msg").last()).toContainText(
    "测试回复",
  );
  await page.reload();
  await expect(page.locator(".dev-dock .chat-msg").last()).toContainText(
    "测试回复",
  );
  await page.getByRole("button", { name: "WB 管理" }).click();
  await expect(
    page.getByRole("region", { name: "之前的开发对话" }),
  ).toContainText("请调整这个卡片");
  await page.getByRole("button", { name: "原始记录", exact: true }).click();
  await expect(page.getByText("2 条消息", { exact: false })).toHaveCount(2);
});

test("question editing, standalone export, promotion, settings and mobile layout", async ({
  page,
}) => {
  await page.goto("/#/questions");
  await page.getByRole("button", { name: /从一个问题开始/ }).click();
  await page.getByLabel("问题 / 主题").fill("产品调研");
  await page.getByLabel("回答内容").fill("这是需要保存的资料。");
  await page.getByRole("button", { name: "创建问答页面" }).click();
  await expect(
    page.getByRole("heading", { name: "产品调研", exact: true }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "启动项目，打开开发窗口" }).click();
  await expect(page.getByLabel("全局开发指令")).toBeVisible();
  await page.getByLabel("返回 WB").click();
  await page.getByRole("button", { name: "同步设置", exact: true }).click();
  await expect(
    page.getByText("自动同步", { exact: false }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("WB 聊天输入")).toBeVisible();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "历史对话" })
    .getByRole("link", { name: "你好", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".hub-chat .chat-msg").first()).toContainText(
    "你好",
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
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await page
    .getByRole("region", { name: "任务列表" })
    .getByRole("link", { name: "整理一份咖啡店调研任务", exact: true })
    .click();
  await expect(page).toHaveURL(destination);
  await expect(page.locator(".hub-chat .chat-msg").first()).toContainText(
    "整理一份咖啡店调研任务",
  );
  await page.getByLabel("WB 聊天输入").fill("继续这个任务，补充评价标准");
  await page.getByLabel("发送 WB 消息").click();
  await expect(page.locator(".hub-chat .chat-msg")).toHaveCount(4);
  await page.screenshot({ path: "test-results/wb-task.png", fullPage: true });
  await page.getByRole("button", { name: "收起侧边栏" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeHidden();
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  await expect(page.locator(".shell > .sidebar")).toBeVisible();
});
