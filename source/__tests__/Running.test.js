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
import { prolificCreateDraft } from "../components/prolificIntegration";
import {
  createProlificStudyIdFile,
  generateAndUploadCompletionURL,
  getProlificStudyId,
} from "../../threshold/preprocess/gitlabUtils";

describe("Running Prolific study creation", () => {
  it("opens a newly created Prolific study after the first click", async () => {
    const user = { currentExperiment: {} };
    const activeExperiment = { id: 42 };
    const running = new Running({
      user,
      activeExperiment,
      projectName: "Contrast sensitivity",
      prolificToken: "token",
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
});
