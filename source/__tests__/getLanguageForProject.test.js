jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "test", redirectUri: "http://test" }),
}));

jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: {
    loadFromStorage: jest.fn(),
  },
}));

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
}));

const {
  GitLabOAuthClient,
} = require("../../threshold/preprocess/auth/gitlabOAuthClient");
const {
  searchProjectByName,
} = require("../../threshold/preprocess/gitlabSearch");
const {
  parseExperimentLanguageFromSource,
  getLanguageForProject,
  DEFAULT_EXPERIMENT_LANGUAGE,
} = require("../../threshold/preprocess/gitlabUtils");

describe("parseExperimentLanguageFromSource", () => {
  it("reads the language string from experimentLanguage.js", () => {
    expect(
      parseExperimentLanguageFromSource(
        'const experimentLanguage = "ar";\nconst experimentLanguageDirection = "rtl";',
      ),
    ).toBe("ar");
  });

  it("keeps language codes that are longer than two letters", () => {
    expect(
      parseExperimentLanguageFromSource(
        'const experimentLanguage = "zh-Hans";\nconst experimentLanguageDirection = "ltr";',
      ),
    ).toBe("zh-Hans");
  });

  it("falls back to the glossary default when the file has no language", () => {
    expect(parseExperimentLanguageFromSource("")).toBe(
      DEFAULT_EXPERIMENT_LANGUAGE,
    );
    expect(parseExperimentLanguageFromSource('const other = "nope";')).toBe(
      DEFAULT_EXPERIMENT_LANGUAGE,
    );
  });
});

describe("getLanguageForProject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the language stored in the Pavlovia repo", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue({
      apiRequest: jest.fn().mockResolvedValue({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue('const experimentLanguage = "pt-BR";'),
      }),
    });

    await expect(
      getLanguageForProject({ username: "ada" }, "study"),
    ).resolves.toBe("pt-BR");
  });

  it("returns the default when experimentLanguage.js is missing", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue({
      apiRequest: jest.fn().mockResolvedValue({ ok: false }),
    });

    await expect(
      getLanguageForProject({ username: "ada" }, "study"),
    ).resolves.toBe("en");
  });
});
