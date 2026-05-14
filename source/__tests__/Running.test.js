import React from "react";
import { render, waitFor } from "@testing-library/react";
import Running from "../Running";
import Swal from "sweetalert2";

// Mock dependencies
jest.mock("firebase/database", () => ({
  get: jest.fn(),
  ref: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../components/firebase", () => ({
  db: {},
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  prolificCreateDraft: jest.fn(),
  downloadDemographicData: jest.fn(),
  downloadDataFolder: jest.fn(),
  generateAndUploadCompletionURL: jest.fn(),
  getDataFolderCsvLength: jest.fn().mockResolvedValue([0, false]),
  getExperimentStatus: jest.fn(),
  runExperiment: jest.fn(),
  createProlificStudyIdFile: jest.fn(),
  getProlificStudyId: jest.fn(),
  downloadCommonResources: jest.fn(),
  getRetryDelayMs: jest.fn().mockReturnValue(0),
  getAllProjects: jest.fn().mockResolvedValue([]),
}));

// Mock global fetch
global.fetch = jest.fn();

describe("Running Component - checkPavloviaReady", () => {
  let mockProps;
  let runningRef;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create a ref to access the component instance
    runningRef = React.createRef();

    // Setup default props
    mockProps = {
      user: {
        username: "testuser",
        currentExperiment: {
          experimentUrl: "https://example.com/experiment",
          pavloviaPreferRunningModeBool: true,
        },
        projectList: [],
      },
      projectName: "TestProject",
      activeExperiment: {
        id: "123",
        name: "Test Experiment",
      },
      newRepo: true,
      experimentStatus: "INACTIVE",
      functions: {
        handleSetExperimentStatus: jest.fn(),
        handleSetPrevExperimentStatus: jest.fn(),
        handleSetCompileCount: jest.fn(),
        handleSetProjectList: jest.fn(),
        handleSetActivateExperiment: jest.fn(),
        handleUpdateUser: jest.fn(),
        getProlificStudySubmissionDetails: jest.fn(),
      },
      viewingPreviousExperiment: false,
      previousExperimentViewed: {
        previousRecruitmentInformation: {
          recruitmentServiceName: null,
        },
        previousExperimentStatus: "INACTIVE",
      },
      scrollToCurrentStep: jest.fn(),
      prolificToken: "test-token",
    };

    // Mock Firebase get
    const { get } = require("firebase/database");
    get.mockResolvedValue({
      val: () => ({ count1: 10, count2: 20 }),
    });
  });

  describe("404 Error Handling", () => {
    it("should show 'Experiment unavailable' error when 404 occurs on last try (silentMode=false)", async () => {
      // Render component with ref
      const { container } = render(<Running {...mockProps} ref={runningRef} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Create a test instance by directly instantiating the component
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: true,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to return 404
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("404 Not Found"),
      });

      // Call checkPavloviaReady with silentMode=false (as it would be on the last try)
      const checkPromise = testInstance.checkPavloviaReady(false);

      // Wait for the promise to reject
      await expect(checkPromise).rejects.toThrow(
        "404 - Experiment Unavailable",
      );

      // Verify Swal.fire was called with the correct error message
      expect(Swal.fire).toHaveBeenCalledWith({
        title: "Experiment unavailable",
        text: "Pavlovia makes each experiment unavailable unless you either have an institutional license or you have assigned tokens to that experiment, and the experiment is in the RUNNING state. If this is due to temporary internet outage, you might succeed if you try again.",
        confirmButtonColor: "#666",
      });

      // Verify fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        "https://run.pavlovia.org/testuser/testproject",
      );

      // Verify setState was called to update pavloviaIsReady
      expect(testInstance.setState).toHaveBeenCalledWith({
        pavloviaIsReady: false,
      });
    });

    it("should NOT show error dialog when 404 occurs with silentMode=true", async () => {
      // Render component
      render(<Running {...mockProps} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Clear Swal.fire mock calls from component mounting
      Swal.fire.mockClear();

      // Create a test instance
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: true,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to return 404
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("404 Not Found"),
      });

      // Call checkPavloviaReady with silentMode=true (not the last try)
      const checkPromise = testInstance.checkPavloviaReady(true);

      // Wait for the promise to reject
      await expect(checkPromise).rejects.toThrow(
        "404 - Experiment Unavailable",
      );

      // Verify Swal.fire was NOT called
      expect(Swal.fire).not.toHaveBeenCalled();

      // Verify setState was called to update pavloviaIsReady
      expect(testInstance.setState).toHaveBeenCalledWith({
        pavloviaIsReady: false,
      });
    });

    it("should NOT show error dialog when 403 occurs (regardless of silentMode)", async () => {
      // Render component
      render(<Running {...mockProps} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Clear Swal.fire mock calls from component mounting
      Swal.fire.mockClear();

      // Create a test instance
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: true,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to return 403
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("403 Forbidden"),
      });

      // Call checkPavloviaReady with silentMode=false
      const checkPromise = testInstance.checkPavloviaReady(false);

      // Wait for the promise to reject
      await expect(checkPromise).rejects.toThrow("403 - Forbidden");

      // Verify Swal.fire was NOT called (403 doesn't show a dialog)
      expect(Swal.fire).not.toHaveBeenCalled();

      // Verify setState was called
      expect(testInstance.setState).toHaveBeenCalledWith({
        pavloviaIsReady: false,
      });
    });

    it("should resolve successfully when Pavlovia is ready", async () => {
      // Render component
      render(<Running {...mockProps} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Clear Swal.fire mock calls from component mounting
      Swal.fire.mockClear();

      // Create a test instance
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: false,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to return success (no 403 or 404)
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("200 OK - Experiment Ready"),
      });

      // Call checkPavloviaReady
      await expect(
        testInstance.checkPavloviaReady(false),
      ).resolves.toBeUndefined();

      // Verify Swal.fire was NOT called
      expect(Swal.fire).not.toHaveBeenCalled();

      // Verify setState was called to update to ready
      expect(testInstance.setState).toHaveBeenCalledWith({
        pavloviaIsReady: true,
      });
    });
  });

  describe("waitForPavloviaReady integration", () => {
    it("should show error on the last retry attempt when getting 404", async () => {
      // Render component
      render(<Running {...mockProps} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Clear Swal.fire mock calls from component mounting
      Swal.fire.mockClear();

      // Create a test instance
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: false,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to always return 404
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("404 Not Found"),
      });

      // Call waitForPavloviaReady with maxTries=2 to ensure last try shows error
      // With maxTries=2:
      //   tries=0: silentMode = (0 !== 2-1) = (0 !== 1) = true → silent (no dialog)
      //   tries=1: silentMode = (1 !== 2-1) = (1 !== 1) = false → show dialog
      // Error dialog shown ONLY on the last attempt (tries=1, when silentMode=false)
      const waitPromise = testInstance.waitForPavloviaReady(2, 10, 0); // initialDelayMs=0 for fast test

      // Wait for it to fail after all retries
      await expect(waitPromise).rejects.toThrow(
        "Failed to verify Pavlovia is ready, after 2 attempts",
      );

      // Verify Swal.fire was called once (on tries=1, the last attempt, when silentMode=false)
      // The first attempt (tries=0) has silentMode=true, so no dialog shown
      expect(Swal.fire).toHaveBeenCalledTimes(1);
      expect(Swal.fire).toHaveBeenCalledWith({
        title: "Experiment unavailable",
        text: "Pavlovia makes each experiment unavailable unless you either have an institutional license or you have assigned tokens to that experiment, and the experiment is in the RUNNING state. If this is due to temporary internet outage, you might succeed if you try again.",
        confirmButtonColor: "#666",
      });
    });

    it("should succeed and set experiment status when Pavlovia becomes ready", async () => {
      // Render component
      render(<Running {...mockProps} />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockProps.functions.handleSetCompileCount).toHaveBeenCalled();
      });

      // Clear Swal.fire mock calls from component mounting
      Swal.fire.mockClear();

      // Create a test instance
      const testInstance = new Running(mockProps);
      testInstance.setState = jest.fn((state) => {
        testInstance.state = { ...testInstance.state, ...state };
      });
      testInstance.state = {
        pavloviaIsReady: false,
        completionCode: undefined,
        dataFolderLength: 0,
        latestDateForDataCollection: false,
      };

      // Mock fetch to return success
      global.fetch.mockResolvedValue({
        text: jest.fn().mockResolvedValue("200 OK"),
      });

      // Call waitForPavloviaReady with initialDelayMs=0 for fast test
      await expect(
        testInstance.waitForPavloviaReady(3, 10, 0),
      ).resolves.toBeUndefined();

      // Verify experiment status was set to RUNNING
      expect(
        mockProps.functions.handleSetExperimentStatus,
      ).toHaveBeenCalledWith("RUNNING");

      // Verify Swal.fire was NOT called
      expect(Swal.fire).not.toHaveBeenCalled();
    });
  });
});
