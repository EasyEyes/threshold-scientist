/**
 * Referenced repo assembly (issue #174): when a compile produced engine
 * output (userRepoFiles.compiledFiles), the upload flow writes those files
 * verbatim and commits NO copied runtime bundle — no threshold.min.js, no
 * wasm, no models/ — and performs no no-cache fetches. The legacy copy
 * flow is untouched when no compiled output is present.
 */
jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
  getTitle: jest.fn(() => null),
}));

// A small stand-in for the legacy copied-bundle manifest.
jest.mock("../../threshold/preprocess/files", () => ({
  _loadFiles: [
    "index.html",
    "js/threshold.min.js",
    "recruitmentServiceConfig.csv",
  ],
  _loadDir: "/compiler/threshold/",
}));

jest.mock("../../threshold/preprocess/fileUtils", () => ({
  assetUsesBase64: jest.fn(() => false),
  getAssetFileContent: jest.fn().mockResolvedValue("static-asset-content"),
  getAssetFileContentBase64: jest.fn().mockResolvedValue("YmFzZTY0"),
  getFileTextData: jest.fn().mockResolvedValue("file-text"),
  readXLSXFile: jest.fn().mockResolvedValue("[]"),
}));

jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "test", redirectUri: "http://test" }),
}));

jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn() },
}));

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn().mockResolvedValue({ id: 42 }),
  searchProjectsByName: jest.fn(),
}));

const setupGitlabClient = () => {
  const {
    GitLabOAuthClient,
  } = require("../../threshold/preprocess/auth/gitlabOAuthClient");
  const apiRequest = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({}),
    headers: { get: jest.fn(() => null) },
    text: jest.fn().mockResolvedValue(""),
  });
  GitLabOAuthClient.loadFromStorage.mockReturnValue({
    apiRequest,
    getAccessToken: jest.fn(() => "token"),
    ensureValidToken: jest.fn().mockResolvedValue(undefined),
  });
  return apiRequest;
};

const resetUserRepoFiles = (overrides = {}) => {
  const { userRepoFiles } = require("../../threshold/preprocess/constants");
  Object.assign(userRepoFiles, {
    experiment: null,
    blockFiles: [],
    requestedForms: [],
    requestedFonts: [],
    requestedTexts: [],
    requestedFolders: [],
    requestedImages: [],
    requestedCode: [],
    requestedImpulseResponses: [],
    requestedFrequencyResponses: [],
    requestedTargetSoundLists: [],
    requestedPhrases: [],
    compiledFiles: undefined,
    ...overrides,
  });
  return userRepoFiles;
};

describe("gatherCompiledFileActions", () => {
  it("writes engine files verbatim: text as text, bytes as base64", () => {
    const {
      gatherCompiledFileActions,
    } = require("../../threshold/preprocess/gitlabUtils");

    const actions = gatherCompiledFileActions([
      { path: "conditions/block_1.csv", content: "block,1" },
      { path: "logo.png", content: new Uint8Array([1, 2, 3]) },
    ]);

    expect(actions).toEqual([
      {
        action: "create",
        file_path: "conditions/block_1.csv",
        content: "block,1",
        encoding: "text",
      },
      {
        action: "create",
        file_path: "logo.png",
        content: Buffer.from([1, 2, 3]).toString("base64"),
        encoding: "base64",
      },
    ]);
  });
});

describe("_createExperimentTask_uploadFiles — referenced flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // setExperimentSaveFormat PUTs to the GitLab API with global fetch,
    // which this jsdom lacks.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(""),
    });
    // setExperimentSaveFormat consults the glossary for defaults.
    const {
      initGlossary,
    } = require("../../threshold/parameters/glossaryRegistry");
    initGlossary({
      version: "1",
      glossary: {
        _pavlovia_Database_ResultsFormatBool: { default: "FALSE" },
      },
      glossaryFull: [],
      superMatchingParams: [],
    });
  });

  const runUpload = async () => {
    const {
      _createExperimentTask_uploadFiles,
    } = require("../../threshold/preprocess/gitlabUtils");
    const apiRequest = setupGitlabClient();
    const user = {
      id: 1,
      username: "alice",
      accessToken: "token",
      currentExperiment: { participantRecruitmentServiceName: "" },
    };
    const ok = await _createExperimentTask_uploadFiles(
      user,
      { id: 7, path: "exp" },
      false,
      null,
      [],
      jest.fn(),
    );
    expect(ok).toBe(true);
    // Collect every action pushed across all commit calls.
    const pushed = apiRequest.mock.calls
      .map(([, options]) => options)
      .filter((options) => options?.body)
      .flatMap((options) => JSON.parse(options.body).actions ?? []);
    return { pushed };
  };

  it("commits the engine's compiled files verbatim and no copied runtime bundle", async () => {
    resetUserRepoFiles({
      compiledFiles: [
        { path: "exp.csv", content: "a,b" },
        { path: "conditions/block_1.csv", content: "block,1" },
        { path: "index.html", content: "<html>entry</html>" },
        { path: "coi-serviceworker.js", content: "// bridge" },
      ],
    });

    const { pushed } = await runUpload();
    const paths = pushed.map((a) => a.file_path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "exp.csv",
        "conditions/block_1.csv",
        "index.html",
        "coi-serviceworker.js",
        "recruitmentServiceConfig.csv",
      ]),
    );
    expect(paths).not.toContain("js/threshold.min.js");
  });

  it("commits the resolved release as a small pinned-metadata file (issue #177)", async () => {
    resetUserRepoFiles({
      compiledFiles: [{ path: "exp.csv", content: "a,b" }],
      releasePin: { release: "2026.7.8", contractVersion: 1 },
    });

    const { pushed } = await runUpload();
    const pin = pushed.find((a) => a.file_path === "ReleasePin.txt");

    expect(pin).toBeDefined();
    expect(JSON.parse(pin.content)).toEqual({
      release: "2026.7.8",
      contractVersion: 1,
    });
  });

  it("performs no no-cache fetches in the referenced flow", async () => {
    const {
      getAssetFileContent,
    } = require("../../threshold/preprocess/fileUtils");
    resetUserRepoFiles({
      compiledFiles: [{ path: "exp.csv", content: "a,b" }],
    });

    await runUpload();

    for (const call of getAssetFileContent.mock.calls) {
      expect(call[1]?.cache).not.toBe("no-cache");
    }
  });

  it("keeps the legacy copy flow (with its cache band-aid) when there is no compiled output", async () => {
    const {
      getAssetFileContent,
      getFileTextData,
    } = require("../../threshold/preprocess/fileUtils");
    resetUserRepoFiles({
      compiledFiles: undefined,
      experiment: { name: "exp.csv" },
    });

    const { pushed } = await runUpload();
    const paths = pushed.map((a) => a.file_path);

    // The copied bundle is committed …
    expect(paths).toContain("js/threshold.min.js");
    // … with the no-cache band-aid for build outputs.
    const noCacheCalls = getAssetFileContent.mock.calls.filter(
      (call) => call[1]?.cache === "no-cache",
    );
    expect(noCacheCalls.length).toBeGreaterThan(0);
    // And the user-uploaded experiment table still flows through.
    expect(getFileTextData).toHaveBeenCalled();
  });
});
