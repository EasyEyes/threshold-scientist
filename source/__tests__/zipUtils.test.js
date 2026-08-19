/**
 * isSourceArchiveFileName: dropped study archives are recognized by suffix.
 * New archives use *.source.zip; older *.export.zip files still compile.
 */
const {
  isSourceArchiveFileName,
} = require("../../threshold/preprocess/zipUtils");

describe("isSourceArchiveFileName", () => {
  it("accepts the current *.source.zip suffix", () => {
    expect(isSourceArchiveFileName("study.source.zip")).toBe(true);
    expect(isSourceArchiveFileName("study.raw.source.zip")).toBe(true);
  });

  it("accepts the former *.export.zip suffix for backward compatibility", () => {
    expect(isSourceArchiveFileName("study.export.zip")).toBe(true);
    expect(isSourceArchiveFileName("study.lax.export.zip")).toBe(true);
    expect(isSourceArchiveFileName("study.lax.source.zip")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSourceArchiveFileName("Study.SOURCE.ZIP")).toBe(true);
    expect(isSourceArchiveFileName("Study.EXPORT.ZIP")).toBe(true);
  });

  it("rejects other zip files and non-archives", () => {
    expect(isSourceArchiveFileName("mySounds.zip")).toBe(false);
    expect(isSourceArchiveFileName("study.xlsx")).toBe(false);
    expect(isSourceArchiveFileName("study.source.zip.txt")).toBe(false);
  });
});
