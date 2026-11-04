import { test, expect } from "@playwright/test";

test("PDF handout opens an isolated print view for the current design", async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    window.print = () =>
      document.body.setAttribute("data-print-requested", "true");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "PDF handout", exact: true }).click();
  const iframe = page.locator('iframe[title="Printable design"]');
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-modals");
  const handout = page.frameLocator('iframe[title="Printable design"]');
  await expect(handout.locator(".fe-page")).toBeVisible();
  await handout.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(handout.locator("body")).toHaveAttribute(
    "data-print-requested",
    "true",
  );

  // Headless Chromium cannot operate the system print dialog. Render the same document directly for layout QA.
  const print = await context.newPage();
  await print.setContent((await iframe.getAttribute("srcdoc"))!);
  await print.emulateMedia({ media: "print" });
  await expect(
    print.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeHidden();
  await print.pdf({
    path: info.outputPath("handout.pdf"),
    format: "A4",
    printBackground: true,
  });
  await print.close();
});
