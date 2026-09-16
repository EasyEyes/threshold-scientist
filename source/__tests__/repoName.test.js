import {
  IllegalRepoNameError,
  MAX_REPO_BASE_NAME_LENGTH,
  assertValidRepoBaseName,
  repoBaseNameFromSpreadsheetFileName,
  versionedRepoName,
} from "../../threshold/preprocess/repoName";

describe("repoBaseNameFromSpreadsheetFileName", () => {
  it("keeps a trailing dash from the spreadsheet name", () => {
    expect(repoBaseNameFromSpreadsheetFileName("Acuity2026-.xlsx")).toBe(
      "Acuity2026-",
    );
  });

  it("strips only the last extension, not earlier dots", () => {
    expect(repoBaseNameFromSpreadsheetFileName("Study.v2.xlsx")).toBe(
      "Study.v2",
    );
  });

  it("strips .csv as well as .xlsx", () => {
    expect(repoBaseNameFromSpreadsheetFileName("Acuity2026-.csv")).toBe(
      "Acuity2026-",
    );
  });
});

describe("assertValidRepoBaseName", () => {
  it("accepts a name that ends with a dash, so a version integer can follow it", () => {
    expect(assertValidRepoBaseName("Acuity2026-")).toBe("Acuity2026-");
  });

  it("accepts letters, digits, underscores, dots, and dashes", () => {
    expect(assertValidRepoBaseName("My_Study.v2-")).toBe("My_Study.v2-");
  });

  it("rejects spaces instead of rewriting them", () => {
    expect(() => assertValidRepoBaseName("My Study")).toThrow(
      IllegalRepoNameError,
    );
    expect(() => assertValidRepoBaseName("My Study")).toThrow(/space/);
  });

  it("rejects a leading dash, underscore, or dot instead of stripping it", () => {
    expect(() => assertValidRepoBaseName("-Acuity2026")).toThrow(/start/);
    expect(() => assertValidRepoBaseName("_Acuity2026")).toThrow(/start/);
    expect(() => assertValidRepoBaseName(".Acuity2026")).toThrow(/start/);
  });

  it("rejects characters GitLab does not allow in a project slug", () => {
    expect(() => assertValidRepoBaseName("Acuity2026!")).toThrow(/!/);
    expect(() => assertValidRepoBaseName("Acuity2026+")).toThrow(/\+/);
  });

  it("rejects consecutive special characters", () => {
    expect(() => assertValidRepoBaseName("Acuity2026--")).toThrow(
      /consecutive/,
    );
  });

  it("rejects an empty name", () => {
    expect(() => assertValidRepoBaseName("")).toThrow(/no name/);
  });

  it("rejects a name that is too long", () => {
    const tooLong = `A${"x".repeat(MAX_REPO_BASE_NAME_LENGTH)}`;
    expect(() => assertValidRepoBaseName(tooLong)).toThrow(/characters long/);
  });
});

describe("versionedRepoName", () => {
  it("appends 1 to a new study whose name ends with a dash", () => {
    expect(versionedRepoName("Acuity2026-", [], true)).toBe("Acuity2026-1");
  });

  it("appends the next integer after existing versions of the same name", () => {
    expect(
      versionedRepoName(
        "Acuity2026-",
        [{ name: "Acuity2026-7" }, { name: "Acuity2026-8" }],
        true,
      ),
    ).toBe("Acuity2026-9");
  });

  it("does not treat a previously sanitized name as a version of this one", () => {
    expect(
      versionedRepoName("Acuity2026-", [{ name: "Acuity20268" }], true),
    ).toBe("Acuity2026-1");
  });

  it("reuses the current suffix when not creating a new experiment", () => {
    expect(
      versionedRepoName("Acuity2026-", [{ name: "Acuity2026-8" }], false),
    ).toBe("Acuity2026-8");
  });
});
