import React from "react";
import { render } from "@testing-library/react";
import Table from "../Table";

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../ResourceButton", () => () => null);
jest.mock("../components/Dropdown", () => ({ Dropdown: () => null }));

jest.mock("../components/dropzone", () => ({
  handleDrop: jest.fn(),
}));

jest.mock("../components/glossaryApi", () => ({
  fetchGlossaryData: jest.fn(),
  fetchGlossaryVersion: jest.fn(),
  pinGlossaryVersion: jest.fn().mockResolvedValue({ version: "1.0" }),
}));

jest.mock("../../threshold/parameters/glossaryRegistry", () => ({
  initGlossary: jest.fn(),
  getGlossaryVersion: jest.fn(),
}));

jest.mock("../../threshold/preprocess/main", () => ({
  preprocessExperimentFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../threshold/preprocess/constants", () => ({
  userRepoFiles: {},
  resourcesRepoName: "EasyEyesResources",
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getAllProjects: jest.fn().mockResolvedValue([]),
  copyUser: jest.fn((u) => u),
  setRepoName: jest.fn().mockResolvedValue("project"),
  manuallySetSwalTitle: jest.fn(),
  getProjectByNameInProjectList: jest.fn(() => null),
}));

jest.mock("../../threshold/preprocess/fileUtils", () => ({
  getTextFileDataFromGitLab: jest.fn(),
}));

const mockGlossaryData = {
  version: "2.0",
  glossary: { paramX: { name: "paramX" } },
  glossaryFull: [],
  superMatchingParams: [],
};

function makeProps(overrides = {}) {
  return {
    user: {
      id: undefined,
      username: "user",
      accessToken: "token",
      projectList: Promise.resolve([]),
      initProjectList: jest.fn(),
    },
    resources: { texts: [] },
    resourcesLoaded: true,
    isCompiledFromArchiveBool: false,
    scrollToCurrentStep: jest.fn(),
    functions: {
      handleReturnToStep: jest.fn().mockResolvedValue(undefined),
      handleAddResources: jest.fn(),
      handleArchivedExperimentBool: jest.fn(),
      handleZipArchive: jest.fn(),
      handleSetFilename: jest.fn(),
      handleSetProjectName: jest.fn(),
      handleSetProjectList: jest.fn(),
      handleSetActivateExperiment: jest.fn(),
      handleNextStep: jest.fn(),
      handleUpdateUser: jest.fn(),
    },
    ...overrides,
  };
}

describe("Table.handleTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches and initializes the latest glossary before preprocessing a fresh spreadsheet", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    const { preprocessExperimentFile } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(fetchGlossaryData).toHaveBeenCalledWith("2.0");
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);

    const fetchOrder = fetchGlossaryData.mock.invocationCallOrder[0];
    const initOrder = initGlossary.mock.invocationCallOrder[0];
    const preprocessOrder = preprocessExperimentFile.mock.invocationCallOrder[0];
    expect(fetchOrder).toBeLessThan(initOrder);
    expect(initOrder).toBeLessThan(preprocessOrder);
  });

  it("refreshes the glossary even when compiling from an archive", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    const { preprocessExperimentFile } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps({ isCompiledFromArchiveBool: true })} />);

    await ref.current.handleTable(new File(["a,b"], "exp.export.zip"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
  });

  it("aborts the compile and logs when the glossary refresh fails", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    const { preprocessExperimentFile } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    const fetchError = new Error("network down");
    fetchGlossaryData.mockRejectedValue(fetchError);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(initGlossary).not.toHaveBeenCalled();
    expect(preprocessExperimentFile).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh glossary:",
      fetchError,
    );

    consoleError.mockRestore();
  });

  it("skips the full glossary download when the server version matches the cached version", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    const { preprocessExperimentFile } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).not.toHaveBeenCalled();
    expect(initGlossary).not.toHaveBeenCalled();
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
  });

  it("downloads the full glossary when the server version differs from the cached version", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "3.0" });
    getGlossaryVersion.mockReturnValue("2.0");
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
  });

  it("downloads the full glossary when the version check request fails", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockRejectedValue(new Error("timeout"));
    getGlossaryVersion.mockReturnValue("2.0");
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
  });

  it("downloads the full glossary when there is no cached version", async () => {
    const { fetchGlossaryData, fetchGlossaryVersion } = require("../components/glossaryApi");
    const { initGlossary, getGlossaryVersion } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
  });
});
