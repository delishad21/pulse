import { expect, test, type Page } from "@playwright/test";

async function addTask(page: Page, text: string) {
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Smart task").fill(text);
  await dialog.getByRole("button", { name: "Submit task" }).click();
  await expect(dialog).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("e2e-user");
  await page.getByLabel("Password").fill("pulse-e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
});

test("authenticated session can sign out and protected pages redirect to login", async ({ page }) => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("sidebar task creation, natural scheduling, and date grouping replace inline quick add", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByText("Search anything")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Search", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Completed", exact: true })).toHaveCount(0);

  await addTask(page, "Grouped E2E tomorrow at 3:30pm ^urgent");
  await addTask(page, "No date E2E task");

  await expect(page.getByRole("heading", { name: "Tomorrow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No date" })).toBeVisible();
  const timedRow = page.locator("[data-task-id]", { hasText: "Grouped E2E" });
  await expect(timedRow).toContainText("urgent");
  await expect(timedRow).toContainText(/3:30|15:30/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("heading", { name: "Tomorrow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No date" })).toBeVisible();

  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("q");
  await expect(page.getByRole("dialog", { name: "Add task" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add task" })).toHaveCount(0);

  const searchResponse = await page.goto("/search");
  expect(searchResponse?.status()).toBe(404);
  const completedResponse = await page.goto("/completed");
  expect(completedResponse?.status()).toBe(404);
});

test("project defaults, @label/^priority detection, schedule windows, reminders, and bulk operations work", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add label" }).click();
  const labelDialog = page.getByRole("dialog", { name: "Add label" });
  await labelDialog.getByLabel("Label name").fill("E2ELabel");
  await labelDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("E2ELabel", { exact: true })).toBeVisible();

  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill("E2EProject");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("link", { name: "E2EProject" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByText("Sections", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await expect(dialog.getByRole("button", { name: "E2EProject" })).toBeVisible();
  const smart = dialog.getByLabel("Smart task");
  await smart.fill("Project task @E2ELabel ^high 2099-01-05 2pm-4pm");
  await expect(dialog.locator("mark", { hasText: "@E2ELabel" })).toBeVisible();
  await expect(dialog.locator("mark", { hasText: "^high" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "High" })).toBeVisible();
  await dialog.getByRole("button", { name: "Reminders" }).click();
  await dialog.getByRole("button", { name: "Add reminder" }).click();
  await dialog.getByLabel("Reminder 1", { exact: true }).fill("2099-01-05T13:30");
  await dialog.getByRole("button", { name: "Submit task" }).click();

  const row = page.locator("[data-task-id]", { hasText: "Project task" });
  await expect(row).toContainText("high"); await expect(row).toContainText("@E2ELabel"); await expect(row).toContainText(/2:00|14:00/);
  await row.getByRole("checkbox", { name: "Select Project task" }).check();
  await page.getByLabel("Move selected tasks to project").selectOption("");
  await page.getByRole("button", { name: "Move", exact: true }).click(); await expect(row).toHaveCount(0);

  await page.goto("/inbox");
  const inboxRow = page.locator("[data-task-id]", { hasText: "Project task" });
  await inboxRow.getByRole("checkbox", { name: "Select Project task" }).check();
  await page.getByLabel("Reschedule selected tasks").fill("2099-02-10");
  await page.getByRole("button", { name: "Reschedule" }).click(); await expect(inboxRow).toContainText("Feb");
});

test("undo/redo and task-detail editing remain intact", async ({ page }) => {
  await page.goto("/inbox");
  await addTask(page, "Undoable E2E task every Thursday");
  let row = page.locator("[data-task-id]", { hasText: "Undoable E2E task" });
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  row = page.locator("[data-task-id]", { hasText: "Undoable E2E task" });
  await expect(row).toBeVisible();

  await row.getByRole("link", { name: /Undoable E2E task/ }).click();
  await expect(page.getByText("Recurring", { exact: true })).toBeVisible();
  await page.getByLabel("Add a comment").fill("E2E note");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("E2E note")).toBeVisible();

  await page.goto("/inbox");
  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await expect(page).toHaveURL(/\/today$/);
});

test("upcoming week is Monday-first and month cards open an editable task modal", async ({ page }) => {
  await page.goto("/inbox");
  await addTask(page, "Calendar E2E today at 3:30pm");
  await page.goto("/upcoming");

  const weekHeaders = page.getByTestId("week-day-header");
  await expect(weekHeaders).toHaveCount(7);
  const labels = await weekHeaders.evaluateAll((nodes) => nodes.map((node) => node.querySelector("p")?.textContent));
  expect(labels).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const weekTask = page.getByTestId("week-task").filter({ hasText: "Calendar E2E" });
  await expect(weekTask).toBeVisible();
  await expect(weekTask.locator("xpath=..").getByRole("checkbox", { name: "Complete Calendar E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Month" }).click();
  const monthTask = page.getByTestId("month-task").filter({ hasText: "Calendar E2E" });
  await expect(monthTask).toBeVisible();
  await monthTask.click();
  const taskDialog = page.getByRole("dialog", { name: "Task details" });
  await expect(taskDialog).toBeVisible();
  await taskDialog.getByRole("button", { name: "Modify task" }).click();
  await taskDialog.getByLabel("Title").fill("Calendar E2E edited");
  await taskDialog.getByRole("button", { name: "Save" }).click();
  await expect(taskDialog.getByRole("heading", { name: "Calendar E2E edited" })).toBeVisible();
  await taskDialog.getByRole("button", { name: "Close task" }).click();
  await expect(page.getByTestId("month-task").filter({ hasText: "Calendar E2E edited" })).toBeVisible();

  await page.getByTestId("month-task").filter({ hasText: "Calendar E2E edited" }).click();
  await page.getByRole("dialog", { name: "Task details" }).getByRole("checkbox", { name: "Mark as completed" }).click();
  await expect(page.getByRole("dialog", { name: "Task details" })).toHaveCount(0);
  await expect(page.getByTestId("month-task").filter({ hasText: "Calendar E2E edited" })).toHaveCount(0);
});

test("smart-token highlighting can be cancelled with one Backspace", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add label" }).click(); const labelDialog = page.getByRole("dialog", { name: "Add label" }); await labelDialog.getByLabel("Label name").fill("EscapeLabel"); await labelDialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.goto("/inbox"); await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add task" }); const smart = dialog.getByLabel("Smart task");
  await smart.fill("Literal @EscapeLabel"); await expect(dialog.locator("mark", { hasText: "@EscapeLabel" })).toHaveCount(1);
  await smart.press("End"); await smart.press("Backspace");
  await expect(smart).toHaveValue("Literal @EscapeLabel"); await expect(dialog.locator("mark", { hasText: "@EscapeLabel" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Submit task" }).click();
  await expect(page.locator("[data-task-id]", { hasText: "Literal @EscapeLabel" })).toBeVisible();
});

test("Inbox, Today and Upcoming can reveal completed tasks", async ({ page }) => {
  await page.goto("/inbox"); await addTask(page, "Inbox completed toggle");
  let row = page.locator("[data-task-id]", { hasText: "Inbox completed toggle" }); await row.getByRole("checkbox", { name: "Mark as completed" }).click(); await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Show completed" }).click(); await expect(page.locator("[data-task-id]", { hasText: "Inbox completed toggle" })).toBeVisible();

  await addTask(page, "TodayView completed toggle today"); row = page.locator("[data-task-id]", { hasText: "TodayView completed toggle" }); await row.getByRole("checkbox", { name: "Mark as completed" }).click();
  await page.goto("/today"); await expect(page.locator("[data-task-id]", { hasText: "TodayView completed toggle" })).toHaveCount(0); await page.getByRole("button", { name: "Show completed" }).click(); await expect(page.locator("[data-task-id]", { hasText: "TodayView completed toggle" })).toBeVisible();

  await page.goto("/inbox"); await addTask(page, "UpcomingView completed toggle tomorrow"); row = page.locator("[data-task-id]", { hasText: "UpcomingView completed toggle" }); await row.getByRole("checkbox", { name: "Mark as completed" }).click();
  await page.goto("/upcoming"); await page.getByRole("button", { name: "Month" }).click(); await expect(page.getByTestId("month-task").filter({ hasText: "UpcomingView completed toggle" })).toHaveCount(0); await page.getByRole("button", { name: "Show completed" }).click(); await expect(page.getByTestId("month-task").filter({ hasText: "UpcomingView completed toggle" })).toBeVisible();
});

test("mobile drawer exposes the global add modal and can submit a task", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("complementary").getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await dialog.getByLabel("Smart task").fill("Mobile E2E tomorrow at 9am");
  const submit = dialog.getByRole("button", { name: "Submit task" });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-task-id]", { hasText: "Mobile E2E" })).toBeVisible();
});

test("project drag ordering persists through the canonical reorder operation", async ({ page }) => {
  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill("E2EOrderProject");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("link", { name: "E2EOrderProject" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  await addTask(page, "Order E2E A");
  await addTask(page, "Order E2E B");
  const rows = page.locator("[data-task-id]");
  await expect(rows.nth(0)).toContainText("Order E2E A");
  const handle = page.getByRole("button", { name: "Reorder Order E2E A" });
  const source = await handle.boundingBox();
  const target = await rows.nth(1).boundingBox();
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height * 0.75, { steps: 12 });
  await page.mouse.up();
  await expect(rows.nth(0)).toContainText("Order E2E B");
  await expect(rows.nth(1)).toContainText("Order E2E A");
});

test("row shortcuts and theme settings work without restoring removed search shortcuts", async ({ page }) => {
  await page.goto("/inbox");
  await addTask(page, "Shortcut E2E task");
  let row = page.locator("[data-task-id]", { hasText: "Shortcut E2E task" });
  const taskId = await row.getAttribute("data-task-id");
  expect(taskId).toBeTruthy();
  row = page.locator(`[data-task-id="${taskId}"]`);

  for (const [key, label] of [["e", "Title"], ["d", "Due date"], ["p", "Priority (^)"], ["m", "Project (#)"]] as const) {
    await row.focus();
    await page.keyboard.press(key);
    await expect(row.getByLabel(label, { exact: true })).toBeFocused();
    await row.getByRole("button", { name: "Cancel" }).click();
  }

  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/inbox$/);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })));
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/settings");
  const theme = page.getByRole("main").getByLabel("Theme");
  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await theme.selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await theme.selectOption("system");
  await expect(theme).toHaveValue("system");
});
