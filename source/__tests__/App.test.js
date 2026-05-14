// Mocks must be declared before any imports that trigger module evaluation
jest.mock("../components/firebase", () => ({ auth: {}, db: {} }));
jest.mock("../components/steps", () => ({
  allSteps: jest.fn().mockReturnValue(["login", "table", "upload", "running"]),
}));
jest.mock("../components/prolificIntegration", () => ({
  getProlificAccount: jest.fn(),
  getProlificStudySubmissions: jest.fn(),
}));
jest.mock("firebase/database", () => ({
  set: jest.fn(),
  ref: jest.fn(),
  get: jest.fn(),
}));
jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn().mockResolvedValue({}),
}));
jest.mock("@firebase/util", () => ({ uuidv4: jest.fn() }));
jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));
jest.mock("../../threshold/components/compatibilityCheck", () => ({
  getCompatibilityRequirements: jest
    .fn()
    .mockReturnValue({ compatibilityRequirements: [""] }),
}));
jest.mock("../../threshold/preprocess/global", () => ({
  compatibilityRequirements: { t: "", parsedInfo: null },
}));
jest.mock("../../threshold/preprocess/retry", () => ({
  getRetryDelayMs: jest.fn().mockReturnValue(0),
}));
jest.mock("../../threshold/preprocess/constants", () => ({
  resourcesFileTypes: ["images", "fonts"],
}));
jest.mock("../sentry", () => ({ captureError: jest.fn() }));
jest.mock("../components/firebase_soundProfile", () => ({
  getSoundProfileStatement: jest.fn().mockResolvedValue(""),
}));
jest.mock("../Step", () => () => null);
jest.mock("../StatusLines", () => () => null);

// User mock — initProjectList captures this.projectList at call time
let MockUserInstances = [];
let mockInitProjectList;

jest.mock("../../threshold/preprocess/gitlabUtils", () => {
  const MockUser = jest.fn().mockImplementation(function (token) {
    this.accessToken = token;
    this.username = "";
    this.name = "";
    this.id = "";
    this.avatar_url = "";
    this.projectList = Promise.resolve([]);
    this.currentExperiment = {
      participantRecruitmentServiceName: "",
      participantRecruitmentServiceUrl: "",
      participantRecruitmentServiceCode: "",
      experimentUrl: "",
      pavloviaOfferPilotingOptionBool: false,
      pavloviaPreferRunningModeBool: true,
    };
    this.initProjectList = mockInitProjectList;
    MockUserInstances.push(this);
  });

  return {
    User: MockUser,
    getCompatibilityRequirementsForProject: jest.fn(),
    getExperimentStatus: jest.fn(),
    getOriginalFileNameForProject: jest.fn(),
    getRecruitmentServiceConfig: jest.fn(),
    getDurationForProject: jest.fn(),
    getProlificStudyId: jest.fn(),
    getCommonResourcesNames: jest.fn(),
  };
});

import App from "../App";

describe("App - handleReturnToStep", () => {
  const STEPS = ["login", "table", "upload", "running"];

  beforeEach(() => {
    MockUserInstances = [];
    mockInitProjectList = jest.fn().mockResolvedValue(undefined);
    // Re-wire the mock constructor to pick up the freshly reset mockInitProjectList
    const { User } = require("../../threshold/preprocess/gitlabUtils");
    User.mockImplementation(function (token) {
      this.accessToken = token;
      this.username = "";
      this.name = "";
      this.id = "";
      this.avatar_url = "";
      this.projectList = Promise.resolve([]);
      this.currentExperiment = {
        participantRecruitmentServiceName: "",
        participantRecruitmentServiceUrl: "",
        participantRecruitmentServiceCode: "",
        experimentUrl: "",
        pavloviaOfferPilotingOptionBool: false,
        pavloviaPreferRunningModeBool: true,
      };
      this.initProjectList = mockInitProjectList;
      MockUserInstances.push(this);
    });
  });

  it("preserves the projectList promise reference on the refreshed User", async () => {
    const existingProjectList = Promise.resolve([{ name: "MyExperiment" }]);

    // Capture this.projectList at the moment initProjectList is called
    let projectListAtCallTime;
    mockInitProjectList = jest.fn(function (forceRefresh) {
      projectListAtCallTime = this.projectList;
      return Promise.resolve();
    });

    // Re-wire with the updated spy (beforeEach ran with stale fn reference)
    const { User } = require("../../threshold/preprocess/gitlabUtils");
    User.mockImplementation(function (token) {
      this.accessToken = token;
      this.username = "";
      this.name = "";
      this.id = "";
      this.avatar_url = "";
      this.projectList = Promise.resolve([]);
      this.currentExperiment = {
        participantRecruitmentServiceName: "",
        participantRecruitmentServiceUrl: "",
        participantRecruitmentServiceCode: "",
        experimentUrl: "",
        pavloviaOfferPilotingOptionBool: false,
        pavloviaPreferRunningModeBool: true,
      };
      this.initProjectList = mockInitProjectList;
      MockUserInstances.push(this);
    });

    const currentUser = {
      accessToken: "test-token",
      username: "testuser",
      name: "Test User",
      id: "42",
      avatar_url: "https://example.com/avatar.png",
      projectList: existingProjectList,
    };

    // Call the method directly on a fake 'this', avoiding full App construction
    const fakeThis = {
      state: { user: currentUser, currentStep: "running" },
      setState: jest.fn((update) => {
        fakeThis.state = { ...fakeThis.state, ...update };
      }),
      allSteps: STEPS,
    };

    await App.prototype.handleReturnToStep.call(fakeThis, "table");

    // initProjectList must have been called with force-refresh = true
    expect(mockInitProjectList).toHaveBeenCalledWith(true);

    // At the time initProjectList ran, this.projectList must be the original promise
    expect(projectListAtCallTime).toBe(existingProjectList);
  });
});
