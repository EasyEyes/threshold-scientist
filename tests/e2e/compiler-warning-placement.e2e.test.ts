import { expect, test } from "@playwright/test";

const contrastRatio = (foreground, background) => {
  const luminance = (rgb) => {
    const channels = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map((value) => Number(value) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

test("compile warnings appear below the study controls on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/compiler/?warnings=1");
  const summary = page.locator(".compiler-diagnostics");
  await expect(summary).toHaveAttribute("role", "group");
  await expect(summary).toBeFocused();
  const warning = page.locator(".compiler-diagnostic-warning");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(warning).toContainText("⚠️ Warning: 1 missing phrase");
    await expect(warning).toContainText("Can I run the study? Yes");
    await expect(warning).toContainText("Report the problem.");
    await expect(warning.locator(".error-name")).toHaveCSS("font-size", "18px");
    await expect(warning.locator(".error-message")).toHaveCSS(
      "font-size",
      "16px",
    );
    await expect(warning.locator(".diagnostic-section").first()).toHaveCSS(
      "display",
      "block",
    );
    await expect(warning).not.toContainText("HINT:");
    const colors = await warning.evaluate((element) => ({
      foreground: getComputedStyle(element.querySelector(".error-name")).color,
      background: getComputedStyle(element).backgroundColor,
    }));
    expect(
      contrastRatio(colors.foreground, colors.background),
    ).toBeGreaterThanOrEqual(4.5);
    await expect(
      page.locator(
        ".compile-warning-item, .error-warning, .error-card.warning",
      ),
    ).toHaveCount(0);
    const warningBox = await warning.boundingBox();
    expect(warningBox).not.toBeNull();
    for (const button of await page
      .getByTestId("running-actions")
      .getByRole("button")
      .all()) {
      // The dismiss x lives inside the warnings box itself; every study
      // control must still precede the box.
      const insideWarnings = await button.evaluate(
        (element) => element.closest(".compiler-diagnostics") !== null,
      );
      if (insideWarnings) continue;
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

test("warning text reflows at 320px, 200% text size, and WCAG spacing overrides", async ({
  page,
}) => {
  const warning = page.locator(".compiler-diagnostic-warning");
  for (const mode of ["320px", "200%", "spacing"]) {
    await page.setViewportSize({
      width: mode === "200%" ? 1280 : 320,
      height: 1000,
    });
    await page.goto("/compiler/?warnings=1");
    if (mode === "200%")
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
    if (mode === "spacing")
      await page.addStyleTag({
        content: `
          * {
            line-height: 1.5em !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
          }
          p + p { margin-top: 2em !important; }
        `,
      });
    await expect(warning).toBeVisible();
    const bounds = await warning.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        overflow: element.scrollWidth > element.clientWidth + 1,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(mode === "200%" ? 1280 : 320);
    expect(bounds.overflow).toBe(false);
    await expect(warning.locator(".error-name")).toBeVisible();
    await expect(warning.locator(".error-message")).toBeVisible();
  }
});

test("warning cards dismiss with the shared x, like error and success cards", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/compiler/?warnings=1");
  const warning = page.locator(".compiler-diagnostic-warning");
  await expect(warning).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss warning message" }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.locator(".compiler-diagnostics")).toHaveCount(0);
  expect(errors).toEqual([]);
});
