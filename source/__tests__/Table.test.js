import React from "react";
import { render, act } from "@testing-library/react";
import Table from "../Table";
import Swal from "sweetalert2";
import { compileExperimentWithEngine } from "../engine/engineCompile";

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../ResourceButton", () => () => null);
jest.mock("../components/Dropdown", () => ({ Dropdown: () => null }));
jest.mock("../components/VersionDropdown", () => ({
  VersionDropdown: jest.fn(() => null),
}));

const mockListReleases = jest.fn().mockResolvedValue([
  { release: "2026-07-08", changelog: "Latest" },
  { release: "2026-03-01", changelog: "Older" },
]);
jest.mock("../engine/releaseManifestClient", () => ({
  createReleaseManifestClient: () => ({
    listReleases: mockListReleases,
  }),
}));

jest.mock("../components/dropzone", () => ({
  handleDrop: jest.fn(),
}));

jest.mock("../components/glossaryApi", () => ({
  fetchGlossaryData: jest.fn(),
  fetchGlossaryVersion: jest.fn(),
  pinGlossaryVersion: jest.fn().mockResolvedValue({ version: "1.0" }),
  getGlossaryPrefetch: jest.fn().mockReturnValue(null),
}));

jest.mock("../../threshold/parameters/glossaryRegistry", () => ({
  initGlossary: jest.fn(),
  getGlossaryVersion: jest.fn(),
}));

jest.mock("../components/phrasesApi", () => ({
  fetchPhrasesData: jest.fn(),
  fetchPhrasesVersion: jest.fn(),
  pinPhrasesVersion: jest.fn().mockResolvedValue({ version: "1.0" }),
}));

jest.mock("../../threshold/parameters/phrasesRegistry", () => ({
  initPhrases: jest.fn(),
  getPhrasesVersion: jest.fn(),
}));

jest.mock("../engine/engineCompile", () => ({
  compileExperimentWithEngine: jest.fn().mockResolvedValue({
    files: [],
    diagnostics: [],
    requested: {
      forms: [],
      fonts: [],
      texts: [],
      folders: [],
      images: [],
      code: [],
      impulseResponses: [],
      frequencyResponses: [],
      targetSoundLists: [],
      phrases: [],
    },
  }),
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

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
}));

const mockGlossaryData = {
  version: "2.0",
  glossary: { paramX: { name: "paramX" } },
  glossaryFull: [],
  superMatchingParams: [],
};

const mockPhrasesData = {
  version: "2.0",
  phrases: { greeting: { en: "Hello", fr: "Bonjour" } },
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
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(fetchGlossaryData).toHaveBeenCalledWith("2.0");
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
    expect(compileExperimentWithEngine).toHaveBeenCalledTimes(1);

    const fetchOrder = fetchGlossaryData.mock.invocationCallOrder[0];
    const initOrder = initGlossary.mock.invocationCallOrder[0];
    const preprocessOrder =
      compileExperimentWithEngine.mock.invocationCallOrder[0];
    expect(fetchOrder).toBeLessThan(initOrder);
    expect(initOrder).toBeLessThan(preprocessOrder);
  });

  it("refreshes the glossary even when compiling from an archive", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(
      <Table ref={ref} {...makeProps({ isCompiledFromArchiveBool: true })} />,
    );

    await ref.current.handleTable(new File(["a,b"], "exp.export.zip"));

    expect(fetchGlossaryData).toHaveBeenCalledTimes(1);
    expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
    expect(compileExperimentWithEngine).toHaveBeenCalledTimes(1);
  });

  it("aborts the compile and logs when the glossary refresh fails", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    const fetchError = new Error("network down");
    fetchGlossaryData.mockRejectedValue(fetchError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(initGlossary).not.toHaveBeenCalled();
    expect(compileExperimentWithEngine).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh glossary:",
      fetchError,
    );

    consoleError.mockRestore();
  });

  it("skips the full glossary download when the server version matches the cached version", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchGlossaryData).not.toHaveBeenCalled();
    expect(initGlossary).not.toHaveBeenCalled();
    expect(compileExperimentWithEngine).toHaveBeenCalledTimes(1);
  });

  it("downloads the full glossary when the server version differs from the cached version", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
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
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
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
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      initGlossary,
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
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

describe("Table.handleTable glossary loading dialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const swalTitles = () => {
    const {
      manuallySetSwalTitle,
    } = require("../../threshold/preprocess/gitlabUtils");
    return manuallySetSwalTitle.mock.calls.map(([title]) => title);
  };

  it("relabels the open dialog to 'Loading glossary …' while downloading, then restores 'Compiling ...' without closing it", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const {
      manuallySetSwalTitle,
    } = require("../../threshold/preprocess/gitlabUtils");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    const titles = swalTitles();
    // The dialog opened by handleDrop is relabeled to show the glossary download...
    expect(titles).toContain("Loading glossary …");
    // ...before the download starts...
    const glossaryTitleOrder =
      manuallySetSwalTitle.mock.invocationCallOrder[
        titles.indexOf("Loading glossary …")
      ];
    const fetchOrder = fetchGlossaryData.mock.invocationCallOrder[0];
    expect(glossaryTitleOrder).toBeLessThan(fetchOrder);
    // ...and is restored to "Compiling ..." (never closed) before preprocessing.
    expect(titles).toContain("Compiling ...");
    expect(Swal.close).not.toHaveBeenCalled();
    expect(compileExperimentWithEngine).toHaveBeenCalledTimes(1);
  });

  it("does not relabel to 'Loading glossary …' when the cached version is current", async () => {
    const { fetchGlossaryVersion } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    // No download, so no glossary status; the shared dialog stays open (never closed).
    expect(swalTitles()).not.toContain("Loading glossary …");
    expect(Swal.close).not.toHaveBeenCalled();
  });

  it("closes the dialog when the glossary download fails", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockRejectedValue(new Error("network down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(swalTitles()).toContain("Loading glossary …");
    // The error path closes the dialog instead of leaving it spinning forever.
    expect(Swal.close).toHaveBeenCalledTimes(1);
    expect(compileExperimentWithEngine).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

describe("Table.handleTable phrases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);
  });

  it("fetches and initializes phrases when version differs from cached", async () => {
    const {
      fetchPhrasesData,
      fetchPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue(null);
    fetchPhrasesData.mockResolvedValue(mockPhrasesData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchPhrasesData).toHaveBeenCalledTimes(1);
    expect(initPhrases).toHaveBeenCalledWith(mockPhrasesData);
  });

  it("skips phrases download when server version matches cached version", async () => {
    const {
      fetchPhrasesData,
      fetchPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchPhrasesData).not.toHaveBeenCalled();
    expect(initPhrases).not.toHaveBeenCalled();
  });

  it("fetches phrases when version check request fails", async () => {
    const {
      fetchPhrasesData,
      fetchPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockRejectedValue(new Error("timeout"));
    getPhrasesVersion.mockReturnValue("2.0");
    fetchPhrasesData.mockResolvedValue(mockPhrasesData);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(fetchPhrasesData).toHaveBeenCalledTimes(1);
    expect(initPhrases).toHaveBeenCalledWith(mockPhrasesData);
  });

  it("aborts compile and logs when phrases refresh fails", async () => {
    const {
      fetchPhrasesData,
      fetchPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    fetchPhrasesVersion.mockResolvedValue({ version: "3.0" });
    getPhrasesVersion.mockReturnValue("2.0");
    const fetchError = new Error("network down");
    fetchPhrasesData.mockRejectedValue(fetchError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(initPhrases).not.toHaveBeenCalled();
    expect(compileExperimentWithEngine).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh phrases:",
      fetchError,
    );

    consoleError.mockRestore();
  });

  it("calls pinPhrasesVersion at compile time", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const {
      fetchPhrasesVersion,
      pinPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");

    const ref = React.createRef();
    render(
      <Table
        ref={ref}
        {...makeProps({
          user: { ...makeProps().user, id: 1, username: "alice" },
        })}
      />,
    );

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(pinPhrasesVersion).toHaveBeenCalledWith("alice", "project");
  });

  it("aborts compile when pinPhrasesVersion rejects", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const {
      fetchPhrasesVersion,
      pinPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");
    pinPhrasesVersion.mockRejectedValue(new Error("pin failed"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const props = makeProps({
      user: { ...makeProps().user, id: 1, username: "alice" },
    });
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(props.functions.handleNextStep).not.toHaveBeenCalledWith("upload");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to pin phrases version:",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});

describe("Table.handleTable — EasyEyesResources lookup uses searchProjectByName", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls searchProjectByName(user, resourcesRepoName) for the resources repo", async () => {
    const {
      searchProjectByName,
    } = require("../../threshold/preprocess/gitlabSearch");
    searchProjectByName.mockResolvedValue(null);

    const props = makeProps();
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(searchProjectByName).toHaveBeenCalledWith(
      props.user,
      "EasyEyesResources",
    );
  });
});

describe("Table.handleTable — glossary prefetch wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      fetchGlossaryVersion,
      getGlossaryPrefetch,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    // Default: no in-flight prefetch, glossary already cached
    getGlossaryPrefetch.mockReturnValue(null);
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");

    const { fetchPhrasesVersion } = require("../components/phrasesApi");
    const {
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");
  });

  it("relabels the dialog to 'Loading glossary …' and awaits when prefetch is in flight", async () => {
    const { getGlossaryPrefetch } = require("../components/glossaryApi");
    const {
      manuallySetSwalTitle,
    } = require("../../threshold/preprocess/gitlabUtils");
    let resolvePrefetch;
    const pendingPromise = new Promise((resolve) => {
      resolvePrefetch = resolve;
    });
    getGlossaryPrefetch.mockReturnValue(pendingPromise);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    const tablePromise = ref.current.handleTable(new File(["a,b"], "exp.csv"));
    resolvePrefetch();
    await tablePromise;

    expect(manuallySetSwalTitle).toHaveBeenCalledWith("Loading glossary …");
  });

  it("does not relabel the dialog when getGlossaryPrefetch returns null", async () => {
    const { getGlossaryPrefetch } = require("../components/glossaryApi");
    const {
      manuallySetSwalTitle,
    } = require("../../threshold/preprocess/gitlabUtils");
    getGlossaryPrefetch.mockReturnValue(null);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(manuallySetSwalTitle).not.toHaveBeenCalledWith("Loading glossary …");
  });

  it("swallows prefetch errors and continues to compileExperimentWithEngine", async () => {
    const { getGlossaryPrefetch } = require("../components/glossaryApi");
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const rejectingPromise = Promise.reject(new Error("prefetch failed"));
    rejectingPromise.catch(() => {});
    getGlossaryPrefetch.mockReturnValue(rejectingPromise);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(compileExperimentWithEngine).toHaveBeenCalledTimes(1);
  });
});

describe("Table.handleTable — engine compile outcome handling (issue #174)", () => {
  const successOutcome = (overrides = {}) => ({
    files: [],
    diagnostics: [],
    requested: {
      forms: [],
      fonts: [],
      texts: [],
      folders: [],
      images: [],
      code: [],
      impulseResponses: [],
      frequencyResponses: [],
      targetSoundLists: [],
      phrases: [],
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const {
      fetchGlossaryVersion,
      getGlossaryPrefetch,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    getGlossaryPrefetch.mockReturnValue(null);
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");
    const { fetchPhrasesVersion } = require("../components/phrasesApi");
    const {
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");
  });

  it("hands the dropped table, session resources, and archive flag to the engine compile path", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");

    const file = new File(["a,b"], "exp.csv");
    const ref = React.createRef();
    render(
      <Table ref={ref} {...makeProps({ isCompiledFromArchiveBool: true })} />,
    );

    await ref.current.handleTable(file);

    expect(compileExperimentWithEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        compiledFromArchive: true,
        resources: expect.objectContaining({
          fetchPhraseFromRepo: expect.any(Function),
          textContents: expect.any(Object),
        }),
        user: expect.any(Object),
      }),
    );
  });

  it("passes the selected release (Use EasyEyes version dropdown) to the engine compile path (issue #178)", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps({ selectedRelease: "2026.7.8" })} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(compileExperimentWithEngine).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedRelease: "2026.7.8" }),
    );
  });

  it("renders the Use EasyEyes version dropdown wired to the selected release and the selection handler (issue #178)", async () => {
    const { VersionDropdown } = require("../components/VersionDropdown");
    const handleSetSelectedRelease = jest.fn();
    const defaultFunctions = makeProps().functions;

    await act(async () => {
      render(
        <Table
          {...makeProps({
            selectedRelease: "2026-03-01",
            functions: { ...defaultFunctions, handleSetSelectedRelease },
          })}
        />,
      );
    });

    expect(VersionDropdown).toHaveBeenCalledWith(
      expect.objectContaining({
        selected: "2026-03-01",
        onSelect: handleSetSelectedRelease,
        releases: [
          { release: "2026-07-08", changelog: "Latest" },
          { release: "2026-03-01", changelog: "Older" },
        ],
      }),
      expect.anything(),
    );
  });

  it("stores the compiled files verbatim and the requested resource lists for upload", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    const compiledFiles = [
      { path: "exp.csv", content: "a,b" },
      { path: "conditions/block_1.csv", content: "block,1" },
    ];
    compileExperimentWithEngine.mockResolvedValueOnce(
      successOutcome({
        files: compiledFiles,
        requested: {
          ...successOutcome().requested,
          forms: ["consent.pdf"],
          fonts: ["Sloan.woff2"],
          phrases: ["myPhrases.xlsx"],
        },
      }),
    );

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(userRepoFiles.compiledFiles).toBe(compiledFiles);
    expect(userRepoFiles.requestedForms).toEqual(["consent.pdf"]);
    expect(userRepoFiles.requestedFonts).toEqual(["Sloan.woff2"]);
    expect(userRepoFiles.requestedPhrases).toEqual(["myPhrases.xlsx"]);
  });

  it("stores the release actually resolved, for the upload step to pin (issue #177)", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const { userRepoFiles } = require("../../threshold/preprocess/constants");
    compileExperimentWithEngine.mockResolvedValueOnce(
      successOutcome({ release: "2026.7.8" }),
    );

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(userRepoFiles.releasePin).toBe("2026.7.8");
  });

  it("shows only blocking errors and reopens the dropzone when the compile fails", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const blocking = {
      kind: "error",
      name: "Missing font",
      message: "Font not found",
      parameters: ["font"],
    };
    const warning = { kind: "warning", name: "Caution", parameters: ["x"] };
    compileExperimentWithEngine.mockResolvedValueOnce(
      successOutcome({ diagnostics: [warning, blocking] }),
    );

    const props = makeProps();
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    await act(async () => {
      await ref.current.handleTable(new File(["a,b"], "exp.csv"));
    });

    expect(ref.current.state.errors).toEqual([blocking]);
    expect(ref.current.state.showDropZone).toBe(true);
    expect(props.functions.handleSetFilename).not.toHaveBeenCalled();
  });

  it("surfaces warnings above the success banner when the compile succeeds", async () => {
    const { compileExperimentWithEngine } = require("../engine/engineCompile");
    const warning = { kind: "warning", name: "Caution", parameters: ["x"] };
    compileExperimentWithEngine.mockResolvedValueOnce(
      successOutcome({ diagnostics: [warning] }),
    );

    const props = makeProps({
      functions: {
        ...makeProps().functions,
        handleSetCompileWarnings: jest.fn(),
      },
    });
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    await act(async () => {
      await ref.current.handleTable(new File(["a,b"], "exp.csv"));
    });

    expect(props.functions.handleSetCompileWarnings).toHaveBeenCalledWith([
      warning,
    ]);
    expect(ref.current.state.errors[0]).toBe(warning);
    expect(ref.current.state.errors[1]).toMatchObject({ kind: "correct" });
    expect(props.functions.handleSetFilename).toHaveBeenCalledWith("exp.csv");
  });
});
