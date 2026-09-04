jest.mock("firebase/database", () => ({
  get: jest.fn(),
  ref: jest.fn(),
}));

jest.mock("../components/firebase", () => ({ db: {} }));

jest.mock("../components/prolificIntegration", () => ({
  prolificCreateDraft: jest.fn(),
  downloadDemographicData: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  createProlificStudyIdFile: jest.fn(),
  downloadCommonResources: jest.fn(),
  downloadDataFolder: jest.fn(),
  generateAndUploadCompletionURL: jest.fn(),
  getAllProjects: jest.fn(),
  getDataFolderCsvLength: jest.fn(),
  getExperimentStatus: jest.fn(),
  getProlificStudyId: jest.fn(),
  runExperiment: jest.fn(),
}));

jest.mock("../../threshold/parameters/glossaryRegistry", () => ({
  getGlossary: jest.fn(() => ({})),
}));

// Row map for the glossary-link mock below. name → row.
const mockGlossaryRows = {};
const mockGlossaryUrl = (name) =>
  name in mockGlossaryRows
    ? `https://example.test/glossary&range=A${mockGlossaryRows[name]}`
    : null;

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
}));

import Running from "../Running";
import { render, screen } from "@testing-library/react";
import { prolificCreateDraft } from "../components/prolificIntegration";
import {
  createProlificStudyIdFile,
  generateAndUploadCompletionURL,
  getDataFolderCsvLength,
  getProlificStudyId,
} from "../../threshold/preprocess/gitlabUtils";

describe("Running compile warnings", () => {
  const baseProps = {
    user: {
      username: "scientist",
      currentExperiment: {},
      projectList: Promise.resolve([]),
    },
    activeExperiment: { id: 42, name: "compiled-study" },
    projectName: "compiled-study",
    experimentStatus: "RUNNING",
    viewingPreviousExperiment: false,
    previousExperimentViewed: {
      previousExperimentStatus: "RUNNING",
      previousRecruitmentInformation: null,
      previousProlificConfig: null,
    },
    functions: {
      handleSetActivateExperiment: jest.fn(),
    },
  };

  it("shows each parameter once even when the warning lists it twice", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      user: {
        username: "s",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "e" },
      projectName: "e",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: false,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: null,
        previousProlificConfig: null,
      },
      functions: { handleSetActivateExperiment: jest.fn() },
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font", "font"],
        },
      ],
    });
    const { container } = render(running.render());
    const row = container.querySelector(".error-relevant-parameters");
    expect(row.textContent).toBe("PARAMETER: font");
    expect(row.querySelectorAll("a")).toHaveLength(1);
  });

  it("places the Parameter(s) line last in the warning box", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      user: {
        username: "s",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "e" },
      projectName: "e",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: false,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: null,
        previousProlificConfig: null,
      },
      functions: { handleSetActivateExperiment: jest.fn() },
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font"],
          message: "M",
          hint: "H",
        },
      ],
    });
    const { container } = render(running.render());
    const item = container.querySelector(".compile-warning-item");
    expect(
      item.lastElementChild.classList.contains("error-relevant-parameters"),
    ).toBe(true);
  });

  it("labels and links the parameters of each warning", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      ...baseProps,
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font"],
          message: 'Set <span class="error-parameter">font</span> to taste.',
        },
      ],
    });
    const { container } = render(running.render());

    const row = container.querySelector(".error-relevant-parameters");
    expect(row.textContent).toBe("PARAMETER: font");
    const links = [...row.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(links[0].href).toContain("range=A288");
    expect(links[0].target).toBe("_blank");

    const messageLink = container.querySelector(".compile-warning-message a");
    expect(messageLink).not.toBeNull();
    expect(messageLink.href).toContain("range=A288");
  });
});

describe("Running Prolific study creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows Run and Create Prolific study for a runnable previous study without recruitment metadata", () => {
    const running = new Running({
      user: {
        username: "scientist",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "compiled-study" },
      projectName: "compiled-study",
      prolificToken: "token",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: true,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: {
          recruitmentServiceName: null,
        },
        previousProlificConfig: null,
      },
      functions: {
        handleSetActivateExperiment: jest.fn(),
      },
      compileWarnings: [],
    });
    running.state.pavloviaIsReady = true;

    render(running.render());

    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Pavlovia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Create Prolific study to run online",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Prolific" }),
    ).toBeInTheDocument();
  });

  it("opens a newly created Prolific study after the first click", async () => {
    const user = { currentExperiment: {} };
    const activeExperiment = { id: 42 };
    const running = new Running({
      user,
      activeExperiment,
      projectName: "Contrast sensitivity",
      prolificToken: "token",
      currentProlificConfig: {},
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };

    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({
      id: "study-123",
      status: "UNPUBLISHED",
    });
    createProlificStudyIdFile.mockResolvedValue(undefined);
    const studyWindow = {
      focus: jest.fn(),
      location: { replace: jest.fn() },
    };
    window.open = jest.fn(() => studyWindow);

    await running.createOrOpenProlificStudy();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(studyWindow.location.replace).toHaveBeenCalledWith(
      "https://app.prolific.com/researcher/workspaces/studies/study-123",
    );
    expect(running.state).toMatchObject({
      prolificStudyState: "ready",
      preparedProlificStudyId: "study-123",
    });
  });

  it("creates a draft from the selected previous study's persisted config", async () => {
    const selectedConfig = {
      titleOfStudy: "Selected study",
      experimentUrl: "https://run.example/selected-study",
    };
    const user = {
      currentExperiment: { titleOfStudy: "Different current study" },
    };
    const activeExperiment = { id: 42 };
    const running = new Running({
      user,
      activeExperiment,
      projectName: "Selected study",
      prolificToken: "token",
      viewingPreviousExperiment: true,
      previousExperimentViewed: {
        previousProlificConfig: selectedConfig,
      },
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };

    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({
      id: "study-123",
      status: "UNPUBLISHED",
    });
    window.open = jest.fn(() => ({
      focus: jest.fn(),
      location: { replace: jest.fn() },
    }));

    await running.createOrOpenProlificStudy();

    expect(prolificCreateDraft).toHaveBeenCalledWith(
      selectedConfig,
      "Selected study",
      "complete",
      "incompatible",
      "aborted",
      "token",
    );
  });

  it("opens an existing study without creating a duplicate draft", async () => {
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 42 },
      functions: {},
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getProlificStudyId.mockResolvedValue("existing-study");
    window.open = jest.fn(() => ({
      focus: jest.fn(),
      location: { replace: jest.fn() },
    }));

    await running.createOrOpenProlificStudy();

    expect(prolificCreateDraft).not.toHaveBeenCalled();
    expect(createProlificStudyIdFile).not.toHaveBeenCalled();
    expect(running.state.prolificStudyState).toBe("ready");
  });

  it("returns to idle without persisting an invalid draft response", async () => {
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 42 },
      projectName: "Study",
      prolificToken: "token",
      currentProlificConfig: {},
      viewingPreviousExperiment: false,
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({ status: "ACTIVE" });
    window.open = jest.fn(() => ({ close: jest.fn() }));

    await running.createOrOpenProlificStudy();

    expect(createProlificStudyIdFile).not.toHaveBeenCalled();
    expect(running.state.prolificStudyState).toBe("idle");
  });

  it("clears prepared IDs and completion codes when switching studies", async () => {
    const previousExperiment = { id: 1 };
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 2 },
      viewingPreviousExperiment: true,
      previousExperimentViewed: { previousExperimentStatus: "RUNNING" },
    });
    running.state.completionCode = { code: "prior-code" };
    running.state.preparedProlificStudyId = "prior-study";
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getDataFolderCsvLength.mockResolvedValue([0, false]);

    await running.componentDidUpdate({ activeExperiment: previousExperiment });

    expect(running.state.completionCode).toBeUndefined();
    expect(running.state.preparedProlificStudyId).toBeNull();
  });
});
