import { expect, Page, test } from "@playwright/test";
import {
  expectRunnableActions,
  repositoryState,
  selectStudy,
} from "./fixtures/scientistSession";

const actionArea = (page: Page) => page.getByTestId("running-actions");
let unexpectedBrowserErrors: string[];

test.beforeEach(async ({ page }) => {
  unexpectedBrowserErrors = [];
  page.on("pageerror", (error) => unexpectedBrowserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      unexpectedBrowserErrors.push(message.text());
  });
  await page.route("https://app.prolific.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Prolific fake",
    }),
  );
  await page.goto("/compiler/");
});

test.afterEach(() => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("newly compiled study shows stable, preparing, and ready states", async ({
  page,
}) => {
  let releaseDraft!: () => void;
  const release = new Promise<void>((resolve) => (releaseDraft = resolve));
  let draftPayload: Record<string, unknown> | undefined;
  await page.route("**/.netlify/functions/prolific/studies/", async (route) => {
    draftPayload = route.request().postDataJSON();
    await release;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "new-study-123", status: "UNPUBLISHED" }),
    });
  });

  await expectRunnableActions(page);
  await expect(actionArea(page)).toHaveScreenshot("runnable-create.png");

  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Create Prolific study to run online" })
    .click();
  const popup = await popupPromise;
  const preparing = page.getByRole("button", {
    name: "Preparing Prolific study…",
  });
  await expect(preparing).toBeDisabled();
  await expect(actionArea(page)).toHaveScreenshot("preparing.png");

  releaseDraft();
  await expect(
    page.getByRole("button", { name: "Open Prolific study" }),
  ).toBeVisible();
  await expect(popup).toHaveURL(/new-study-123$/);
  await expect(actionArea(page)).toHaveScreenshot("ready.png");
  expect(draftPayload).toMatchObject({
    name: "Newly compiled study",
    total_available_places: 20,
  });
  const repository = await repositoryState(page, "newlyCompiled");
  expect(repository.files["ProlificStudyId.txt"]).toBe("new-study-123");
});

test("reopening a study with an ID opens it without creating a draft", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/.netlify/functions/prolific/studies/", (route) => {
    posts += 1;
    return route.abort();
  });
  await selectStudy(page, "Study with existing ID");
  await expectRunnableActions(page);
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Create Prolific study to run online" })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/existing-123$/);
  expect(posts).toBe(0);
  expect((await repositoryState(page, "existing")).commits).toHaveLength(0);
});

test("reopening without an ID uses the selected repository config", async ({
  page,
}) => {
  let payload: Record<string, unknown> | undefined;
  await page.route("**/.netlify/functions/prolific/studies/", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "study-b-123", status: "UNPUBLISHED" }),
    });
  });
  await selectStudy(page, "Study without ID");
  await expectRunnableActions(page);
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Create Prolific study to run online" })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/study-b-123$/);
  expect(payload).toMatchObject({
    name: "Selected study B",
    external_study_url: expect.stringContaining("run.invalid/study-b"),
  });
  const repository = await repositoryState(page, "missing");
  expect(repository.files["recruitmentServiceConfig.csv"]).toContain(
    "Prolific",
  );
  expect(repository.files["ProlificStudyId.txt"]).toBe("study-b-123");
});

test("switching studies does not reuse a prepared ID", async ({ page }) => {
  await selectStudy(page, "Study with existing ID");
  const firstPopup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Create Prolific study to run online" })
    .click();
  await firstPopup;
  await expect(
    page.getByRole("button", { name: "Open Prolific study" }),
  ).toBeVisible();

  await selectStudy(page, "Study without ID");
  await expect(
    page.getByRole("button", { name: "Create Prolific study to run online" }),
  ).toBeVisible();
});

test("legacy study reports unavailable settings without mutation", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/.netlify/functions/prolific/studies/", (route) => {
    posts += 1;
    return route.abort();
  });
  await selectStudy(page, "Legacy study");
  await expectRunnableActions(page);
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Create Prolific study to run online" })
    .click();
  const popup = await popupPromise;
  await expect.poll(() => popup.isClosed()).toBe(true);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Prolific study settings unavailable");
  await expect(dialog).toHaveScreenshot("legacy-settings-unavailable.png");
  expect(posts).toBe(0);
  expect((await repositoryState(page, "legacy")).commits).toHaveLength(0);
});

test("unavailable study hides both actions", async ({ page }) => {
  await selectStudy(page, "Unavailable study");
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Prolific study to run online/ }),
  ).toHaveCount(0);
});
