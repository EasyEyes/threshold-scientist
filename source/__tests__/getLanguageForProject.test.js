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
  parseExperimentPhrasesColumnNameFromSource,
  getGitlabBodyForExperimentLanguage,
  getLanguageForProject,
  getLanguageInfoForProject,
  DEFAULT_EXPERIMENT_LANGUAGE,
} = require("../../threshold/preprocess/gitlabUtils");

describe("parseExperimentPhrasesColumnNameFromSource", () => {
  it("reads the _phrasesColumnName string from experimentLanguage.js", () => {
    expect(
      parseExperimentPhrasesColumnNameFromSource(
        'const experimentLanguage = "it";\nconst experimentLanguageDirection = "ltr";\nconst experimentPhrasesColumnName = "Italian_v2";',
      ),
    ).toBe("Italian_v2");
  });

  it("returns an empty string for studies compiled before the field existed", () => {
    expect(
      parseExperimentPhrasesColumnNameFromSource(
        'const experimentLanguage = "it";\nconst experimentLanguageDirection = "ltr";',
      ),
    ).toBe("");
    expect(parseExperimentPhrasesColumnNameFromSource("")).toBe("");
  });

  it("round-trips what getGitlabBodyForExperimentLanguage writes", () => {
    const [action] = getGitlabBodyForExperimentLanguage("ar", "rtl", "A'");
    expect(action.file_path).toBe("js/experimentLanguage.js");
    expect(parseExperimentLanguageFromSource(action.content)).toBe("ar");
    expect(parseExperimentPhrasesColumnNameFromSource(action.content)).toBe(
      "A'",
    );
  });
});

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

describe("getLanguageInfoForProject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns both _language and _phrasesColumnName stored in the repo", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue({
      apiRequest: jest.fn().mockResolvedValue({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue(
            'const experimentLanguage = "pt-BR";\nconst experimentLanguageDirection = "ltr";\nconst experimentPhrasesColumnName = "Portuguese";',
          ),
      }),
    });

    await expect(
      getLanguageInfoForProject({ username: "ada" }, "study"),
    ).resolves.toEqual({ language: "pt-BR", phrasesColumnName: "Portuguese" });
  });

  it("returns defaults when experimentLanguage.js is missing", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue({
      apiRequest: jest.fn().mockResolvedValue({ ok: false }),
    });

    await expect(
      getLanguageInfoForProject({ username: "ada" }, "study"),
    ).resolves.toEqual({ language: "en", phrasesColumnName: "" });
  });
});
