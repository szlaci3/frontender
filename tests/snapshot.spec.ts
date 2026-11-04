import { test, expect } from "@playwright/test";

test("a fresh recipient can browse a snapshot without loading or saving a workspace", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page
    .getByRole("button", { name: /Contact form A conversation/ })
    .click();
  await page
    .getByRole("button", { name: "Share snapshot", exact: true })
    .click();
  const field = page.getByRole("textbox", { name: "Snapshot link" });
  await expect(field).toHaveValue(/#snapshot=v1\./);
  const recipient = await browser.newPage();
  try {
    await recipient.goto(await field.inputValue());
    await expect(recipient.getByText("View-only snapshot")).toBeVisible();
    await expect(
      recipient.getByRole("button", { name: "Save project" }),
    ).toHaveCount(0);
    const frame = recipient.frameLocator('iframe[title="Design preview"]');
    await expect(frame.getByLabel("Your name")).toBeVisible();
    await frame.getByRole("link", { name: "Webshop" }).click();
    await expect(
      frame.getByRole("heading", { name: /A slower pace/ }),
    ).toBeVisible();
    expect(await recipient.evaluate(() => localStorage.length)).toBe(0);
  } finally {
    await recipient.close();
  }
});

test("a malformed snapshot shows a recovery link without opening the editor", async ({
  page,
}) => {
  await page.goto("/#snapshot=v1.invalid");
  await expect(page.getByRole("alert")).toContainText("invalid or incomplete");
  await expect(
    page.getByRole("link", { name: "Open Frontender" }),
  ).toHaveAttribute("href", "/");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
