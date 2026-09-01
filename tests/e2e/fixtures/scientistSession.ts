import { expect, Page } from "@playwright/test";

export const selectStudy = async (page: Page, name: string) => {
  await page
    .getByLabel("Selected compiled study")
    .selectOption({ label: name });
};

export const expectRunnableActions = async (page: Page) => {
  const run = page.getByRole("button", { name: "Run", exact: true });
  const create = page.getByRole("button", {
    name: "Create Prolific study to run online",
  });
  await expect(run).toBeVisible();
  await expect(create).toBeVisible();
};

export const repositoryState = (page: Page, repositoryId: string) =>
  page.evaluate((id) => window.__EASYEYES_E2E__.repositories[id], repositoryId);

declare global {
  interface Window {
    __EASYEYES_E2E__: {
      repositories: Record<
        string,
        { files: Record<string, string>; commits: object[] }
      >;
    };
  }
}
