// Mocks must be declared before imports (jest hoists them)

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: jest.fn(),
    showLoading: jest.fn(),
    close: jest.fn(),
  },
}));

jest.mock("../../threshold/preprocess/auth/ensureValidToken", () => ({
  ensureValidToken: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../threshold/preprocess/fileUtils", () => ({
  getFileExtension: jest.fn((f) => f.name.split(".").pop()),
  isAcceptableExtension: jest.fn().mockReturnValue(true),
  isValidateFileName: jest.fn().mockReturnValue(true),
}));

jest.mock("../../threshold/preprocess/utils", () => ({
  isExpTableFile: jest.fn().mockReturnValue(false),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  createOrUpdateCommonResources: jest.fn().mockResolvedValue(undefined),
  getCommonResourcesNames: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../threshold/preprocess/user", () => ({
  redirectToOauth2: jest.fn(),
}));

jest.mock("../components/phraseFileApi", () => ({
  translatePhraseFileApi: jest.fn(),
}));

jest.mock("jszip", () => class {});

const MOCK_USER = { accessToken: "token" };

function makeHandleDropArgs(overrides = {}) {
  return [
    MOCK_USER,
    [],
    jest.fn(), // addResourcesForApp
    jest.fn(), // handleExperimentFile
    jest.fn(), // handleArchiveBool
    jest.fn(), // handleArchiveZip
    ...Object.values(overrides),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();

  // Swal.fire must invoke didOpen so the async body runs in tests
  const Swal = require("sweetalert2").default;
  Swal.fire.mockImplementation(async (opts) => {
    if (opts.didOpen) await opts.didOpen();
  });

  // Reset mutable state on the real userRepoFiles object
  const { userRepoFiles } = require("../../threshold/preprocess/constants");
  userRepoFiles.phraseFiles = [];
  userRepoFiles.requestedPhraseFiles = [];
  userRepoFiles.impulseResponses = [];
  userRepoFiles.frequencyResponses = [];
  userRepoFiles.targetSoundLists = [];
  userRepoFiles.experiment = null;
});

// ── Cycle 1: translatePhraseFileApi is called for a phrase file ───────────────

describe("handleDrop — phrase file detected", () => {
  it("calls translatePhraseFileApi when filename matches requestedPhraseFiles[0]", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    userRepoFiles.requestedPhraseFiles = ["MyPhrases.xlsx"];
    const translatedFile = new File(["translated"], "MyPhrases.xlsx");
    translatePhraseFileApi.mockResolvedValue(translatedFile);

    const phraseFile = new File(["original"], "MyPhrases.xlsx");

    await handleDrop(
      MOCK_USER,
      [phraseFile],
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    expect(translatePhraseFileApi).toHaveBeenCalledWith(phraseFile);
  });

  // ── Cycle 2: translated file stored, not the original ─────────────────────

  it("stores the translated file in userRepoFiles.phraseFiles, not the original", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    userRepoFiles.requestedPhraseFiles = ["DenisLanguage.xlsx"];
    const translatedFile = new File(["t"], "DenisLanguage.xlsx");
    translatePhraseFileApi.mockResolvedValue(translatedFile);

    const originalFile = new File(["orig"], "DenisLanguage.xlsx");

    await handleDrop(
      MOCK_USER,
      [originalFile],
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    expect(userRepoFiles.phraseFiles).toHaveLength(1);
    expect(userRepoFiles.phraseFiles[0]).toBe(translatedFile);
    expect(userRepoFiles.phraseFiles[0]).not.toBe(originalFile);
  });
});

// ── Cycle 3: non-phrase xlsx falls through to generic resources ───────────────

describe("handleDrop — non-phrase xlsx unaffected", () => {
  it("routes an xlsx with no requestedPhraseFiles match to createOrUpdateCommonResources", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const {
      createOrUpdateCommonResources,
    } = require("../../threshold/preprocess/gitlabUtils");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    // requestedPhraseFiles is empty — no phrase file expected
    const genericXlsx = new File(["data"], "SomeData.xlsx");

    await handleDrop(
      MOCK_USER,
      [genericXlsx],
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    expect(translatePhraseFileApi).not.toHaveBeenCalled();
    expect(userRepoFiles.phraseFiles).toHaveLength(0);
    expect(createOrUpdateCommonResources).toHaveBeenCalledWith(
      MOCK_USER,
      expect.arrayContaining([genericXlsx]),
    );
  });
});
