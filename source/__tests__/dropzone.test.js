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

// Controllable JSZip mock: tests set mockZipFiles to a { filename: contents }
// map; loadAsync yields a zip whose entries return those contents.
let mockZipFiles = {};
jest.mock(
  "jszip",
  () =>
    class {
      loadAsync() {
        const files = {};
        for (const name of Object.keys(mockZipFiles)) {
          files[name] = {
            async: async () => mockZipFiles[name],
          };
        }
        return Promise.resolve({ files });
      }
    },
);

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
  mockZipFiles = {};

  // Swal.fire must invoke didOpen so the async body runs in tests
  const Swal = require("sweetalert2").default;
  Swal.fire.mockImplementation(async (opts) => {
    if (opts.didOpen) await opts.didOpen();
  });

  // Reset mutable state on the real userRepoFiles object
  const { userRepoFiles } = require("../../threshold/preprocess/constants");
  userRepoFiles.phrases = [];
  userRepoFiles.requestedPhrases = [];
  userRepoFiles.impulseResponses = [];
  userRepoFiles.frequencyResponses = [];
  userRepoFiles.targetSoundLists = [];
  userRepoFiles.experiment = null;
});

// ── Cycle 1: translatePhraseFileApi is called for a phrase file ───────────────

describe("handleDrop — phrase file detected", () => {
  it("calls translatePhraseFileApi for a *.phrases.xlsx file", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    const translatedFile = new File(["translated"], "MyStudy.phrases.xlsx");
    translatePhraseFileApi.mockResolvedValue(translatedFile);

    const phraseFile = new File(["original"], "MyStudy.phrases.xlsx");

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

  it("stores the translated file in userRepoFiles.phrases, not the original", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    const translatedFile = new File(["t"], "DenisLanguage.phrases.xlsx");
    translatePhraseFileApi.mockResolvedValue(translatedFile);

    const originalFile = new File(["orig"], "DenisLanguage.phrases.xlsx");

    await handleDrop(
      MOCK_USER,
      [originalFile],
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    expect(userRepoFiles.phrases).toHaveLength(1);
    expect(userRepoFiles.phrases[0]).toBe(translatedFile);
    expect(userRepoFiles.phrases[0]).not.toBe(originalFile);
  });
});

// ── isPhraseFile predicate: detection by *.phrases.xlsx filename ──────────────

describe("isPhraseFile — filename detection", () => {
  it("recognises a *.phrases.xlsx file by its name", () => {
    const { isPhraseFile } = require("../components/dropzone");
    expect(isPhraseFile(new File([], "DenisLanguage.phrases.xlsx"))).toBe(true);
  });
});

// ── Archive wiring: bundled phrase file reaches the store, verbatim ───────────

describe("handleDrop — phrase file inside an export archive", () => {
  it("stores the bundled *.phrases.xlsx in userRepoFiles, without translating it", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const { isExpTableFile } = require("../../threshold/preprocess/utils");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    // The archive holds an experiment table and a phrase library.
    isExpTableFile.mockImplementation((f) => f.name === "study.xlsx");
    mockZipFiles = {
      "study.xlsx": "exp",
      "DenisLanguage.phrases.xlsx": "phrases",
    };

    const archive = new File(["zip"], "study.export.zip");

    await handleDrop(
      MOCK_USER,
      [archive],
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    expect(userRepoFiles.phrases).toHaveLength(1);
    expect(userRepoFiles.phrases[0].name).toBe("DenisLanguage.phrases.xlsx");
    expect(translatePhraseFileApi).not.toHaveBeenCalled();
  });
});

// ── Archive nesting: manually re-zipped exports wrap files in a folder ────────

describe("handleDrop — export archive re-zipped inside a wrapping folder", () => {
  it("flattens entry paths so bundled files keep their bare names", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const { isExpTableFile } = require("../../threshold/preprocess/utils");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    isExpTableFile.mockImplementation((f) => f.name === "study.xlsx");
    // Layout produced by unzipping an export, editing, and re-zipping the
    // enclosing folder (plus typical OS junk entries).
    mockZipFiles = {
      "study.export/": "",
      "study.export/study.xlsx": "exp",
      "study.export/DenisLanguage.phrases.xlsx": "phrases",
      "__MACOSX/study.export/._DenisLanguage.phrases.xlsx": "junk",
      "study.export/.DS_Store": "junk",
    };

    const archive = new File(["zip"], "study.export.zip");
    const handleExperimentFile = jest.fn();

    await handleDrop(
      MOCK_USER,
      [archive],
      jest.fn(),
      handleExperimentFile,
      jest.fn(),
      jest.fn(),
    );

    expect(userRepoFiles.experiment.name).toBe("study.xlsx");
    expect(handleExperimentFile).toHaveBeenCalledWith(userRepoFiles.experiment);
    // The phrase file keeps its bare name, and the __MACOSX copy is ignored
    expect(userRepoFiles.phrases).toHaveLength(1);
    expect(userRepoFiles.phrases[0].name).toBe("DenisLanguage.phrases.xlsx");
    expect(translatePhraseFileApi).not.toHaveBeenCalled();
  });
});

// ── Cycle 3: non-phrase xlsx falls through to generic resources ───────────────

describe("handleDrop — non-phrase xlsx unaffected", () => {
  it("routes an xlsx with no requestedPhrases match to createOrUpdateCommonResources", async () => {
    const { handleDrop } = require("../components/dropzone");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const {
      createOrUpdateCommonResources,
    } = require("../../threshold/preprocess/gitlabUtils");
    const { translatePhraseFileApi } = require("../components/phraseFileApi");

    // requestedPhrases is empty — no phrase file expected
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
    expect(userRepoFiles.phrases).toHaveLength(0);
    expect(createOrUpdateCommonResources).toHaveBeenCalledWith(
      MOCK_USER,
      expect.arrayContaining([genericXlsx]),
    );
  });
});
