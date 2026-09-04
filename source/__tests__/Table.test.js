import React from "react";
import { act, render } from "@testing-library/react";
import Table from "../Table";
import Swal from "sweetalert2";
import { preprocessExperimentFile } from "../../threshold/preprocess/main";
import { loadGlossaryRows } from "../../threshold/parameters/glossaryLink";

// Row map for the glossary-link mock below. name → row; 0 = known parameter
// with unknown row (whole-sheet link).
const mockGlossaryRows = {};
const mockGlossaryUrl = (name) => {
  if (!(name in mockGlossaryRows)) return null;
  const row = mockGlossaryRows[name];
  return row
    ? `https://example.test/glossary&range=A${row}`
    : "https://example.test/glossary";
};

jest.mock("../../threshold/parameters/glossaryLink", () => ({
  glossaryParameterUrl: (name) => mockGlossaryUrl(name),
  linkGlossaryParameters: (html) =>
    html.replace(
      /<span class="error-parameter">([^<]+)<\/span>/g,
      (span, name) => {
        const href = mockGlossaryUrl(name);
        return href
          ? `<a class="error-parameter-link" href="${href}" target="_blank" rel="noopener noreferrer">${span}</a>`
          : span;
      },
    ),
  loadGlossaryRows: jest.fn().mockResolvedValue(null),
}));

afterEach(() => {
  for (const key of Object.keys(mockGlossaryRows)) delete mockGlossaryRows[key];
});

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

jest.mock("../../threshold/preprocess/exportBeforeCompile", () => ({
  exportStudyBeforeCompiling: jest.fn().mockResolvedValue([]),
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
  getGlossary: jest.fn(() => ({})),
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

jest.mock("../../threshold/preprocess/archiveResources", () => ({
  buildArchiveResources: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
}));

jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: {
    loadFromStorage: jest.fn(),
  },
}));

jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: jest.fn(() => ({
    clientId: "client-id",
    redirectUri: "https://example.test/redirect",
  })),
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

describe("Table freshness status", () => {
  it("places development freshness below the instructions without disabling file selection", () => {
    const { container } = render(<Table {...makeProps()} />);
    const banner = container.querySelector(".green-status-banner");
    const status = container.querySelector(".freshness-status");
    const fileInput = container.querySelector('.dropzone input[type="file"]');

    expect(banner).toContainElement(status);
    expect(banner.lastElementChild).toBe(status);
    expect(status.textContent).toBe(
      "✅Fresh. The compiler is running in development mode.",
    );
    expect(fileInput).toBeEnabled();
  });

  it("groups file controls below the instructions for sticky positioning", () => {
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);

    act(() => {
      ref.current.setState({
        tableName: "study.csv",
        errors: [{ context: "preprocessor", kind: "error" }],
      });
    });

    const banner = container.querySelector(".green-status-banner");
    const controls = container.querySelector(".table-sticky-controls");

    expect(banner.nextElementSibling).toBe(controls);
    expect(controls).toContainElement(container.querySelector(".file-zone"));
    expect(controls).toContainElement(
      container.querySelector(".dropzone-around-text.emphasize.has-error"),
    );
  });
});

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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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
    const preprocessOrder =
      preprocessExperimentFile.mock.invocationCallOrder[0];
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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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
    expect(preprocessExperimentFile).not.toHaveBeenCalled();
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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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

describe("Table.handleTable archive resource sourcing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function primeGlossary() {
    const { fetchGlossaryVersion } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue("2.0");
  }

  it("builds the resource pool from the archive zip and skips the repo listing", async () => {
    primeGlossary();
    const {
      buildArchiveResources,
    } = require("../../threshold/preprocess/archiveResources");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    const {
      searchProjectByName,
    } = require("../../threshold/preprocess/gitlabSearch");
    const {
      getTextFileDataFromGitLab,
    } = require("../../threshold/preprocess/fileUtils");

    const archiveResources = {
      fonts: ["Sloan.woff2"],
      texts: ["corpus.txt"],
      textContents: { "corpus.txt": "text" },
      phrases: [],
      localFetchers: {},
    };
    buildArchiveResources.mockResolvedValue(archiveResources);
    const archivedZip = new File(["zip"], "study.export.zip");

    const ref = React.createRef();
    render(
      <Table
        ref={ref}
        {...makeProps({ isCompiledFromArchiveBool: true, archivedZip })}
      />,
    );

    await ref.current.handleTable(new File(["a,b"], "study.xlsx"));

    expect(buildArchiveResources).toHaveBeenCalledWith(archivedZip);
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
    // The archive-derived resources are what the compiler validates against
    expect(preprocessExperimentFile.mock.calls[0][3]).toBe(archiveResources);
    expect(preprocessExperimentFile.mock.calls[0][4]).toBe(true);
    // The archive is the resource pool: no repo listing, no repo text reads
    expect(searchProjectByName).not.toHaveBeenCalled();
    expect(getTextFileDataFromGitLab).not.toHaveBeenCalled();
  });

  it("does not touch the archive builder for a plain spreadsheet compile", async () => {
    primeGlossary();
    const {
      buildArchiveResources,
    } = require("../../threshold/preprocess/archiveResources");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(buildArchiveResources).not.toHaveBeenCalled();
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
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
    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
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
    expect(preprocessExperimentFile).not.toHaveBeenCalled();

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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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
    expect(preprocessExperimentFile).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh phrases:",
      fetchError,
    );

    consoleError.mockRestore();
  });

  it("calls pinPhrasesVersion at compile time", async () => {
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    const {
      fetchPhrasesVersion,
      pinPhrasesVersion,
    } = require("../components/phrasesApi");
    const {
      getPhrasesVersion,
    } = require("../../threshold/parameters/phrasesRegistry");
    fetchPhrasesVersion.mockResolvedValue({ version: "2.0" });
    getPhrasesVersion.mockReturnValue("2.0");
    preprocessExperimentFile.mockImplementationOnce(
      async (_f, user, _e, _r, _a, callback) => {
        await callback(
          user,
          { debriefForm: null, consentForm: null },
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
        );
      },
    );

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
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
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
    preprocessExperimentFile.mockImplementationOnce(
      async (_f, user, _e, _r, _a, callback) => {
        await callback(
          user,
          { debriefForm: null, consentForm: null },
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
        );
      },
    );
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

  it("reads text resources through the authenticated GitLab client", async () => {
    const {
      searchProjectByName,
    } = require("../../threshold/preprocess/gitlabSearch");
    const {
      getTextFileDataFromGitLab,
    } = require("../../threshold/preprocess/fileUtils");
    const {
      GitLabOAuthClient,
    } = require("../../threshold/preprocess/auth/gitlabOAuthClient");
    const client = { apiRequest: jest.fn() };
    GitLabOAuthClient.loadFromStorage.mockReturnValue(client);
    searchProjectByName.mockResolvedValue({ id: "42" });
    getTextFileDataFromGitLab.mockResolvedValue("corpus contents");

    const props = makeProps({ resources: { texts: ["corpus.txt"] } });
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(getTextFileDataFromGitLab).toHaveBeenCalledWith(
      42,
      "texts/corpus.txt",
      client,
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

  it("swallows prefetch errors and continues to preprocessExperimentFile", async () => {
    const { getGlossaryPrefetch } = require("../components/glossaryApi");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    const rejectingPromise = Promise.reject(new Error("prefetch failed"));
    rejectingPromise.catch(() => {});
    getGlossaryPrefetch.mockReturnValue(rejectingPromise);

    const ref = React.createRef();
    render(<Table ref={ref} {...makeProps()} />);

    await ref.current.handleTable(new File(["a,b"], "exp.csv"));

    expect(preprocessExperimentFile).toHaveBeenCalledTimes(1);
  });
});

describe("Select file to download raw source button", () => {
  it("renders gray, immediately to the right of the green Select file button", () => {
    const { container } = render(<Table {...makeProps()} />);
    const dropzones = container.querySelectorAll(".file-zone .dropzone");

    expect(dropzones).toHaveLength(2);
    expect(dropzones[0].textContent).toBe("Select file");
    expect(dropzones[0]).not.toHaveClass("dropzone-export");
    expect(dropzones[1]).toHaveTextContent(
      "Select file to download raw source",
    );
    expect(dropzones[1]).toHaveClass("dropzone-export");
  });
});

describe("Table.onDrop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears displayed compiler errors when a resource upload starts", () => {
    const { act } = require("@testing-library/react");
    const ref = React.createRef();
    const { queryByText } = render(<Table ref={ref} {...makeProps()} />);

    act(() => {
      ref.current.setState({
        errors: [{ context: "preprocessor", kind: "error", name: "E" }],
      });
    });
    expect(queryByText("Compiler error: E")).toBeInTheDocument();

    act(() => {
      ref.current.onDrop([new File(["resource"], "phrases.phrases.xlsx")]);
    });

    expect(queryByText("Compiler error: E")).not.toBeInTheDocument();
  });
});

describe("Table.onDropForExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hands the user and the selected files to the exporter", async () => {
    const {
      exportStudyBeforeCompiling,
    } = require("../../threshold/preprocess/exportBeforeCompile");
    exportStudyBeforeCompiling.mockResolvedValue([]);
    const { act } = require("@testing-library/react");

    const props = makeProps();
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);

    const files = [new File(["a,b"], "exp.csv")];
    await act(async () => {
      await ref.current.onDropForExport(files);
    });

    expect(exportStudyBeforeCompiling).toHaveBeenCalledWith(props.user, files);
  });

  it("shows export errors after compiler errors, replacing stale export errors", async () => {
    const {
      exportStudyBeforeCompiling,
    } = require("../../threshold/preprocess/exportBeforeCompile");
    const { act } = require("@testing-library/react");
    const compilerError = {
      context: "preprocessor",
      kind: "error",
      name: "Unbalanced commas",
    };
    const staleExportError = {
      context: "export",
      kind: "error",
      name: "Old export failure",
    };
    const newExportError = {
      context: "export",
      kind: "error",
      name: "Export failed",
    };
    exportStudyBeforeCompiling.mockResolvedValue([newExportError]);

    const props = makeProps();
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);
    act(() => {
      ref.current.setState({ errors: [compilerError, staleExportError] });
    });

    await act(async () => {
      await ref.current.onDropForExport([new File(["a,b"], "exp.csv")]);
    });

    expect(ref.current.state.errors).toEqual([compilerError, newExportError]);
    expect(props.scrollToCurrentStep).toHaveBeenCalled();
  });

  it("leaves the displayed errors untouched when the export succeeds", async () => {
    const {
      exportStudyBeforeCompiling,
    } = require("../../threshold/preprocess/exportBeforeCompile");
    const { act } = require("@testing-library/react");
    const compilerError = {
      context: "preprocessor",
      kind: "error",
      name: "Unbalanced commas",
    };
    exportStudyBeforeCompiling.mockResolvedValue([]);

    const props = makeProps();
    const ref = React.createRef();
    render(<Table ref={ref} {...props} />);
    act(() => {
      ref.current.setState({ errors: [compilerError] });
    });

    await act(async () => {
      await ref.current.onDropForExport([new File(["a,b"], "exp.csv")]);
    });

    expect(ref.current.state.errors).toEqual([compilerError]);
    expect(props.scrollToCurrentStep).not.toHaveBeenCalled();
  });
});

describe("Error label prefixes", () => {
  it("labels red errors as Compiler or Export errors; warnings and success stay unlabeled", () => {
    const { act } = require("@testing-library/react");
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);

    act(() => {
      ref.current.setState({
        errors: [
          {
            context: "preprocessor",
            kind: "error",
            name: "Unbalanced commas",
          },
          { context: "export", kind: "error", name: "Export failed" },
          { context: "preprocessor", kind: "warning", name: "LOGGING CAUTION" },
          {
            context: "preprocessor",
            kind: "correct",
            name: "Compiled successfully.",
          },
        ],
      });
    });

    const names = [...container.querySelectorAll(".error-name")].map(
      (element) => element.textContent,
    );
    expect(names).toEqual([
      "Compiler error: Unbalanced commas",
      "Download source error: Export failed",
      "LOGGING CAUTION",
      "Compiled successfully.",
    ]);
  });
});

describe("Parameter(s) row", () => {
  const renderTableWithErrors = (errors) => {
    const { act } = require("@testing-library/react");
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);
    act(() => {
      ref.current.setState({ errors });
    });
    return container;
  };

  const withGlossaryRows = (rows) => {
    for (const key of Object.keys(mockGlossaryRows))
      delete mockGlossaryRows[key];
    Object.assign(mockGlossaryRows, rows);
  };

  afterEach(() => withGlossaryRows({}));

  it("labels the parameter list, comma-separated, so it is self-explanatory", () => {
    withGlossaryRows({});
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "Font missing readingCorpus characters",
        parameters: ["font", "readingCorpus", "fontTolerateFaults"],
      },
    ]);
    const row = container.querySelector(".error-relevant-parameters");
    expect(row).not.toBeNull();
    expect(row.textContent).toBe(
      "PARAMETERS: font, readingCorpus, fontTolerateFaults",
    );
  });

  it("uses the singular label for a single parameter", () => {
    withGlossaryRows({});
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        parameters: ["font"],
      },
    ]);
    const row = container.querySelector(".error-relevant-parameters");
    expect(row.textContent).toBe("PARAMETER: font");
  });

  it("links each parameter in the row to its glossary entry", () => {
    withGlossaryRows({
      font: 288,
      readingCorpus: 416,
      fontTolerateFaults: 320,
    });
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        parameters: ["font", "readingCorpus", "fontTolerateFaults"],
      },
    ]);
    const links = [
      ...container.querySelectorAll(".error-relevant-parameters a"),
    ];
    expect(links.map((a) => a.textContent)).toEqual([
      "font",
      "readingCorpus",
      "fontTolerateFaults",
    ]);
    expect(links[0].href).toContain("range=A288");
    expect(links[0].target).toBe("_blank");
    expect(links[1].href).toContain("range=A416");
  });

  it("leaves row parameters unlinked when the glossary has no entry", () => {
    withGlossaryRows({ font: 288 });
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        parameters: ["font", "notAParameter"],
      },
    ]);
    const row = container.querySelector(".error-relevant-parameters");
    const links = [...row.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(row.textContent).toBe("PARAMETERS: font, notAParameter");
  });

  it("links parameter mentions inside message and hint", () => {
    withGlossaryRows({ font: 288 });
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        message: 'Check <span class="error-parameter">font</span> in column C.',
        hint: 'Set <span class="error-parameter">font</span> or pick another file.',
      },
    ]);
    const messageLink = container.querySelector(".error-message a");
    const hintLink = container.querySelector(".error-hint a");
    expect(messageLink).not.toBeNull();
    expect(messageLink.href).toContain("range=A288");
    expect(hintLink).not.toBeNull();
    expect(hintLink.href).toContain("range=A288");
  });

  it("shows each parameter once even when the error lists it twice", () => {
    // UNBALANCED_COMMAS can list the same parameter twice (duplicate rows).
    withGlossaryRows({ block: 10, font: 288 });
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        parameters: ["block", "block", "font"],
      },
    ]);
    const row = container.querySelector(".error-relevant-parameters");
    expect(row.textContent).toBe("PARAMETERS: block, font");
    expect(row.querySelectorAll("a")).toHaveLength(2);
  });

  it("renders an unrecognized (possibly hostile) parameter name as inert text", () => {
    withGlossaryRows({});
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "Parameter is unrecognized",
        parameters: ['<img src=x onerror="window.pwned=1">'],
      },
    ]);
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector(".error-relevant-parameters").textContent,
    ).toContain("<img src=x");
  });

  it("places the Parameter(s) line last in the error box", () => {
    withGlossaryRows({});
    const container = renderTableWithErrors([
      {
        context: "preprocessor",
        kind: "error",
        name: "E1",
        message: "M",
        hint: "H",
        parameters: ["font"],
      },
    ]);
    const item = container.querySelector(".error-item");
    expect(
      item.lastElementChild.classList.contains("error-relevant-parameters"),
    ).toBe(true);
  });

  it("warms the glossary-row map at mount, before any compile", () => {
    loadGlossaryRows.mockClear();
    render(<Table {...makeProps()} />);
    expect(loadGlossaryRows).toHaveBeenCalledTimes(1);
  });

  it("omits the row when the error has no parameters", () => {
    withGlossaryRows({});
    const container = renderTableWithErrors([
      { context: "preprocessor", kind: "error", name: "E", parameters: [] },
    ]);
    expect(container.querySelector(".error-relevant-parameters")).toBeNull();
  });
});

describe("Error ordering", () => {
  const compileWithErrors = async (errorList) => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);
    preprocessExperimentFile.mockImplementation(async (...args) => {
      const callback = args[5];
      callback({}, {}, [], [], [], [], [], [], errorList, [], [], [], "");
    });
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);
    const { act } = require("@testing-library/react");
    await act(async () => {
      await ref.current.handleTable(new File(["a,b"], "exp.csv"));
    });
    return [...container.querySelectorAll(".error-name")].map(
      (element) => element.textContent,
    );
  };

  it("keeps compiler emission order among errors with the same parameters", async () => {
    const corpusError = (font) => ({
      context: "preprocessor",
      kind: "error",
      name: `Font missing readingCorpus characters (${font})`,
      parameters: ["font", "readingCorpus", "fontTolerateFaults"],
    });
    expect(
      await compileWithErrors([
        corpusError("F1"),
        corpusError("F2"),
        corpusError("F3"),
      ]),
    ).toEqual([
      "Compiler error: Font missing readingCorpus characters (F1)",
      "Compiler error: Font missing readingCorpus characters (F2)",
      "Compiler error: Font missing readingCorpus characters (F3)",
    ]);
  });

  it("sorts by parameter list first, so a block error precedes font errors", async () => {
    const corpusError = (font) => ({
      context: "preprocessor",
      kind: "error",
      name: `Font missing readingCorpus characters (${font})`,
      parameters: ["font", "readingCorpus", "fontTolerateFaults"],
    });
    const blockError = {
      context: "preprocessor",
      kind: "error",
      name: "block value is empty",
      parameters: ["block"],
    };
    expect(
      await compileWithErrors([
        corpusError("F1"),
        blockError,
        corpusError("F2"),
      ]),
    ).toEqual([
      "Compiler error: block value is empty",
      "Compiler error: Font missing readingCorpus characters (F1)",
      "Compiler error: Font missing readingCorpus characters (F2)",
    ]);
  });
  it("loads glossary rows during the compile and links rendered errors", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);
    loadGlossaryRows.mockClear();
    for (const key of Object.keys(mockGlossaryRows))
      delete mockGlossaryRows[key];
    mockGlossaryRows.font = 288;

    let rowsLoadedWhenPreprocessRan = false;
    preprocessExperimentFile.mockImplementation(async (...args) => {
      // The row fetch must be kicked off before the compile, in parallel.
      rowsLoadedWhenPreprocessRan = loadGlossaryRows.mock.calls.length > 0;
      const callback = args[5];
      callback(
        {},
        {},
        [],
        [],
        [],
        [],
        [],
        [],
        [
          {
            context: "preprocessor",
            kind: "error",
            name: "E",
            parameters: ["font"],
          },
        ],
        [],
        [],
        [],
        "",
      );
    });
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);
    const { act } = require("@testing-library/react");
    await act(async () => {
      await ref.current.handleTable(new File(["a,b"], "exp.csv"));
    });

    expect(rowsLoadedWhenPreprocessRan).toBe(true);
    const link = container.querySelector(".error-relevant-parameters a");
    expect(link).not.toBeNull();
    expect(link.href).toContain("range=A288");
  });
  it("never blocks error display on a hanging glossary-row fetch", async () => {
    const {
      fetchGlossaryData,
      fetchGlossaryVersion,
    } = require("../components/glossaryApi");
    const {
      getGlossaryVersion,
    } = require("../../threshold/parameters/glossaryRegistry");
    const {
      preprocessExperimentFile,
    } = require("../../threshold/preprocess/main");
    fetchGlossaryVersion.mockResolvedValue({ version: "2.0" });
    getGlossaryVersion.mockReturnValue(null);
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);
    // A hung fetch (e.g. docs.google.com black-holed): errors must still
    // render within the bounded grace period, not wait for it.
    loadGlossaryRows.mockReset();
    loadGlossaryRows.mockImplementation(() => new Promise(() => {}));
    preprocessExperimentFile.mockImplementation(async (...args) => {
      args[5](
        {},
        {},
        [],
        [],
        [],
        [],
        [],
        [],
        [
          {
            context: "preprocessor",
            kind: "error",
            name: "E",
            parameters: [],
          },
        ],
        [],
        [],
        [],
        "",
      );
    });
    const ref = React.createRef();
    const { container } = render(<Table ref={ref} {...makeProps()} />);
    const { act, waitFor } = require("@testing-library/react");
    await act(async () => {
      await ref.current.handleTable(new File(["a,b"], "exp.csv"));
    });
    loadGlossaryRows.mockResolvedValue(null); // restore for later tests
    // Renders after the 500 ms grace period — and would never render at all
    // if the callback awaited the hung fetch unbounded.
    await waitFor(
      () =>
        expect(container.querySelector(".error-name").textContent).toBe(
          "Compiler error: E",
        ),
      { timeout: 3000 },
    );
  });
});

describe("Table compile-error visibility reporting", () => {
  const renderTableWithReporter = () => {
    const handleSetCompileErrorsVisible = jest.fn();
    const ref = React.createRef();
    const props = makeProps();
    props.functions = {
      ...props.functions,
      handleSetCompileErrorsVisible,
    };
    const rendered = render(<Table ref={ref} {...props} />);
    return { ref, handleSetCompileErrorsVisible, ...rendered };
  };

  it("reports true when a blocking error appears, false when cleared", () => {
    const { act } = require("@testing-library/react");
    const { ref, handleSetCompileErrorsVisible } = renderTableWithReporter();

    act(() => {
      ref.current.setState({
        errors: [{ context: "preprocessor", kind: "error", name: "E" }],
      });
    });
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(true);

    act(() => {
      ref.current.setState({ errors: [] });
    });
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(false);
  });

  it("does not report true for warnings or the success entry alone", () => {
    const { act } = require("@testing-library/react");
    const { ref, handleSetCompileErrorsVisible } = renderTableWithReporter();

    act(() => {
      ref.current.setState({
        errors: [{ context: "preprocessor", kind: "warning", name: "W" }],
      });
    });
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(false);

    act(() => {
      ref.current.setState({
        errors: [
          { context: "preprocessor", kind: "warning", name: "W" },
          { context: "preprocessor", kind: "correct", name: "OK" },
        ],
      });
    });
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(false);
  });

  it("reports false when unmounted with errors still showing", () => {
    const { act } = require("@testing-library/react");
    const { ref, handleSetCompileErrorsVisible, unmount } =
      renderTableWithReporter();

    act(() => {
      ref.current.setState({
        errors: [{ context: "preprocessor", kind: "error", name: "E" }],
      });
    });
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(true);

    unmount();
    expect(handleSetCompileErrorsVisible).toHaveBeenLastCalledWith(false);
  });
});
