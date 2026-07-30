import StatusLines from "../StatusLines";
import { isEmptyRepository } from "../repositoryState";

describe("StatusLines - empty repositories", () => {
  it("only classifies explicit GitLab empty-repository states as empty", () => {
    expect(isEmptyRepository({ empty_repo: true })).toBe(true);
    expect(isEmptyRepository({ default_branch: null })).toBe(true);
    expect(isEmptyRepository({ default_branch: "master" })).toBe(false);
    expect(isEmptyRepository({ id: 123 })).toBe(false);
  });

  it("does not query Prolific when an empty repository is selected", async () => {
    const getProlificStudySubmissionDetails = jest.fn();
    const fakeThis = {
      props: {
        activeExperiment: {
          id: 533761,
          name: "failed-compilation",
          empty_repo: true,
          default_branch: null,
        },
        functions: { getProlificStudySubmissionDetails },
      },
      getProlificStudyStatus: jest.fn(),
    };

    await StatusLines.prototype.componentDidUpdate.call(fakeThis, {
      activeExperiment: "new",
    });

    expect(fakeThis.getProlificStudyStatus).not.toHaveBeenCalled();
    expect(getProlificStudySubmissionDetails).not.toHaveBeenCalled();
  });
});
