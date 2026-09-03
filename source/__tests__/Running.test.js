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

import Running from "../Running";
import { render, screen } from "@testing-library/react";
import { prolificCreateDraft } from "../components/prolificIntegration";
import {
  createProlificStudyIdFile,
  generateAndUploadCompletionURL,
  getDataFolderCsvLength,
  getProlificStudyId,
} from "../../threshold/preprocess/gitlabUtils";

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
