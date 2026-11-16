const state = () => window.__EASYEYES_E2E__;

// The diagnostics fixture renders Table but must never upload a study.
const unexpectedCompileAction = () => {
  throw new Error("Study uploads are not configured in the E2E harness.");
};
export const manuallySetSwalTitle = unexpectedCompileAction;
export const searchRepoNameMatches = unexpectedCompileAction;
export const fetchPhraseFileFromResources = unexpectedCompileAction;
export const copyUser = unexpectedCompileAction;
export const setRepoName = unexpectedCompileAction;
export const gatherGeneratedFileActions = unexpectedCompileAction;
export const gatherUserUploadedFileActions = unexpectedCompileAction;
export const gatherRequestedResourceActions = unexpectedCompileAction;

export const getDataFolderCsvLength = async () => [0, false];
export const getAllProjects = async () => [];
export const runExperiment = async () => ({ newStatus: "RUNNING" });
export const getRetryDelayMs = () => 0;
export const downloadCommonResources = async () => {};
export const downloadDataFolder = async () => {};
export const getExperimentStatus = async () => "RUNNING";

export const getProlificStudyId = async (_user, repositoryId) =>
  state().repositories[repositoryId].files["ProlificStudyId.txt"] ?? null;

export const createProlificStudyIdFile = async (
  activeExperiment,
  _user,
  studyId,
) => {
  const repository = state().repositories[activeExperiment.id];
  repository.files["ProlificStudyId.txt"] = studyId;
  repository.commits.push({ action: "create", path: "ProlificStudyId.txt" });
};

export const generateAndUploadCompletionURL = async (
  _user,
  activeExperiment,
) => {
  const repository = state().repositories[activeExperiment.id];
  repository.files["recruitmentServiceConfig.csv"] =
    "name,completionCode\nProlific,COMPLETE";
  repository.commits.push({
    action: "create",
    path: "recruitmentServiceConfig.csv",
  });
  return {
    code: "COMPLETE",
    incompatibleCompletionCode: "INCOMPATIBLE",
    abortedCompletionCode: "ABORTED",
  };
};
