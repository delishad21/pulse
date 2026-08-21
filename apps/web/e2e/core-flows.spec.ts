import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-auth@pulse.local");
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

test("quick add, edit, complete/reopen, comment, and command palette", async ({ page }) => {
  await page.goto("/inbox");
  const quickAdd = page.getByLabel("Quick add task");
  await quickAdd.fill("E2E inbox task !1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const taskLink = page.getByRole("link", { name: /E2E inbox task/ });
  await expect(taskLink).toBeVisible();
  await expect(taskLink).toContainText("urgent");
  await taskLink.click();
  await expect(page).toHaveURL(/\/task\//);

  const status = page.getByRole("checkbox", { name: "Mark as completed" });
  await status.click();
  await expect(page.getByRole("checkbox", { name: "Mark as open" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Mark as open" }).click();
  await expect(page.getByRole("checkbox", { name: "Mark as completed" })).not.toBeChecked();

  await page.getByLabel("Add a comment").fill("E2E note");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("E2E note")).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })));
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.getByPlaceholder(/Search tasks/).fill("E2E inbox task");
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "E2E inbox task", exact: true }).click();
  await expect(page).toHaveURL(/\/task\//);
});

test("project, section, label, rich quick add, bulk move and reschedule", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("New label").fill("E2ELabel");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("+E2ELabel")).toBeVisible();

  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill("E2EProject");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("link", { name: "E2EProject" }).click();

  await page.getByLabel("New section name").fill("E2ESection");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("E2ESection")).toBeVisible();

  await page.getByLabel("Quick add task").fill("Project task #E2EProject @E2ESection +E2ELabel !2 2099-01-05");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  const row = page.locator("[data-task-id]", { hasText: "Project task" });
  await expect(row).toContainText("high");
  await expect(row).toContainText("+E2ELabel");
  await expect(row).toContainText("Jan");

  await row.getByRole("checkbox", { name: "Select Project task" }).check();
  await page.getByLabel("Move selected tasks to project").selectOption("");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/inbox");
  const inboxRow = page.locator("[data-task-id]", { hasText: "Project task" });
  await inboxRow.getByRole("checkbox", { name: "Select Project task" }).check();
  await page.getByLabel("Reschedule selected tasks").fill("2099-02-10");
  await page.getByRole("button", { name: "Reschedule" }).click();
  await expect(inboxRow).toContainText("Feb");
});

test("undo/redo and keyboard navigation operate on the latest user intent", async ({ page }) => {
  await page.goto("/inbox");
  const quickAdd = page.getByLabel("Quick add task");
  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("q");
  await expect(quickAdd).toBeFocused();
  await quickAdd.fill("Undoable E2E task");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: /Undoable E2E task/ })).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("link", { name: /Undoable E2E task/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("link", { name: /Undoable E2E task/ })).toBeVisible();

  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await expect(page).toHaveURL(/\/today$/);
});

test("edit recurrence, delete/restore, and bulk completion remain reversible", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByLabel("Quick add task").fill("Editable E2E task");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  let row = page.locator("[data-task-id]", { hasText: "Editable E2E task" });
  const editableTaskId = await row.getAttribute("data-task-id");
  expect(editableTaskId).toBeTruthy();
  row = page.locator(`[data-task-id="${editableTaskId}"]`);
  await row.getByRole("button", { name: "Edit Editable E2E task" }).click();
  await row.getByLabel("Title").fill("Edited recurring E2E task");
  await row.getByLabel("Recurrence rule").fill("FREQ=WEEKLY;INTERVAL=1");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /Edited recurring E2E task/ })).toBeVisible();

  await page.getByRole("link", { name: /Edited recurring E2E task/ }).click();
  await expect(page.getByText("Recurring", { exact: true })).toBeVisible();
  await page.goto("/inbox");

  row = page.locator("[data-task-id]", { hasText: "Edited recurring E2E task" });
  await row.getByRole("button", { name: "Delete Edited recurring E2E task" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  row = page.locator("[data-task-id]", { hasText: "Edited recurring E2E task" });
  await expect(row).toBeVisible();

  await row.getByRole("checkbox", { name: "Select Edited recurring E2E task" }).check();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.goto("/completed");
  await expect(page.getByRole("link", { name: /Edited recurring E2E task/ })).toBeVisible();
});

test("canonical views, comment search, filters, and theme modes work end to end", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByLabel("Quick add task").fill("Canonical due E2E today");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: /Canonical due E2E/ })).toBeVisible();
  await page.getByLabel("Quick add task").fill("Future canonical E2E 2099-11-12");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: /Future canonical E2E/ })).toBeVisible();
  await page.getByLabel("Quick add task").fill("Search comment host E2E");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: /Search comment host E2E/ })).toBeVisible();

  await page.getByRole("link", { name: /Search comment host E2E/ }).click();
  await page.getByLabel("Add a comment").fill("comment-only-search-needle-4281");
  await page.getByRole("button", { name: "Add comment" }).click();

  await page.goto("/today");
  await expect(page.getByRole("link", { name: /Canonical due E2E/ })).toBeVisible();
  await page.goto("/upcoming");
  await expect(page.getByRole("link", { name: /Future canonical E2E/ })).toBeVisible();

  await page.goto("/search");
  await page.getByPlaceholder("Search tasks…").fill("comment-only-search-needle-4281");
  await expect(page.getByRole("link", { name: /Search comment host E2E/ })).toBeVisible();

  await page.goto("/filters");
  await page.getByPlaceholder("Search tasks…").fill("Future canonical E2E");
  await expect(page.getByRole("link", { name: /Future canonical E2E/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Canonical due E2E/ })).toHaveCount(0);

  await page.goto("/settings");
  const theme = page.getByRole("main").getByLabel("Theme");
  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await theme.selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await theme.selectOption("system");
  await expect(theme).toHaveValue("system");
});

test("project drag ordering persists through the canonical reorder operation", async ({ page }) => {
  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill("E2EOrderProject");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("link", { name: "E2EOrderProject" }).click();

  const quickAdd = page.getByLabel("Quick add task");
  await quickAdd.fill("Order E2E A");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(page.getByRole("link", { name: /Order E2E A/ })).toBeVisible();
  await quickAdd.fill("Order E2E B");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();

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

test("task row and global keyboard shortcuts focus the intended controls", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByLabel("Quick add task").fill("Shortcut E2E task");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  let row = page.locator("[data-task-id]", { hasText: "Shortcut E2E task" });
  const taskId = await row.getAttribute("data-task-id");
  expect(taskId).toBeTruthy();
  row = page.locator(`[data-task-id="${taskId}"]`);

  await row.focus();
  await page.keyboard.press("e");
  await expect(row.getByLabel("Title")).toBeFocused();
  await row.getByRole("button", { name: "Cancel" }).click();

  await row.focus();
  await page.keyboard.press("d");
  await expect(row.getByLabel("Due date")).toBeFocused();
  await row.getByRole("button", { name: "Cancel" }).click();

  await row.focus();
  await page.keyboard.press("p");
  await expect(row.getByLabel("Priority")).toBeFocused();
  await row.getByRole("button", { name: "Cancel" }).click();

  await row.focus();
  await page.keyboard.press("m");
  await expect(row.getByLabel("Project")).toBeFocused();
  await row.getByRole("button", { name: "Cancel" }).click();

  await row.focus();
  await page.keyboard.press("c");
  await expect(row).toHaveCount(0);

  await page.getByRole("heading", { name: "Inbox" }).click();
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/search$/);

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })));
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);
});
