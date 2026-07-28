import fs from "fs";
import path from "path";
import vm from "vm";

function loadAppsScript(overrides = {}) {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../apps-script/update-phrases.gs"),
    "utf8",
  );
  const context = vm.createContext({ console, ...overrides });
  vm.runInContext(source, context);
  return context;
}

describe("International Phrases Apps Script fatal DeepL errors", () => {
  test("adds the manually selected DeepL failure scenario to a request", () => {
    const context = loadAppsScript();
    context.DEEPL_FAILURE_SCENARIO = "403";

    expect(context.addDeepLFailureScenario({ action: "translate" })).toEqual({
      action: "translate",
      testDeeplFailureScenario: "403",
    });
  });

  test("leaves normal requests unchanged when no failure scenario is selected", () => {
    const context = loadAppsScript();

    expect(context.addDeepLFailureScenario({ action: "translate" })).toEqual({
      action: "translate",
    });
  });

  test("classifies DeepL 403 as fatal with billing guidance", () => {
    const { classifyPhrasesApiFailure } = loadAppsScript();

    expect(
      classifyPhrasesApiFailure(
        JSON.stringify({
          error:
            "DeepL rejected the translation request (status 403). No new phrases version was created.",
          code: "DEEPL_TRANSLATION_FAILED",
          deeplStatus: 403,
          fatal: true,
        }),
      ),
    ).toEqual({
      message:
        "DeepL rejected the translation request (status 403). No new phrases version was created.",
      isFatal: true,
      showDeepLBillingAction: true,
    });
  });

  test("classifies another DeepL failure as fatal without billing guidance", () => {
    const { classifyPhrasesApiFailure } = loadAppsScript();

    expect(
      classifyPhrasesApiFailure(
        JSON.stringify({
          error:
            "DeepL rejected the translation request (status 500). No new phrases version was created.",
          code: "DEEPL_TRANSLATION_FAILED",
          deeplStatus: 500,
          technicalDetail: "Internal error",
          fatal: true,
        }),
      ),
    ).toEqual({
      message:
        "DeepL rejected the translation request (status 500). No new phrases version was created.\n\nTechnical detail: Internal error",
      isFatal: true,
      showDeepLBillingAction: false,
    });
  });

  test("renders a fatal 403 dialog with the account and DeepL billing action", () => {
    let renderedHtml = "";
    let renderedTitle = "";
    const { notify } = loadAppsScript({
      HtmlService: {
        createHtmlOutput: (html) => {
          renderedHtml = html;
          return html;
        },
      },
      SpreadsheetApp: {
        getUi: () => ({
          showModelessDialog: (_html, title) => {
            renderedTitle = title;
          },
        }),
      },
      Logger: { log: jest.fn() },
    });

    notify("DeepL failed.", "error", { showDeepLBillingAction: true });

    expect(renderedTitle).toBe("Fatal error");
    expect(renderedHtml).toContain("Check DeepL billing");
    expect(renderedHtml).toContain("https://www.deepl.com/account");
    expect(renderedHtml).toContain("denis.pelli@gmail.com");
  });
});
