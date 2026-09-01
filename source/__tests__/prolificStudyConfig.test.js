import {
  createProlificExperimentUrl,
  createProlificStudyConfig,
} from "../components/prolificStudyConfig";

describe("createProlificStudyConfig", () => {
  it("copies only Prolific draft inputs and applies the compiled study URL", () => {
    const currentExperiment = {
      titleOfStudy: "Visual study",
      _online2Pay: "3.50",
      _prolific4Vision: "Normal",
      participantRecruitmentServiceCode: "do-not-persist",
      unrelatedSetting: "ignored",
      experimentUrl: "stale-url",
    };

    expect(
      createProlificStudyConfig(currentExperiment, {
        experimentUrl: "https://run.example/study",
      }),
    ).toEqual({
      titleOfStudy: "Visual study",
      _online2Pay: "3.50",
      _prolific4Vision: "Normal",
      experimentUrl: "https://run.example/study",
    });
  });
});

describe("createProlificExperimentUrl", () => {
  it("adds Prolific identifiers even when no recruitment service was selected during compilation", () => {
    expect(createProlificExperimentUrl("https://run.example/study")).toBe(
      "https://run.example/study?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}",
    );
  });
});
