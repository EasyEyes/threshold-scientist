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
  const errors = page.locator(".alert-card");
  await expect(errors).toHaveCount(5);
  for (const card of await errors.all()) {
    const fields = await card.evaluate((el) =>
      [...el.children].map((child) => child.className),
    );
    expect(fields[0]).toBe("alert-parameters");
    expect(fields[fields.length - 1]).toBe("alert-hint");
    await expect(card.locator(".alert-parameters")).not.toContainText(
      "PARAMETER",
    );
  }

  await expect(errors.first()).toHaveCSS("border-top-style", "solid");
  // Bootstrap's `.table > :not(caption) > * > *` cell rule must not add
  // vertical padding to the diagnostic sections.
  for (const section of await errors
    .locator(".alert-flex, .alert-message, .alert-hint, .alert-parameters")
    .all()) {
    await expect(section).toHaveCSS("padding", "0px");
  }
  for (const replacement of ["_online2PayCurrencyCode", "fontDirection"]) {
    const error = errors.filter({
      has: page.locator(".alert-hint", {
        hasText: `Use ${replacement} instead.`,
      }),
    });
    await expect(error.locator(".alert-name")).toHaveText(
      "Parameter is obsolete",
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
  const auditWarning = page.locator(".alert-card-warning").filter({
    hasText: "Glossary parameter not audited as used",
  });
  await expect(auditWarning).toContainText(
    "defined in the Parameter Glossary, but no source usage was detected",
  );
  await expect(
    auditWarning.getByRole("link", { name: "font", exact: true }).first(),
  ).toHaveAttribute("href", /range=A\d+:B\d+/);
  expect(await errors.allTextContents()).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/internal-audit-id|2026-11-12|Removed from/),
    ]),
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
  const errors = page.locator(".alert-card");
  await expect(errors).toHaveCount(5);
  const dismiss = page
    .getByRole("button", { name: "Dismiss error message" })
    .first();
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(errors).toHaveCount(4);
});

test("diagnostic values are legible and reflow without horizontal overflow", async ({
  page,
}) => {
  await page.route("**/.netlify/functions/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  for (const mode of ["default", "320px", "200%", "spacing"]) {
    await page.setViewportSize({
      width: mode === "320px" ? 320 : 1280,
      height: 900,
    });
    await page.goto("/compiler/?glossaryDiagnostics=1");
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
    const error = page
      .locator(".alert-card")
      .filter({ hasText: "Parameter contains values of the wrong type" });
    await expect(error).toHaveCount(1);
    await expect(error).toHaveAttribute("role", "alert");
    const hint = error.locator(".alert-hint");
    await expect(hint).toContainText("HINT: The erroneous value is:");
    // One multicategorical cell remains one semantic/highlighted value.
    const supplied = hint.locator(".alert-value");
    await expect(supplied).toHaveCount(1);
    await expect(supplied).toHaveText("Cgrome, Firefox, Edge");
    expect(await supplied.evaluate((el) => el.tagName)).toBe("CODE");
    const accessibleText = await error.ariaSnapshot();
    expect(accessibleText).toContain("HINT: The erroneous value is:");
    expect(accessibleText).toContain("Cgrome, Firefox, Edge");
    if (mode === "default") {
      const css = await supplied.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fontSize: s.fontSize,
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          whiteSpace: s.whiteSpace,
          overflowWrap: s.overflowWrap,
        };
      });
      expect(css).toEqual({
        fontSize: "15px",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        fontWeight: "600",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      });
      const link = error
        .getByRole("link", { name: "_needBrowser", exact: true })
        .first();
      await link.focus();
      await expect(link).toHaveCSS("outline-style", "solid");
      await expect(link).toHaveCSS("outline-width", "3px");
    }
    const noOverflow = await error.evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const values = [...card.querySelectorAll(".alert-value")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent,
          left: r.left,
          right: r.right,
          inside: r.left >= cardRect.left - 1 && r.right <= cardRect.right + 1,
        };
      });
      const result =
        card.scrollWidth <= card.clientWidth + 1 &&
        values.every((v) => v.inside);
      return {
        result,
        cardWidth: card.clientWidth,
        cardScrollWidth: card.scrollWidth,
        cardLeft: cardRect.left,
        cardRight: cardRect.right,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        values,
      };
    });
    if (!noOverflow.result) console.log(mode, noOverflow);
    expect({ mode, noOverflow: noOverflow.result }).toEqual({
      mode,
      noOverflow: true,
    });
  }
});
