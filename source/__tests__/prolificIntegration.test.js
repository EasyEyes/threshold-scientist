import {
  prolificCreateDraft,
  getProlificAccount,
  getProlificStudySubmissions,
  downloadDemographicData,
} from "../components/prolificIntegration";
import {
  COMPLETION_CODE_ACTION,
  COMPLETION_CODE_TYPE,
} from "../components/prolificConstants";

// Mock global fetch
global.fetch = jest.fn();

describe("Prolific Integration - New Parameters", () => {
  let mockUser;
  let mockToken;
  let mockInternalName;
  let mockCompletionCode;
  let mockIncompatibleCode;
  let mockAbortedCode;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default values
    mockToken = "test-prolific-token";
    mockInternalName = "TestExperiment";
    mockCompletionCode = "COMPLETED123";
    mockIncompatibleCode = "INCOMPATIBLE456";
    mockAbortedCode = "ABORTED789";

    // Setup base mock user
    mockUser = {
      currentExperiment: {
        titleOfStudy: "Test Study",
        descriptionOfStudy: "Test Description",
        experimentUrl: "https://example.com/experiment",
        _participantsHowMany: "10",
        _participantDurationMinutes: "30",
        _online2Pay: "5",
        _online2PayPerHour: "10",
        _online1InternalName: "",
        _online3DeviceKind: "desktop",
        _online3RequiredServices: "",
        _online4Location: "",
        _online4CustomAllowList: "",
        _online4CustomBlockList: "",
      },
    };

    // Mock fetch to return success
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        status: "UNPUBLISHED",
        id: "test-study-id",
      }),
    });
  });

  describe("_prolific2CompletionPath Parameter", () => {
    it("should default to AUTOMATICALLY_APPROVE when _prolific2CompletionPath is not set", async () => {
      // Don't set _prolific2CompletionPath, should default to approveAndPay
      const result = await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/prolific/studies/",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            authorization: `Token ${mockToken}`,
          }),
        }),
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // Find the COMPLETED code completion_code entry
      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode).toBeDefined();
      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
      });
    });

    it("should set MANUALLY_REVIEW when _prolific2CompletionPath is 'manuallyReview'", async () => {
      mockUser.currentExperiment._prolific2CompletionPath = "manuallyReview";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
      });
    });

    it("should set AUTOMATICALLY_APPROVE when _prolific2CompletionPath is 'approveAndPay'", async () => {
      mockUser.currentExperiment._prolific2CompletionPath = "approveAndPay";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
      });
    });

    it("should set REQUEST_RETURN when _prolific2CompletionPath is 'requestAReturn'", async () => {
      mockUser.currentExperiment._prolific2CompletionPath = "requestAReturn";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
      });
    });
  });

  describe("_prolific2CompletionPathAddToGroup Parameter", () => {
    it("should not add participant group action when _prolific2CompletionPathAddToGroup is empty", async () => {
      mockUser.currentExperiment._prolific2CompletionPathAddToGroup = "";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      // Should only have one action (the completion action, not the group action)
      const groupActions = completedCode.actions.filter(
        (action) =>
          action.action === COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      );

      expect(groupActions).toHaveLength(0);
    });

    it("should not add participant group action when _prolific2CompletionPathAddToGroup is not set", async () => {
      // Don't set the parameter at all
      delete mockUser.currentExperiment._prolific2CompletionPathAddToGroup;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      const groupActions = completedCode.actions.filter(
        (action) =>
          action.action === COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      );

      expect(groupActions).toHaveLength(0);
    });

  });

  describe("_prolific2Aborted Parameter", () => {
    it("should default to REQUEST_RETURN when _prolific2Aborted is not set", async () => {
      // Don't set _prolific2Aborted, should default to requestAReturn
      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode).toBeDefined();
      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
        return_reason: "Study aborted"
      });
    });

    it("should set REQUEST_RETURN when _prolific2Aborted is 'requestAReturn'", async () => {
      mockUser.currentExperiment._prolific2Aborted = "requestAReturn";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
        return_reason: "Study aborted",
      });
    });

    it("should set AUTOMATICALLY_APPROVE when _prolific2Aborted is 'approveAndPay'", async () => {
      mockUser.currentExperiment._prolific2Aborted = "approveAndPay";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
      });
    });

    it("should set MANUALLY_REVIEW when _prolific2Aborted is 'manuallyReview'", async () => {
      mockUser.currentExperiment._prolific2Aborted = "manuallyReview";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
      });
    });

    it("should default to REQUEST_RETURN for invalid _prolific2Aborted value", async () => {
      mockUser.currentExperiment._prolific2Aborted = "invalidValue";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
        return_reason: "Study aborted",
      });
    });
  });

  describe("_prolific2AbortedAddToGroup Parameter", () => {
    it("should not add participant group action when _prolific2AbortedAddToGroup is empty", async () => {
      mockUser.currentExperiment._prolific2AbortedAddToGroup = "";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      const groupActions = abortedCode.actions.filter(
        (action) =>
          action.action === COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      );

      expect(groupActions).toHaveLength(0);
    });

    it("should not add participant group action when _prolific2AbortedAddToGroup is not set", async () => {
      delete mockUser.currentExperiment._prolific2AbortedAddToGroup;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      const groupActions = abortedCode.actions.filter(
        (action) =>
          action.action === COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      );

      expect(groupActions).toHaveLength(0);
    });

  });

  describe("INCOMPATIBLE_DEVICE Completion Code", () => {
    it("should always set REQUEST_RETURN for incompatible device code", async () => {
      // Set various completion paths, but incompatible should always be REQUEST_RETURN
      mockUser.currentExperiment._prolific2CompletionPath = "approveAndPay";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const incompatibleCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.INCOMPATIBLE_DEVICE,
      );

      expect(incompatibleCode).toBeDefined();
      expect(incompatibleCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
        return_reason: "Incompatible device",
      });
    });
  });
});
