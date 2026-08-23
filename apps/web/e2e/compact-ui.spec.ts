import { expect, test, type Locator, type Page } from "@playwright/test";

const runId = Date.now().toString(36);
const unique = (name: string) => `${name} ${runId}`;

async function openGlobalComposer(page: Page) {
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function submitComposer(container: Locator, text: string) {
  await container.getByLabel("Smart task").fill(text);
  await container.getByRole("button", { name: "Submit task" }).click();
}

async function addGlobalTask(page: Page, text: string) {
  const dialog = await openGlobalComposer(page);
  await submitComposer(dialog, text);
  await expect(dialog).toHaveCount(0);
}
async function createLabel(page: Page, name: string, color = "#3b82f6") {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add label" }).click();
  const dialog = page.getByRole("dialog", { name: "Add label" });
  await dialog.getByLabel("Label name").fill(name);
  await dialog.getByRole("button", { name: `Choose color ${color}` }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("e2e-user");
  await page.getByLabel("Password").fill("pulse-e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
});
test("@/# autocomplete, solid tokens, location and label colors work together", async ({ page }) => {
  const label = `ColorLabel(${runId})`;
  const project = `Project Space ${runId}`;
  await createLabel(page, label);
  await expect(page.getByLabel(`Color for ${label}`)).toHaveValue("#3b82f6");
  await createProject(page, project);
  await page.goto("/inbox");
  const dialog = await openGlobalComposer(page);
  const smart = dialog.getByLabel("Smart task");
  await smart.fill(`${unique("Autocomplete")} #Project Sp`);
  await expect(dialog.getByRole("listbox", { name: "Project suggestions" })).toBeVisible();
  await smart.press("Enter");
  await expect(smart).toHaveValue(new RegExp(`#${project}`));
  await smart.fill(`${await smart.inputValue()} @ColorLab`);
  const labels = dialog.getByRole("listbox", { name: "Label suggestions" });
  await expect(labels).toBeVisible();
  await labels.getByRole("option", { name: `@${label}` }).click();
  await smart.fill(`${await smart.inputValue()} ^high *"Marina Bay" 2099-01-05 2pm-4pm`);
  for (const token of [`#${project}`, `@${label}`, "^high", '*"Marina Bay"', "2099-01-05", "2pm-4pm"]) {
    const mark = dialog.locator("mark", { hasText: token });
    await expect(mark).toBeVisible();
    await expect(mark).toHaveCSS("color", "rgb(255, 255, 255)");
  }
  await expect(dialog.locator("mark", { hasText: `@${label}` })).toHaveCSS("background-color", "rgb(59, 130, 246)");
  await dialog.getByRole("button", { name: "Reminders" }).click();
  await dialog.getByRole("button", { name: "Add reminder" }).click();
  await dialog.getByLabel("Reminder 1", { exact: true }).fill("2099-01-05T13:30");
  await dialog.getByRole("button", { name: "Submit task" }).click();
  await page.getByRole("link", { name: project }).click();
  const row = page.locator("[data-task-id]", { hasText: unique("Autocomplete") });
  await expect(row).toContainText("Marina Bay");
  await expect(row).toContainText("high");
  await expect(row.getByText(`@${label}`)).toHaveCSS("color", "rgb(59, 130, 246)");
});
test("Inbox and Today put the same composer after the tasks for that day", async ({ page }) => {
  await page.goto("/inbox");
  const tomorrow = unique("Tomorrow seed");
  await addGlobalTask(page, `${tomorrow} tomorrow`);
  const tomorrowGroup = page.locator("[data-date-group]").filter({ has: page.getByRole("heading", { name: "Tomorrow" }) });
  await expect(tomorrowGroup.locator("section")).toHaveCount(0);
  await tomorrowGroup.getByRole("button", { name: "Add task", exact: true }).click();
  const inlineTomorrow = unique("Inline child");
  await submitComposer(tomorrowGroup, inlineTomorrow);
  await expect(tomorrowGroup.locator("[data-task-id]", { hasText: inlineTomorrow })).toBeVisible();

  const todaySeed = unique("Today seed");
  await addGlobalTask(page, `${todaySeed} today`);
  await page.goto("/today");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Add task", exact: true }).click();
  const inlineToday = unique("Inline day task");
  await submitComposer(main, inlineToday);
  await expect(page.locator("[data-task-id]", { hasText: inlineToday })).toBeVisible();
});
test("Upcoming Week exposes seven day adders with date-scoped composers", async ({ page }) => {
  await page.goto("/upcoming");
  const headers = page.getByTestId("week-day-header");
  await expect(headers).toHaveCount(7);
  expect(await headers.evaluateAll((nodes) => nodes.map((node) => node.querySelector("p")?.textContent))).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const week = page.getByTestId("week-scroll");
  await expect(week.getByRole("button", { name: "Add task", exact: true })).toHaveCount(7);
  const sunday = week.locator("[data-week-day]").last();
  await sunday.getByRole("button", { name: "Add task", exact: true }).click();
  const name = unique("Week inline");
  await submitComposer(sunday, name);
  await expect(sunday.getByTestId("week-task").filter({ hasText: name })).toBeVisible();
});

test("root redirects to Inbox and Overview stays removed", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveCount(0);
});
