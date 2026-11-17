import { expect, test } from "@playwright/test";

test("compiler errors show Glossary replacements and useful spelling suggestions", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/.netlify/functions/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: "{}",
    }),
  );
  await page.goto("/compiler/?glossaryDiagnostics=1");
  const errors = page.locator(".compiler-diagnostic");
  await expect(errors).toHaveCount(5);
  await expect(errors.first()).toHaveCSS("border-top-style", "solid");
  for (const replacement of ["_online2PayCurrencyCode", "fontDirection"]) {
    const error = errors.filter({
      has: page.locator(".error-hint", {
        hasText: `Use ${replacement} instead.`,
      }),
    });
    await expect(error.locator(".error-message")).toHaveText(
      "This parameter is obsolete and must be replaced or removed.",
    );
    await expect(error.locator(".error-hint")).toHaveText(
      `HINT: Use ${replacement} instead.`,
    );
    await expect(error.locator(".error-name")).toHaveText(
      "Compiler error: Parameter is obsolete",
    );
    await expect(
      error.getByRole("link", { name: replacement, exact: true }),
    ).toHaveAttribute("href", /range=A\d+:B\d+/);
  }
  await expect(
    errors.filter({ hasText: "Parameter is unrecognized" }),
  ).toContainText("not defined in the Parameter Glossary");
  await expect(
    errors
      .filter({ hasText: "Parameter is unrecognized" })
      .getByRole("link", { name: "fontDirection", exact: true }),
  ).toBeVisible();
  await expect(
    errors.filter({ hasText: "Glossary parameter not audited as used" }),
  ).toContainText(
    "defined in the Parameter Glossary, but no source usage was detected",
  );
  expect(await errors.allTextContents()).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/internal-audit-id|2026-11-12|Removed from/),
    ]),
  );
  const glossaryAudit = errors.filter({
    hasText: "Glossary parameter not audited as used",
  });
  await expect(glossaryAudit.locator(".diagnostic-section strong")).toHaveText([
    "Can I run the study?",
    "Report the problem.",
  ]);
  const phraseAudit = errors.filter({
    hasText: "International phrase not audited as used",
  });
  await expect(phraseAudit.locator(".diagnostic-section strong")).toHaveText([
    "Can I run the study?",
    "Audit evidence.",
  ]);
  await expect(phraseAudit.locator(".error-hint")).toHaveText(
    "HINT: Check the phrase name and the latest International Phrases audit.",
  );
  expect(pageErrors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("glossary-diagnostics.png"),
    fullPage: true,
  });
});

test("compiler diagnostics can be dismissed from the keyboard", async ({
  page,
}) => {
  await page.goto("/compiler/?glossaryDiagnostics=1");
  const errors = page.locator(".compiler-diagnostic");
  await expect(errors).toHaveCount(5);
  const dismiss = page
    .getByRole("button", { name: "Dismiss error message" })
    .first();
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(errors).toHaveCount(4);
});
