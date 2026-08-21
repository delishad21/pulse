import { expect, test } from "@playwright/test";

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
