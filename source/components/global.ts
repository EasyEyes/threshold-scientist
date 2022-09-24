export interface Experiment {
  participantRecruitmentServiceName: string;
  participantRecruitmentServiceUrl: string;
  participantRecruitmentServiceCode: string;
  experimentUrl: string;
}

export const experimentRecruitmentAndRunInfo: Experiment = {
  participantRecruitmentServiceName: "",
  participantRecruitmentServiceUrl: "",
  participantRecruitmentServiceCode: "",
  experimentUrl: "",
};

export const tempAccessToken = { t: undefined };
