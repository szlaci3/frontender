import { test, expect } from "@playwright/test";
import { presets } from "../vendor/styler/src/styles/presets";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
test("edits content, previews and applies styles, undoes and reloads persisted work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Hero headline" })
    .fill("A new beginning.");
  await page.getByRole("textbox", { name: "Hero headline" }).press("Tab");
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Styler/ })
    .click();
  const frame = page.frameLocator('iframe[title="Design preview"]');
  await expect(frame.locator(".hero-title")).toHaveText("A new beginning.");
  await page.getByRole("button", { name: /Blueprint/ }).click();
  await expect(page.getByText("Preview only")).toBeVisible();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(frame.locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(237, 244, 255)",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(frame.locator(".fe-page")).not.toHaveCSS(
    "background-color",
    "rgb(237, 244, 255)",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator("iframe").locator(".hero-title")).toHaveText(
    "A new beginning.",
  );
  expect(errors).toEqual([]);
});
test("creates linked pages, edits HTML safely, exports and adds project files", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page
    .getByRole("button", { name: /Contact form A conversation/ })
    .click();
  await page.frameLocator("iframe").getByLabel("Your name").fill("Ada");
  await page
    .frameLocator("iframe")
    .getByLabel("Email address")
    .fill("ada@example.com");
  await page.frameLocator("iframe").getByLabel("Your message").fill("Hello");
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: "Send message" })
    .click();
  await expect(page.frameLocator("iframe").locator("output")).toContainText(
    "not been sent",
  );
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const file = await saved;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path!);
  await page.getByRole("button", { name: "Add to current workspace" }).click();
  await expect(page.locator(".page-list button")).toHaveCount(4);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await page
    .getByRole("textbox", { name: "HTML source" })
    .fill(
      '<h1>Hello imported page</h1><script>parent.document.body.innerHTML="BAD"</script><img src=x onerror="alert(1)"><form><input required name="email"><button>Send</button></form>',
    );
  await page
    .getByRole("textbox", { name: "CSS source" })
    .fill(
      "body { background: #123456; } h1 { font-size: 29px; color: #654321; }",
    );
  await page.getByRole("button", { name: "Save code" }).click();
  await expect(
    page.getByText("frontender", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.frameLocator("iframe").locator("h1")).toHaveCSS(
    "font-size",
    "29px",
  );
  await expect(page.frameLocator("iframe").locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("heading", { name: "Hello imported page" }),
  ).toBeVisible();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export website" }).click();
  expect((await exported).suggestedFilename()).toBe("frontender-website.zip");
});
test("component styling stays scoped and border preview is optional and undoable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Styler/ })
    .click();
  await page.getByLabel("Style scope").selectOption("component");
  await page.frameLocator("iframe").locator(".hero-title").click();
  await page.getByRole("button", { name: /Rosewater/ }).click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).not.toHaveCSS(
    "background-color",
    "rgb(255, 242, 244)",
  );
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Border Image/ })
    .click();
  await page
    .getByRole("button", { name: "Preview border in workspace" })
    .click();
  await expect(page.getByText("Preview only")).toBeVisible();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(
    page.frameLocator("iframe").locator(".fe-block").first(),
  ).toHaveCSS("border-top-width", "28px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.frameLocator("iframe").locator(".fe-block").first(),
  ).not.toHaveCSS("border-top-width", "28px");
});
test("mobile workspace has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/frontender-mobile.png",
    fullPage: true,
  });
});
test("desktop screenshot", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Styler/ })
    .click();
  await page.getByRole("button", { name: /Tidal Atelier/ }).click();
  await page.screenshot({
    path: "test-results/frontender-desktop.png",
    fullPage: true,
  });
});

test("all templates render, AI example applies with undo, and exported navigation works", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const name of [
    "Kanban board",
    "Data table",
    "Blog",
    "Social feed",
    "Dashboard",
  ]) {
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await page
      .getByRole("button", { name: new RegExp(`^${name} Editable`) })
      .click();
    await expect(
      page.locator(".builder-canvas .fe-block").first(),
    ).toBeVisible();
  }
  await expect(page.locator(".builder-canvas .dashboard-grid")).toBeVisible();
  await page
    .getByRole("button", { name: "Explore with AI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try an example · no AI request" })
    .click();
  await page.getByRole("button", { name: /^Apply \d+ changes?$/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Section title" }).last(),
  ).toBeVisible();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export website" }).click();
  const zip = unzipSync(
    new Uint8Array(await readFile((await (await exported).path())!)),
  );
  const htmlFiles = Object.keys(zip).filter((n) => n.endsWith(".html"));
  expect(htmlFiles).toHaveLength(7);
  await page.route("https://export.frontender.test/**", async (route) => {
    const name =
      new URL(route.request().url()).pathname.slice(1) || "index.html";
    const body = zip[name];
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: "text/html",
      body: body ? strFromU8(body) : "Missing page",
    });
  });
  await page.goto("https://export.frontender.test/index.html");
  await page.getByRole("link", { name: "Kanban board", exact: true }).click();
  const columns = page.locator(".board-column");
  const count = await columns.nth(1).locator(".kanban-card").count();
  await page.getByRole("combobox").first().selectOption("1");
  await expect(columns.nth(1).locator(".kanban-card")).toHaveCount(count + 1);
  await page.getByRole("link", { name: "Data table", exact: true }).click();
  await page.locator("th").first().click();
  await expect(page.locator("th").first()).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  expect(errors).toEqual([]);
});

test("AI styles are manual, preserve content, and failed cards have explicit retry", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/styler/generate", async (route) => {
    requests++;
    const input = route.request().postDataJSON();
    if (input.expression === "Artistic")
      return route.fulfill({
        status: 502,
        json: { error: "Provider unavailable." },
      });
    await route.fulfill({
      json: {
        style: {
          ...presets[1],
          id: input.id,
          name: input.expression,
          provenance: "antigravity",
        },
      },
    });
  });
  await page.goto("/");
  expect(requests).toBe(0);
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Styler/ })
    .click();
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Generate variations", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Make it yours. Professional/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Provider unavailable.", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(4);
  await expect(
    page.getByRole("button", { name: "Apply to design" }),
  ).toHaveCount(0);
  await expect(
    page.frameLocator("iframe").locator(".hero-title"),
  ).toContainText("A slower pace");
  await page
    .getByRole("button", { name: /Make it yours. Professional/ })
    .click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect(page.frameLocator("iframe").locator(".fe-page")).toHaveCSS(
    "background-color",
    "rgb(237, 244, 255)",
  );
});

test("replace import requires confirmation and cancels without losing work", async ({
  page,
}) => {
  await page.goto("/");
  const stored = await page.evaluate(() =>
    localStorage.getItem("frontender.workspace.v1"),
  );
  await page.waitForTimeout(500);
  const workspace =
    stored ??
    (await page.evaluate(() =>
      localStorage.getItem("frontender.workspace.v1"),
    ));
  const project = JSON.parse(workspace!);
  project.name = "Imported replacement";
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Replace current workspace…" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Workspace name" }),
  ).toHaveValue("A little possibility");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Replace current workspace…" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Workspace name" }),
  ).toHaveValue("Imported replacement");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("server separates API routes and validates malformed requests without provider calls", async ({
  request,
}) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/styler/generate")).status()).toBe(405);
  expect(
    (
      await request.post("/api/styler/generate", { data: { bad: true } })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/border/generate")).status()).toBe(405);
  expect(
    (
      await request.post("/api/border/generate", { data: { bad: true } })
    ).status(),
  ).toBe(400);
  const voice = await request.get("/api/voice-token");
  expect(voice.status()).toBe(200);
  expect(typeof (await voice.json()).enabled).toBe("boolean");
});
