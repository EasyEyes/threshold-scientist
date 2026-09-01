export const PROLIFIC_STUDY_CONFIG_PATH =
  ".easyeyes/prolific-study-config.json";

export const createProlificExperimentUrl = (experimentUrl) =>
  `${experimentUrl}?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}`;

const prolificStudyConfigFields = [
  "titleOfStudy",
  "descriptionOfStudy",
  "_online1InternalName",
  "_online2Pay",
  "_online2PayPerHour",
  "_participantDurationMinutes",
  "_participantsHowMany",
  "_prolific2Aborted",
  "_prolific2AbortedAddToGroup",
  "_prolific2CompletionPath",
  "_prolific2CompletionPathAddToGroup",
  "_prolific2DeviceKind",
  "_prolific2RequiredServices",
  "_prolific2ScreenerSet",
  "_prolific2StudyLabel",
  "_prolific3AllowAfterHours",
  "_prolific3AllowCompletedExperiment",
  "_prolific3ApprovalRate",
  "_prolific3CustomAllowList",
  "_prolific3CustomBlockList",
  "_prolific3Location",
  "_prolific3ParticipantInPreviousStudyExclude",
  "_prolific3ParticipantInPreviousStudyInclude",
  "_prolific3StudyDistribution",
  "_prolific4CochlearImplant",
  "_prolific4Dyslexia",
  "_prolific4HearingDifficulties",
  "_prolific4LanguageFirst",
  "_prolific4LanguageFluent",
  "_prolific4LanguagePrimary",
  "_prolific4LanguageRelatedDisorders",
  "_prolific4MusicalInstrumentExperience",
  "_prolific4PhoneOperatingSystem",
  "_prolific4VRExperiences",
  "_prolific4VRHeadsetFrequency",
  "_prolific4VRHeadsetOwnership",
  "_prolific4Vision",
  "_prolific4VisionCorrection",
  "prolificWorkspaceProjectId",
];

export const createProlificStudyConfig = (
  currentExperiment = {},
  overrides = {},
) => {
  const config = {};

  for (const field of prolificStudyConfigFields) {
    if (currentExperiment[field] !== undefined) {
      config[field] = currentExperiment[field];
    }
  }

  return { ...config, ...overrides };
};
