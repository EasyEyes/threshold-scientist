// Mocks must precede any imports that trigger module evaluation.
jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
}));
jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getAllProjects: jest.fn(),
  copyUser: jest.fn((u) => ({ ...u })),
  setRepoName: jest.fn().mockResolvedValue("myExp1"),
  manuallySetSwalTitle: jest.fn(),
  getProjectByNameInProjectList: jest.fn(),
}));
jest.mock("../../threshold/preprocess/fileUtils", () => ({
  getTextFileDataFromGitLab: jest.fn().mockResolvedValue("corpus text"),
}));
jest.mock("../../threshold/preprocess/constants", () => ({
  userRepoFiles: {},
  resourcesRepoName: "EasyEyesResources",
}));
jest.mock("../../threshold/preprocess/main", () => ({
  preprocessExperimentFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../components/dropzone", () => ({ handleDrop: jest.fn() }));
jest.mock("sweetalert2", () => ({
  default: {
    fire: jest.fn().mockResolvedValue({}),
    close: jest.fn(),
    isVisible: jest.fn(() => false),
    showLoading: jest.fn(),
  },
}));
jest.mock("react-dropzone", () => ({
  default: () => null,
}));
jest.mock("../ResourceButton", () => () => null);
jest.mock("../components/Dropdown", () => ({ Dropdown: () => null }));
jest.mock("../css/Table.scss", () => ({}), { virtual: true });

// ─── Cycle 13: Table.handleTable uses searchProjectByName ─────────────────────

describe("Table.handleTable — EasyEyesResources lookup uses searchProjectByName", () => {
  let Table;

  beforeAll(() => {
    Table = require("../Table").default;
  });

  beforeEach(() => jest.clearAllMocks());

  it("calls searchProjectByName(user, resourcesRepoName) for the resources repo", async () => {
    const {
      searchProjectByName,
    } = require("../../threshold/preprocess/gitlabSearch");
    searchProjectByName.mockResolvedValue(null);

    const user = {
      id: "1",
      accessToken: "tok",
      projectList: Promise.resolve([]),
      currentExperiment: { _pavloviaNewExperimentBool: false },
    };

    const instance = new Table({
      user,
      resourcesLoaded: true,
      resources: { texts: [] },
      isCompiledFromArchiveBool: false,
      scrollToCurrentStep: jest.fn(),
      activeExperiment: null,
      projectName: null,
      functions: {
        handleReturnToStep: jest.fn().mockResolvedValue(undefined),
        handleAddResources: jest.fn(),
        handleSetActivateExperiment: jest.fn(),
        handleArchivedExperimentBool: jest.fn(),
        handleZipArchive: jest.fn(),
      },
    });

    // Patch DOM ref and React internals so handleTable can run past the DOM calls
    instance.dropZoneRef = {
      current: { classList: { add: jest.fn(), remove: jest.fn() } },
    };
    instance.setState = jest.fn();

    const file = new File(["id,conditionName\n1,cond1"], "exp.csv", {
      type: "text/csv",
    });

    await instance.handleTable(file);

    expect(searchProjectByName).toHaveBeenCalledWith(user, "EasyEyesResources");
  });

  it("does not call getProjectByNameInProjectList for the resources lookup", async () => {
    const {
      searchProjectByName,
    } = require("../../threshold/preprocess/gitlabSearch");
    const {
      getProjectByNameInProjectList,
    } = require("../../threshold/preprocess/gitlabUtils");
    searchProjectByName.mockResolvedValue(null);

    const user = {
      id: "1",
      accessToken: "tok",
      projectList: Promise.resolve([]),
      currentExperiment: { _pavloviaNewExperimentBool: false },
    };

    const instance = new Table({
      user,
      resourcesLoaded: true,
      resources: { texts: [] },
      isCompiledFromArchiveBool: false,
      scrollToCurrentStep: jest.fn(),
      activeExperiment: null,
      projectName: null,
      functions: {
        handleReturnToStep: jest.fn().mockResolvedValue(undefined),
        handleAddResources: jest.fn(),
        handleSetActivateExperiment: jest.fn(),
        handleArchivedExperimentBool: jest.fn(),
        handleZipArchive: jest.fn(),
      },
    });

    instance.dropZoneRef = {
      current: { classList: { add: jest.fn(), remove: jest.fn() } },
    };
    instance.setState = jest.fn();

    const file = new File(["id,conditionName\n1,cond1"], "exp.csv", {
      type: "text/csv",
    });

    await instance.handleTable(file);

    expect(getProjectByNameInProjectList).not.toHaveBeenCalled();
  });
});
