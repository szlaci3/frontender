import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { presets } from "../vendor/styler/src/styles/presets";
import { constrainStyle } from "../vendor/styler/shared/constraints";
async function tool(page: Page, name: RegExp) {
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name })
    .click();
}
async function saved(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const file = await event;
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}
async function edit(page: Page, label: string, value: string) {
  const input = page.getByRole("textbox", { name: label, exact: true });
  await input.fill(value);
  await input.press("Tab");
}

test("inspector reads computed CSS, edits applied styles, resets and deletes declarations", async ({
  page,
}) => {
  await page.goto("/");
  await tool(page, /Styler/);
  await expect(
    page.getByLabel("Computed page background-color", { exact: true }),
  ).toContainText("rgb(");
  await page.getByRole("button", { name: /Rosewater/ }).click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  const before = await saved(page);
  await edit(page, "Edit page background-color", "#112233");
  await expect(
    page.getByRole("button", {
      name: "Lock page background-color",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(17, 34, 51)",
  );
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Reset page background-color", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(255, 242, 244)",
  );
  await page
    .getByRole("button", { name: "Delete page background-color", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).not.toHaveCSS(
    "background-color",
    "rgb(255, 242, 244)",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await edit(page, "Edit page background-color", "#112233");
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Edit page background-color",
      exact: true,
    }),
  ).toHaveValue("#112233");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(before);
});

test("new declarations are validated, previewed and removable", async ({
  page,
}) => {
  await page.goto("/");
  await tool(page, /Styler/);
  await page
    .getByRole("button", { name: "Add declaration to page", exact: true })
    .click();
  await page
    .getByLabel("New property for page", { exact: true })
    .fill("font-style");
  await page
    .getByLabel("New value for page", { exact: true })
    .fill("unsupported");
  await page
    .locator(".css-add-form")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.locator(".css-add-form").getByRole("alert")).toBeVisible();
  await page.getByLabel("New value for page", { exact: true }).fill("italic");
  await page
    .locator(".css-add-form")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "font-style",
    "italic",
  );
  expect((await saved(page)).pages[0].styles).toHaveLength(0);
  await page.getByRole("button", { name: "Apply to design" }).click();
  await page
    .getByRole("button", { name: "Delete page font-style", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "font-style",
    "normal",
  );
});

test("content-only assistant proposals retain a manually edited brand palette", async ({
  page,
}) => {
  await page.route("**/api/assistant", (route) =>
    route.fulfill({ json: { available: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await page.getByLabel("Brand accent color", { exact: true }).fill("#234567");
  await page
    .getByRole("button", { name: "Preview brand", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  const before = await saved(page);
  await tool(page, /Formlane/);
  await page
    .getByRole("button", { name: "Explore with AI", exact: true })
    .click();
  await page.getByRole("button", { name: /Try an example/ }).click();
  await page.getByRole("button", { name: /Apply.*changes/ }).click();
  const after = await saved(page);
  expect(after.pages[0].builderTheme).toEqual(before.pages[0].builderTheme);
  expect(after.pages[0].blocks).not.toEqual(before.pages[0].blocks);
});

test("saved presets retain edits across reload and project merging", async ({
  page,
}) => {
  await page.goto("/");
  await tool(page, /Styler/);
  await page.getByRole("button", { name: /Rosewater/ }).click();
  await edit(page, "Edit page background-color", "#334455");
  await page.getByLabel("Preset name", { exact: true }).fill("Ocean draft");
  await page.getByRole("button", { name: "Save style", exact: true }).click();
  const w = await saved(page);
  expect(w.savedStyles).toHaveLength(1);
  expect(w.pages[0].styles).toHaveLength(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("frontender.workspace.v1")!)
            .savedStyles?.length,
      ),
    )
    .toBe(1);
  await page.reload();
  await tool(page, /Styler/);
  await page
    .getByRole("button", { name: /Make it yours. Ocean draft/ })
    .click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(51, 68, 85)",
  );
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "saved.frontender.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await page.getByRole("button", { name: "Add to current workspace" }).click();
  const merged = await saved(page);
  expect(merged.savedStyles).toHaveLength(2);
  expect(
    new Set(merged.savedStyles.map((s: { id: string }) => s.id)).size,
  ).toBe(2);
});

test("inspiration is independent and explicit generation captures locks and Unset", async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route("**/api/styler/generate", async (route) => {
    const input = route.request().postDataJSON();
    requests.push(input);
    await route.fulfill({
      json: {
        style: constrainStyle(
          {
            ...presets[1],
            id: input.id,
            name: input.expression,
            provenance: "antigravity",
          },
          input.snapshot,
        ),
      },
    });
  });
  await page.goto("/");
  await tool(page, /Styler/);
  await page.getByRole("button", { name: "Inspire S2", exact: true }).click();
  await expect(page.getByText("Preview only", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: /Rosewater/ }).click();
  await edit(page, "Edit page color", "#123456");
  await page
    .getByRole("button", { name: "Unset page background-color", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(255, 242, 244)",
  );
  expect(requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Generate variations", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(4);
  for (const input of requests) {
    expect(input.inspiration.id).toBe("S2");
    expect(input.snapshot).toContainEqual({
      selectorId: "page",
      property: "color",
      state: "locked",
      value: "#123456",
    });
    expect(input.snapshot).toContainEqual({
      selectorId: "page",
      property: "background-color",
      state: "unset",
    });
  }
  await page
    .getByRole("button", { name: "Clear inspiration", exact: true })
    .click();
  expect(requests).toHaveLength(4);
});

test("brand preview is reversible and applies to all pages and newly created pages", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: /Blog Editable/ }).click();
  const before = await saved(page);
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("North Studio");
  await page.getByLabel("Brand theme", { exact: true }).selectOption("tide");
  await page
    .getByRole("button", { name: "Preview brand", exact: true })
    .click();
  expect(await saved(page)).toEqual(before);
  await expect(
    page.frameLocator("iframe").locator(".fe-nav strong"),
  ).toHaveText("North Studio");
  await page.getByRole("button", { name: "Apply to design" }).click();
  const branded = await saved(page);
  expect(
    branded.pages.every((p: any) => p.builderTheme.preset === "tide"),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: /HTML \/ CSS Start fresh/ }).click();
  expect((await saved(page)).pages.at(-1).builderTheme.preset).toBe("tide");
});

test("sections duplicate, reorder with keyboard drag, and respect text-field undo", async ({
  page,
}) => {
  await page.goto("/");
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Duplicate Hero section", exact: true })
    .click();
  const copied = await saved(page);
  expect(copied.pages[0].blocks).toHaveLength(
    before.pages[0].blocks.length + 1,
  );
  await page.evaluate(() => document.fonts.ready);
  const handle = page
    .getByRole("button", { name: "Drag Hero section", exact: true })
    .first();
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[aria-live="assertive"]')).toContainText(
    `was moved over droppable area ${copied.pages[0].blocks[1].id}`,
  );
  await page.keyboard.press("Space");
  await expect(
    page.locator(".fe-page [data-block-id]").first(),
  ).toHaveAttribute("data-block-id", copied.pages[0].blocks[1].id);
  const moved = await saved(page);
  expect(moved.pages[0].blocks[0].id).toBe(copied.pages[0].blocks[1].id);
  await page.getByRole("button", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("Control+z");
  expect((await saved(page)).pages[0].blocks).toEqual(copied.pages[0].blocks);
  await page.getByRole("button", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("Control+y");
  expect((await saved(page)).pages[0].blocks).toEqual(moved.pages[0].blocks);
  const input = page
    .getByRole("textbox", { name: "Hero headline", exact: true })
    .first();
  await input.focus();
  await page.keyboard.press("Control+z");
  expect((await saved(page)).pages[0].blocks.map((b: any) => b.id)).toEqual(
    moved.pages[0].blocks.map((b: any) => b.id),
  );
});

test("inspector and brand controls fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await tool(page, /Styler/);
  await page
    .getByRole("textbox", { name: "Edit page color", exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/inspector-phone.png" });
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  expect(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "test-results/brand-phone.png" });
});
