import { test, expect } from "@playwright/test";

// Explicit hosted verification: public example fetches, no AI/provider calls.
test.skip(
  !process.env.FRONTENDER_BASE_URL,
  "Set FRONTENDER_BASE_URL to verify the deployment.",
);
test("hosted import routes reject unsafe URLs and perform real public style/content imports", async ({
  page,
  request,
}) => {
  for (const path of ["/api/import-style", "/api/import-content"]) {
    const response = await request.post(path, {
      data: { url: "http://127.0.0.1/" },
    });
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"]).toContain("application/json");
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("button", { name: /Import website \/ Markdown/ })
    .click();
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://formlane.netlify.app/examples/brand-study.html");
  await page
    .getByRole("button", { name: "Explore style", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview on current page" }),
  ).toBeEnabled({ timeout: 20000 });
  await page.getByRole("button", { name: "Preview on current page" }).click();
  await page.getByRole("button", { name: "Apply to design" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("frontender.workspace.v1")!).pages[0]
            .builderTheme?.custom?.accent,
      ),
    )
    .toBe("#663399");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("button", { name: /Import website \/ Markdown/ })
    .click();
  await page.getByRole("button", { name: "Page content", exact: true }).click();
  await page
    .getByLabel("Content website URL")
    .fill("https://formlane.netlify.app/examples/studio-notes.html");
  await page.getByRole("button", { name: "Read page", exact: true }).click();
  const add = page.getByRole("button", { name: /Add \d+ sections? to/ });
  await expect(add).toBeEnabled({ timeout: 20000 });
  await add.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/hosted-imports.png" });
});
