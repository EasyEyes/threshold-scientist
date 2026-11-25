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
      actionsDisabled: false,
    });
  });

  it("shows both actions disabled when Pavlovia refused activation for lack of credit", () => {
    expect(
      deriveStudyActions({
        repositoryIsEmpty: false,
        isRunning: false,
        pavloviaIsReady: false,
        needsPavloviaCredit: true,
      }),
    ).toEqual({
      showRun: true,
      showCreateProlificStudy: true,
      actionsDisabled: true,
    });
  });

  it("disables both actions for a RUNNING study that has no license or credit", () => {
    expect(
      deriveStudyActions({
        repositoryIsEmpty: false,
        isRunning: true,
        pavloviaIsReady: true,
        needsPavloviaCredit: true,
      }),
    ).toEqual({
      showRun: true,
      showCreateProlificStudy: true,
      actionsDisabled: true,
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
        actionsDisabled: false,
      });
    },
  );

  it("keeps Run and Create Prolific study visibility identical for every input", () => {
    for (const repositoryIsEmpty of [false, true]) {
      for (const isRunning of [false, true]) {
        for (const pavloviaIsReady of [false, true]) {
          for (const needsPavloviaCredit of [false, true]) {
            const actions = deriveStudyActions({
              repositoryIsEmpty,
              isRunning,
              pavloviaIsReady,
              needsPavloviaCredit,
            });

            expect(actions.showRun).toBe(actions.showCreateProlificStudy);
          }
        }
      }
    }
  });
});
