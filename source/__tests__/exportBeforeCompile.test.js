/**
 * Tests for the pre-compile export (exportBeforeCompile.ts): the gray
 * "Select file for export" flow that packages a study into
 * name.raw.source.zip without compiling it, tolerantly, so that even a study
 * with compiler errors can be shared, e.g. for a bug report.
 */
import JSZip from "jszip";

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("file-saver", () => ({
  saveAs: jest.fn(),
}));

jest.mock("../../threshold/components/sentry", () => ({
  captureError: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getCommonResourcesNames: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
}));

jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn() },
}));

jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: jest.fn(() => ({
    clientId: "client-id",
    redirectUri: "https://example.test/redirect",
  })),
}));

jest.mock("../../threshold/preprocess/auth/ensureValidToken", () => ({
  ensureValidToken: jest.fn(),
}));

jest.mock("../../threshold/preprocess/user", () => ({
  redirectToOauth2: jest.fn(),
}));

jest.mock("../../threshold/preprocess/fileUtils", () => ({
  ...jest.requireActual("../../threshold/preprocess/fileUtils"),
  getBase64FileDataFromGitLab: jest.fn(),
  getTextFileDataFromGitLab: jest.fn(),
}));

const {
  exportStudyBeforeCompiling,
  collectResourceTokens,
  isResourceReferenced,
} = require("../../threshold/preprocess/exportBeforeCompile");
const { saveAs } = require("file-saver");
const Swal = require("sweetalert2");
const {
  getCommonResourcesNames,
} = require("../../threshold/preprocess/gitlabUtils");
const {
  searchProjectByName,
} = require("../../threshold/preprocess/gitlabSearch");
const {
  GitLabOAuthClient,
} = require("../../threshold/preprocess/auth/gitlabOAuthClient");
const {
  ensureValidToken,
} = require("../../threshold/preprocess/auth/ensureValidToken");
const {
  getBase64FileDataFromGitLab,
  getTextFileDataFromGitLab,
} = require("../../threshold/preprocess/fileUtils");

const user = { id: 1, username: "alice" };

const emptyRepo = () => ({
  fonts: [],
  forms: [],
  texts: [],
  folders: [],
  images: [],
  code: [],
  impulseResponses: [],
  frequencyResponses: [],
  targetSoundLists: [],
  phrases: [],
});

const savedZip = async () => {
  expect(saveAs).toHaveBeenCalledTimes(1);
  const [blob, name] = saveAs.mock.calls[0];
  return { zip: await JSZip.loadAsync(blob), name };
};

describe("collectResourceTokens", () => {
  it("collects trimmed, lowercased cell values and comma-separated parts, skipping column A", () => {
    const tokens = collectResourceTokens([
      ["font", " Sloan.woff2 ", "Pelli.woff2, Sloan.woff2"],
      ["maskerSoundFolder", "Noise"],
      ["%comment", "commented.txt"],
      ["readingCorpus", ""],
    ]);

    expect(tokens.has("sloan.woff2")).toBe(true);
    expect(tokens.has("pelli.woff2")).toBe(true);
    expect(tokens.has("noise")).toBe(true);
    // Commented rows are included: over-inclusion keeps the export complete.
    expect(tokens.has("commented.txt")).toBe(true);
    // Parameter names (column A) are not resource references.
    expect(tokens.has("font")).toBe(false);
    expect(tokens.has("")).toBe(false);
  });
});

describe("isResourceReferenced", () => {
  it("matches file names exactly, case-insensitively", () => {
    const tokens = new Set(["sloan.woff2"]);
    expect(isResourceReferenced(tokens, "Sloan.woff2")).toBe(true);
    expect(isResourceReferenced(tokens, "Other.woff2")).toBe(false);
  });

  it("matches zipped folders referenced without the .zip extension", () => {
    const tokens = new Set(["noise"]);
    expect(isResourceReferenced(tokens, "noise.zip")).toBe(true);
    expect(isResourceReferenced(tokens, "silence.zip")).toBe(false);
  });
});

describe("exportStudyBeforeCompiling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureValidToken.mockResolvedValue(true);
    GitLabOAuthClient.loadFromStorage.mockReturnValue({});
    searchProjectByName.mockResolvedValue({ id: "7" });
    getCommonResourcesNames.mockResolvedValue(emptyRepo());
  });

  it("zips the spreadsheet verbatim with the repo resources it references", async () => {
    getCommonResourcesNames.mockResolvedValue({
      ...emptyRepo(),
      fonts: ["Sloan.woff2", "Unused.woff2"],
      folders: ["noise.zip"],
      texts: ["story.txt"],
    });
    getBase64FileDataFromGitLab.mockImplementation(async (repoId, path) =>
      Buffer.from(`binary of ${path}`).toString("base64"),
    );
    getTextFileDataFromGitLab.mockResolvedValue("Once upon a time");

    const csv =
      "_about,my broken study\n" +
      "font,Sloan.woff2\n" +
      "maskerSoundFolder,noise\n" +
      "readingCorpus,story.txt\n";
    const errors = await exportStudyBeforeCompiling(user, [
      new File([csv], "myStudy.csv"),
    ]);

    expect(errors).toEqual([]);
    const { zip, name } = await savedZip();
    // ".raw" marks the uncompiled archive, distinguishing it from the
    // rigorous post-compile source.zip. The ".source.zip" suffix is how the
    // compiler's dropzone recognizes compilable archives (older ".export.zip"
    // names are still accepted when reading).
    expect(name).toBe("myStudy.raw.source.zip");
    expect(name).toMatch(/\.source\.zip$/);
    expect(Object.keys(zip.files).sort()).toEqual([
      "Sloan.woff2",
      "myStudy.csv",
      "noise.zip",
      "story.txt",
    ]);
    expect(await zip.file("myStudy.csv").async("string")).toBe(csv);
    expect(await zip.file("Sloan.woff2").async("string")).toBe(
      "binary of fonts/Sloan.woff2",
    );
    expect(await zip.file("story.txt").async("string")).toBe(
      "Once upon a time",
    );
    expect(getTextFileDataFromGitLab).toHaveBeenCalledWith(
      7,
      "texts/story.txt",
      expect.anything(),
    );
    expect(Swal.close).toHaveBeenCalled();
  });

  it("bundles files selected alongside the spreadsheet verbatim", async () => {
    const errors = await exportStudyBeforeCompiling(user, [
      new File(["a,b"], "myStudy.csv"),
      new File(["font bytes"], "Fresh.woff2"),
    ]);

    expect(errors).toEqual([]);
    const { zip } = await savedZip();
    expect(await zip.file("Fresh.woff2").async("string")).toBe("font bytes");
  });

  it("still exports when a resource cannot be fetched (the later compile will complain)", async () => {
    getCommonResourcesNames.mockResolvedValue({
      ...emptyRepo(),
      fonts: ["Sloan.woff2"],
    });
    getBase64FileDataFromGitLab.mockRejectedValue(new Error("network down"));
    const consoleWarn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const errors = await exportStudyBeforeCompiling(user, [
      new File(["font,Sloan.woff2\n"], "myStudy.csv"),
    ]);

    expect(errors).toEqual([]);
    const { zip } = await savedZip();
    expect(Object.keys(zip.files)).toEqual(["myStudy.csv"]);

    consoleWarn.mockRestore();
  });

  it("reports an export error when no spreadsheet is selected", async () => {
    const errors = await exportStudyBeforeCompiling(user, [
      new File(["%PDF"], "consent.pdf"),
    ]);

    expect(saveAs).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
    expect(errors[0].context).toBe("export");
    expect(errors[0].kind).toBe("error");
    expect(errors[0].name).toBe("No spreadsheet selected");
    expect(errors[0].message).toContain("consent.pdf");
  });

  it("treats resource spreadsheets (e.g. *.gainVTime.xlsx) as companions, not the experiment", async () => {
    const errors = await exportStudyBeforeCompiling(user, [
      new File(["a,b"], "loudspeaker.gainVTime.csv"),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe("No spreadsheet selected");
  });

  it("reports an export error when the spreadsheet cannot be read", async () => {
    const errors = await exportStudyBeforeCompiling(user, [
      new File(["not really an xlsx"], "myStudy.xlsx"),
    ]);

    expect(saveAs).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
    expect(errors[0].context).toBe("export");
    expect(errors[0].name).toBe("Cannot read spreadsheet");
    expect(Swal.close).toHaveBeenCalled();
  });

  it("reports an export error when zipping or saving fails unexpectedly", async () => {
    saveAs.mockImplementation(() => {
      throw new Error("disk full");
    });

    const errors = await exportStudyBeforeCompiling(user, [
      new File(["a,b"], "myStudy.csv"),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0].context).toBe("export");
    expect(errors[0].name).toBe("Export failed");
    expect(errors[0].message).toContain("disk full");
    expect(Swal.close).toHaveBeenCalled();
  });

  it("aborts silently when authentication fails (the user is redirected to log in)", async () => {
    ensureValidToken.mockResolvedValue(false);

    const errors = await exportStudyBeforeCompiling(user, [
      new File(["a,b"], "myStudy.csv"),
    ]);

    expect(errors).toEqual([]);
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
  });
});
