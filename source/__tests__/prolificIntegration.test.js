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
  let mockGlossaryData;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default values
    mockToken = "test-prolific-token";
    mockGlossaryData = {
      glossary: {
        _online1Title: { default: "Default Title" },
        _online2Description: { default: "Default Description" },
      },
    };
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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

    it("should add participant group action when _prolific2CompletionPathAddToGroup is specified", async () => {
      const groupId = "test-group-id-123";
      mockUser.currentExperiment._prolific2CompletionPathAddToGroup = groupId;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: groupId,
      });
    });

    it("should trim whitespace from _prolific2CompletionPathAddToGroup", async () => {
      const groupId = "test-group-id-456";
      mockUser.currentExperiment._prolific2CompletionPathAddToGroup = `  ${groupId}  `;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: groupId,
      });
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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
        mockGlossaryData,
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

    it("should add participant group action when _prolific2AbortedAddToGroup is specified", async () => {
      const groupId = "aborted-group-id-123";
      mockUser.currentExperiment._prolific2AbortedAddToGroup = groupId;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: groupId,
      });
    });

    it("should trim whitespace from _prolific2AbortedAddToGroup", async () => {
      const groupId = "aborted-group-id-456";
      mockUser.currentExperiment._prolific2AbortedAddToGroup = `  ${groupId}  `;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: groupId,
      });
    });
  });

  describe("Combined Parameter Tests", () => {
    it("should correctly handle both completion path and group for completed participants", async () => {
      const completionGroupId = "completion-group-789";
      mockUser.currentExperiment._prolific2CompletionPath = "manuallyReview";
      mockUser.currentExperiment._prolific2CompletionPathAddToGroup =
        completionGroupId;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );

      // Should have both actions
      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
      });
      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: completionGroupId,
      });
      expect(completedCode.actions).toHaveLength(2);
    });

    it("should correctly handle both aborted path and group for aborted participants", async () => {
      const abortedGroupId = "aborted-group-999";
      mockUser.currentExperiment._prolific2Aborted = "approveAndPay";
      mockUser.currentExperiment._prolific2AbortedAddToGroup = abortedGroupId;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );

      // Should have both actions
      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
      });
      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: abortedGroupId,
      });
      expect(abortedCode.actions).toHaveLength(2);
    });

    it("should handle all four parameters simultaneously", async () => {
      const completionGroupId = "completion-all-test";
      const abortedGroupId = "aborted-all-test";

      mockUser.currentExperiment._prolific2CompletionPath = "requestAReturn";
      mockUser.currentExperiment._prolific2CompletionPathAddToGroup =
        completionGroupId;
      mockUser.currentExperiment._prolific2Aborted = "manuallyReview";
      mockUser.currentExperiment._prolific2AbortedAddToGroup = abortedGroupId;

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // Verify completed code actions
      const completedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.COMPLETED,
      );
      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
      });
      expect(completedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: completionGroupId,
      });

      // Verify aborted code actions
      const abortedCode = requestBody.completion_codes.find(
        (code) => code.code_type === COMPLETION_CODE_TYPE.ABORTED,
      );
      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
      });
      expect(abortedCode.actions).toContainEqual({
        action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
        participant_group_id: abortedGroupId,
      });
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
        mockGlossaryData,
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

  describe("glossaryData fallback defaults", () => {
    it("uses glossaryData title default when titleOfStudy is empty", async () => {
      mockUser.currentExperiment.titleOfStudy = "";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.name).toBe("Default Title");
    });

    it("uses glossaryData description default when descriptionOfStudy is empty", async () => {
      mockUser.currentExperiment.descriptionOfStudy = "";

      await prolificCreateDraft(
        mockUser,
        mockInternalName,
        mockCompletionCode,
        mockIncompatibleCode,
        mockAbortedCode,
        mockToken,
        mockGlossaryData,
      );

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.description).toBe("Default Description");
    });
  });
});
