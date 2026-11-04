import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Replays the application error from one real call, not the lost provider payload.
test("a replayed sketch rejection preserves controls, does not retry, and allows manual recovery", async ({
  page,
}) => {
  const evidence = JSON.parse(
    readFileSync("tests/fixtures/ai-sketch-probe.json", "utf8"),
  );
  expect(evidence.providerCalls).toBe(1);
  expect(evidence.agent).toBe("antigravity-preview-09-2026");
  expect(evidence.outcome).toBe("rejected");
  let requests = 0;
  await page.route("**/api/border/generate", async (route) => {
    requests++;
    const input = route.request().postDataJSON();
    expect(input.action).toBe("analyze");
    expect(input.view.sourceWidth).toBe(1000);
    expect(input.view.sourceHeight).toBe(640);
    await route.fulfill({
      status: evidence.applicationStatus,
      json: { error: evidence.error },
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Design tools" })
    .getByRole("button", { name: /Border Image/ })
    .click();
  await page.getByRole("button", { name: /From a sketch/ }).click();
  await page
    .locator(".sketch-panel input[type=file]")
    .setInputFiles("tests/fixtures/sketch-reference.png");
  for (const [key, value] of Object.entries(evidence.expectedCrop)) {
    await page
      .getByLabel(`Crop ${key}`, { exact: true })
      .evaluate((element, value) => {
        const input = element as HTMLInputElement;
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, String(value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
  }
  const before = await Promise.all(
    ["x", "y", "width", "height"].map((key) =>
      page.getByLabel(`Crop ${key}`, { exact: true }).inputValue(),
    ),
  );
  await page.getByRole("button", { name: /Find frame & suggest CSS/ }).click();
  await expect(page.getByRole("alert")).toContainText(evidence.error);
  await expect(
    page.getByRole("button", { name: /Find frame & suggest CSS/ }),
  ).toBeEnabled();
  await expect(page.locator(".crop-advice")).toHaveCount(0);
  for (const [index, key] of ["x", "y", "width", "height"].entries())
    await expect(page.getByLabel(`Crop ${key}`, { exact: true })).toHaveValue(
      before[index],
    );
  expect(requests).toBe(1);
  await page.getByRole("button", { name: /Crop & open/ }).click();
  await expect(page.locator(".source-row strong")).toHaveText(
    "border-crop.png",
  );
  await expect(page.locator(".source-image img")).toHaveJSProperty(
    "naturalWidth",
    Math.max(1, Math.round(Number(before[2]) * 10)),
  );
  await expect(page.locator(".source-image img")).toHaveJSProperty(
    "naturalHeight",
    Math.max(1, Math.round(Number(before[3]) * 6.4)),
  );
  await expect(page.locator(".suggestion")).toHaveCount(0);
  await expect(page.locator(".css-panel pre")).toContainText(
    'url("border-crop.png")',
  );
  expect(requests).toBe(1);
});
