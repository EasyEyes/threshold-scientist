// isEmptyRepository (source/repositoryState.js): the one rule Running and
// StatusLines use to tell a Pavlovia project with nothing committed yet.
import { isEmptyRepository } from "../repositoryState";

describe("isEmptyRepository", () => {
  it("is false for a missing or empty input, never an exception", () => {
    expect(isEmptyRepository(undefined)).toBe(false);
    expect(isEmptyRepository(null)).toBe(false);
    expect(isEmptyRepository({})).toBe(false);
    expect(
      isEmptyRepository({ empty_repo: false, default_branch: "master" }),
    ).toBe(false);
  });

  it("is true when GitLab reports an empty repo or no default branch", () => {
    expect(isEmptyRepository({ empty_repo: true })).toBe(true);
    expect(isEmptyRepository({ default_branch: null })).toBe(true);
    expect(
      isEmptyRepository({ empty_repo: true, default_branch: "master" }),
    ).toBe(true);
    expect(isEmptyRepository({ empty_repo: false, default_branch: null })).toBe(
      true,
    );
  });

  it("reads the fields exactly, without coercion", () => {
    expect(isEmptyRepository({ empty_repo: "true" })).toBe(false);
    expect(isEmptyRepository({ empty_repo: 1 })).toBe(false);
    expect(isEmptyRepository({ default_branch: "" })).toBe(false);
    expect(isEmptyRepository({ default_branch: undefined })).toBe(false);
  });
});
