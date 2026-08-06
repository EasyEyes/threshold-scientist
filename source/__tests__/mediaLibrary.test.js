import {
  MEDIA_BASE_URL,
  addMedia,
  formatFileSize,
  isNameTaken,
  listMedia,
  mediaUrlForPath,
  resetMediaLibrary,
  sanitizeMediaFileName,
} from "../components/mediaLibrary";

describe("sanitizeMediaFileName", () => {
  it("removes the spaces and capitals that forced percent-encoding in old links", () => {
    expect(sanitizeMediaFileName("Stiff objects.png")).toBe(
      "stiff-objects.png",
    );
  });

  it("strips accents and punctuation so a link never needs escaping", () => {
    expect(sanitizeMediaFileName("Café (final)!.JPG")).toBe("cafe-final.jpg");
  });

  it("collapses runs of separators", () => {
    expect(sanitizeMediaFileName("a  b__c--d.mp3")).toBe("a-b-c-d.mp3");
  });

  it("keeps a usable name when there is no extension", () => {
    expect(sanitizeMediaFileName("read me")).toBe("read-me");
  });

  it("falls back to a placeholder stem rather than an empty name", () => {
    expect(sanitizeMediaFileName("___.png")).toBe("file.png");
  });
});

describe("mediaUrlForPath", () => {
  it("builds a link on the EasyEyes media host", () => {
    expect(mediaUrlForPath("stiff-objects.png")).toBe(
      `${MEDIA_BASE_URL}/stiff-objects.png`,
    );
  });

  it("does not double the separator", () => {
    expect(mediaUrlForPath("/stiff-objects.png")).toBe(
      `${MEDIA_BASE_URL}/stiff-objects.png`,
    );
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [900, "900 B"],
    [2048, "2.0 KB"],
    [20480, "20 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
  ])("formats %p as %p", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it("returns nothing for a missing size", () => {
    expect(formatFileSize(undefined)).toBe("");
  });
});

describe("session library", () => {
  beforeEach(() => resetMediaLibrary());

  it("reports a name as taken so existing media is never replaced", () => {
    expect(isNameTaken("stiff-objects.png")).toBe(false);
    addMedia({ path: "stiff-objects.png" });
    expect(isNameTaken("stiff-objects.png")).toBe(true);
  });

  it("lists the most recently added file first", () => {
    addMedia({ path: "first.png" });
    addMedia({ path: "second.png" });
    expect(listMedia().map((record) => record.path)).toEqual([
      "second.png",
      "first.png",
    ]);
  });
});
