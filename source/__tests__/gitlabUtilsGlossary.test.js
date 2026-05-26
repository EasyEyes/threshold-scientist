jest.mock("../../threshold/preprocess/files", () => ({
  _loadFiles: ["index.html", "js/threshold.min.js", "js/glossary.js"],
  _loadDir: "/test/",
}));

jest.mock("../../threshold/preprocess/fileUtils", () => ({
  assetUsesBase64: jest.fn(() => false),
  getAssetFileContent: jest.fn().mockResolvedValue("test content"),
  getAssetFileContentBase64: jest.fn().mockResolvedValue("base64content"),
}));

const MOCK_RAW_TEXT =
  'window.GLOSSARY={};window.GLOSSARY_FULL={};window.SUPER_MATCHING_PARAMS=[];';

// ─── getGitlabBodyForGlossary ─────────────────────────────────────────────────

describe("getGitlabBodyForGlossary", () => {
  it("returns a create action for js/glossary.js with the raw text", () => {
    const {
      getGitlabBodyForGlossary,
    } = require("../../threshold/preprocess/gitlabUtils");

    const actions = getGitlabBodyForGlossary(MOCK_RAW_TEXT);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: "create",
      file_path: "js/glossary.js",
      content: MOCK_RAW_TEXT,
      encoding: "text",
    });
  });
});

// ─── getGitlabBodyForThreshold skip guard ─────────────────────────────────────

describe("getGitlabBodyForThreshold", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) });
  });

  it("does not include js/glossary.js in returned actions", async () => {
    const {
      getGitlabBodyForThreshold,
    } = require("../../threshold/preprocess/gitlabUtils");

    const mockUser = { currentExperiment: { _stepperBool: false } };
    const actions = await getGitlabBodyForThreshold(0, 2, mockUser);

    const paths = actions.map((a) => a.file_path);
    expect(paths).not.toContain("js/glossary.js");
  });

  it("includes other files from _loadFiles", async () => {
    const {
      getGitlabBodyForThreshold,
    } = require("../../threshold/preprocess/gitlabUtils");

    const mockUser = { currentExperiment: { _stepperBool: false } };
    const actions = await getGitlabBodyForThreshold(0, 2, mockUser);

    const paths = actions.map((a) => a.file_path);
    expect(paths).toContain("js/threshold.min.js");
  });
});
