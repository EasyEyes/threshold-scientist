import { deriveStudyActions } from "../studyActions";

describe("deriveStudyActions", () => {
  it("shows Run and Create Prolific study for a runnable study", () => {
    expect(
      deriveStudyActions({
        repositoryIsEmpty: false,
        isRunning: true,
        pavloviaIsReady: true,
      }),
    ).toEqual({
      showRun: true,
      showCreateProlificStudy: true,
    });
  });

  it.each([
    [true, true, true],
    [false, false, true],
    [false, true, false],
  ])(
    "hides both actions when repositoryIsEmpty=%s, isRunning=%s, pavloviaIsReady=%s",
    (repositoryIsEmpty, isRunning, pavloviaIsReady) => {
      expect(
        deriveStudyActions({
          repositoryIsEmpty,
          isRunning,
          pavloviaIsReady,
        }),
      ).toEqual({
        showRun: false,
        showCreateProlificStudy: false,
      });
    },
  );

  it("keeps Run and Create Prolific study visibility identical for every input", () => {
    for (const repositoryIsEmpty of [false, true]) {
      for (const isRunning of [false, true]) {
        for (const pavloviaIsReady of [false, true]) {
          const actions = deriveStudyActions({
            repositoryIsEmpty,
            isRunning,
            pavloviaIsReady,
          });

          expect(actions.showRun).toBe(actions.showCreateProlificStudy);
        }
      }
    }
  });
});
