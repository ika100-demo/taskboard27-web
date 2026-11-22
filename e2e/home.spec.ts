import { expect, test } from "@playwright/test";

// No Task API is wired in the local e2e server, so the list area shows its load message here.
test("AC-001.5 home page renders its landmarks, the create form and the list area", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("id", "main-content");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(main.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Title" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Add task" })).toBeVisible();
  await expect(main.getByRole("region", { name: "Your tasks" })).toBeVisible();
});

test("AC-001.3 an empty title shows the message at the title field without leaving the page", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Add task" }).click();
  await expect(main.getByText("Enter a title of 1 to 200 characters")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("the health endpoint answers", async ({ request }) => {
  expect((await request.get("/api/health")).ok()).toBeTruthy();
});

test("unknown routes show the friendly 404", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page could not be found" })).toBeVisible();
});

test("the layout works on a phone without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
