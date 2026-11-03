import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { extractStyle } from "../vendor/formlane/server/extract-style";
import { extractContent } from "../vendor/formlane/server/extract-content";

const styleResult = extractStyle(
  "<title>Studio</title><style>body{background:#ffffff;color:#222222}button{background:#663399;border-radius:12px}</style><h1>Studio</h1><button>Read</button>",
  "https://example.com",
  [],
);
async function openImport(page: Page) {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("button", { name: /Import website \/ Markdown/ })
    .click();
}
async function tool(page: Page, name: RegExp) {
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name })
    .click();
}
async function saved(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const download = await event;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

test("Markdown selection is additive, editable, undoable and survives reload without API calls", async ({
  page,
}) => {
  let calls = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) calls++;
  });
  await page.goto("/");
  const before = await saved(page);
  await openImport(page);
  await page.getByRole("button", { name: "Page content", exact: true }).click();
  await page
    .getByRole("button", { name: "Paste Markdown", exact: true })
    .click();
  await page
    .getByLabel("Your Markdown", { exact: true })
    .fill(
      "# Imported notes\nUseful text.\n\n## Schedule\n| Who | When |\n| --- | --- |\n| Ada | Monday |\n\n## Leave behind\nNot selected.",
    );
  await page.getByRole("button", { name: "Prepare sections" }).click();
  await page
    .getByRole("checkbox", { name: /Include section .*Leave behind/ })
    .uncheck();
  await page.getByRole("button", { name: /Add 2 sections to/ }).click();
  const after = await saved(page);
  expect(after.pages[0].blocks.slice(0, before.pages[0].blocks.length)).toEqual(
    before.pages[0].blocks,
  );
  expect(after.pages[0].blocks).toHaveLength(before.pages[0].blocks.length + 2);
  expect(after.pages[0].blocks.at(-1).rows[0]).toEqual(["Ada", "Monday"]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).pages[0].blocks).toEqual(before.pages[0].blocks);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("frontender.workspace.v1")!).pages[0]
            .blocks.length,
      ),
    )
    .toBe(after.pages[0].blocks.length);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Hero headline" }),
  ).toBeVisible();
  expect((await saved(page)).pages[0].blocks).toEqual(after.pages[0].blocks);
  expect(calls).toBe(0);
});

test("website styles show evidence, preview without saving, then apply to one page and undo", async ({
  page,
}) => {
  await page.route("**/api/import-style", (route) =>
    route.fulfill({ json: styleResult }),
  );
  await page.goto("/");
  const before = await saved(page);
  await openImport(page);
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://example.com");
  await page
    .getByRole("button", { name: "Explore style", exact: true })
    .click();
  await page.getByText("Where these styles came from", { exact: true }).click();
  await expect(page.locator(".style-evidence")).toContainText("#663399");
  await page.getByRole("button", { name: "Preview on current page" }).click();
  await expect(
    page.frameLocator('iframe[title="Design preview"]').locator(".fe-page"),
  ).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await openImport(page);
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://example.com");
  await page
    .getByRole("button", { name: "Explore style", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview on current page" }).click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  const applied = await saved(page);
  expect(applied.pages[0].builderTheme.custom.accent).toBe("#663399");
  expect(applied.pages[0].importedStyle.evidence).toEqual(styleResult.evidence);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(before);
});

test("website content review imports selected text and tables without replacing the page", async ({
  page,
}) => {
  const result = extractContent(
    "<main><h1>Public notes</h1><p>Imported copy.</p><h2>Team</h2><table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td>Design</td></tr></table></main>",
    "https://example.com",
  );
  await page.route("**/api/import-content", (route) =>
    route.fulfill({ json: result }),
  );
  await page.goto("/");
  const before = await saved(page);
  await openImport(page);
  await page.getByRole("button", { name: "Page content", exact: true }).click();
  await page.getByLabel("Content website URL").fill("https://example.com");
  await page.getByRole("button", { name: "Read page", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Include section .*Public notes/ })
    .uncheck();
  await page.getByRole("button", { name: /Add 1 section to/ }).click();
  const after = await saved(page);
  expect(after.pages[0].blocks.slice(0, -1)).toEqual(before.pages[0].blocks);
  expect(after.pages[0].blocks.at(-1)).toMatchObject({
    type: "table",
    rows: [["Ada", "Design"]],
  });
});

test("oversized border handoff preserves the draft and leaves the design unchanged", async ({
  page,
}) => {
  await page.goto("/");
  const before = await saved(page);
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1100;
    c.height = 1100;
    const ctx = c.getContext("2d")!;
    const pixels = ctx.createImageData(1100, 1100);
    for (let offset = 0; offset < pixels.data.length; offset += 65536) {
      crypto.getRandomValues(
        pixels.data.subarray(
          offset,
          Math.min(offset + 65536, pixels.data.length),
        ),
      );
    }
    ctx.putImageData(pixels, 0, 0);
    return c.toDataURL("image/png").split(",")[1];
  });
  await tool(page, /Border Image/);
  await page
    .locator('.border-workspace input[type="file"]')
    .first()
    .setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await expect(page.locator(".source-meta")).toContainText("1100 × 1100");
  await page
    .getByRole("button", { name: "Preview border in workspace" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "too large to embed without losing detail",
  );
  expect(await saved(page)).toEqual(before);
  await expect(page.locator(".source-meta")).toContainText("1100 × 1100");
});

test("border tab retains its draft and embeds full-resolution transparent images; applied borders reopen", async ({
  page,
}) => {
  await page.goto("/");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 900;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(10, 10, 100, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await tool(page, /Border Image/);
  await page
    .locator('.border-workspace input[type="file"]')
    .first()
    .setInputFiles({
      name: "transparent.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await expect(page.locator(".source-meta")).toContainText("1800 × 900");
  await page
    .getByLabel("border-image-slice unit", { exact: true })
    .selectOption("");
  await page.getByLabel("border-image-slice Top", { exact: true }).fill("120");
  await tool(page, /Formlane/);
  await tool(page, /Border Image/);
  await expect(
    page.getByLabel("border-image-slice Top", { exact: true }),
  ).toHaveValue("120");
  await expect(page.locator(".source-meta")).toContainText("1800 × 900");
  await page
    .getByRole("button", { name: "Preview border in workspace" })
    .click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  const project = await saved(page);
  const border = project.pages[0].borders[0];
  await expect(
    page.frameLocator('iframe[title="Design preview"]').locator(".fe-page"),
  ).toHaveCSS("border-image-source", `url("${border.source}")`);
  expect(border.settings.slice).toEqual([120, 120, 120, 120]);
  expect(
    await page.evaluate(async (source: string) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return {
        width: image.width,
        height: image.height,
        alpha: ctx.getImageData(0, 0, 1, 1).data[3],
      };
    }, border.source),
  ).toEqual({ width: 1800, height: 900, alpha: 0 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("frontender.workspace.v1")!).pages[0]
            .borders.length,
      ),
    )
    .toBe(1);
  await page.reload();
  await tool(page, /Border Image/);
  await page.getByRole("button", { name: "Load applied border" }).click();
  await expect(
    page.getByLabel("border-image-slice Top", { exact: true }),
  ).toHaveValue("120");
  await expect(page.locator(".source-meta")).toContainText("1800 × 900");
});

test("import review fits a phone and URL errors preserve the workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/import-content", (route) =>
    route.fulfill({ status: 422, json: { error: "Use a public HTTPS page." } }),
  );
  await page.goto("/");
  const before = await saved(page);
  await openImport(page);
  await page.getByRole("button", { name: "Page content", exact: true }).click();
  await page.getByLabel("Content website URL").fill("https://example.com");
  await page.getByRole("button", { name: "Read page", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("public HTTPS");
  await page
    .getByRole("button", { name: "Paste Markdown", exact: true })
    .click();
  await page
    .getByLabel("Your Markdown", { exact: true })
    .fill("# Phone notes\nReview on a small screen.");
  await page.getByRole("button", { name: "Prepare sections" }).click();
  await expect(
    page.getByRole("button", { name: /Add 1 section to/ }),
  ).toBeVisible();
  expect(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "test-results/import-phone.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await saved(page)).toEqual(before);
});
