import { expect, test } from "@playwright/test";

test("compile warnings appear below the study controls on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/compiler/?warnings=1");
  const warning = page.locator(".compile-warnings");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(warning).toContainText("⚠️ WARNING: 1 missing phrase");
    await expect(warning).toContainText("CAN I RUN THE STUDY? Yes");
    await expect(warning).toContainText("REPORT THE PROBLEM.");
    await expect(warning).not.toContainText("HINT:");
    const warningBox = await warning.boundingBox();
    expect(warningBox).not.toBeNull();
    for (const button of await page
      .getByTestId("running-actions")
      .getByRole("button")
      .all()) {
      const box = await button.boundingBox();
      if (box) expect(warningBox!.y).toBeGreaterThanOrEqual(box.y + box.height);
    }
    await page.screenshot({
      path: `/tmp/easyeyes-warning-placement-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Selected compiled study").selectOption("missing");
  await expect(warning).toHaveCount(0);
  expect(errors).toEqual([]);
});
