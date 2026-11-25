// components/folderKinds.js: working out whether a folder (a zip in the
// scientist's Pavlovia account) holds images or sounds, so the Compiler can
// list it under Images or under Sound.
import {
  classifyFolders,
  folderBelongsIn,
  kindOfFileNames,
} from "../components/folderKinds";

jest.mock("jszip", () => ({ loadAsync: jest.fn() }));
jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn(() => null) },
}));

const memoryCache = (initial = {}) => {
  let kinds = { ...initial };
  return {
    read: () => kinds,
    write: (next) => {
      kinds = next;
    },
  };
};

describe("kindOfFileNames", () => {
  it.each([
    [["a.png", "b.jpg"], "images"],
    [["faces/anna.JPEG", "faces/ben.svg"], "images"],
    [["Ready.hi.wav", "words/One.lo.wav"], "sound"],
    [["a.png", "b.wav"], "both"],
    [["readme.txt"], "both"],
    [[], "both"],
  ])("%j is %s", (names, kind) => {
    expect(kindOfFileNames(names)).toBe(kind);
  });

  it("ignores folders and the files an operating system adds", () => {
    expect(
      kindOfFileNames([
        "faces/",
        "faces/anna.png",
        "__MACOSX/faces/._anna.png",
        "faces/.DS_Store",
        "__MACOSX/noise.wav",
      ]),
    ).toBe("images");
  });
});

describe("folderBelongsIn", () => {
  it("puts a folder in its own category only", () => {
    expect(folderBelongsIn("images", "images")).toBe(true);
    expect(folderBelongsIn("images", "sound")).toBe(false);
    expect(folderBelongsIn("sound", "sound")).toBe(true);
    expect(folderBelongsIn("sound", "images")).toBe(false);
  });

  it("puts a mixed or not-yet-read folder in both, so none is hidden", () => {
    for (const category of ["images", "sound"]) {
      expect(folderBelongsIn("both", category)).toBe(true);
      expect(folderBelongsIn(undefined, category)).toBe(true);
    }
  });
});

describe("classifyFolders", () => {
  const ids = { "faces.zip": "id-faces", "speech.zip": "id-speech" };
  const contents = {
    "faces.zip": ["anna.png"],
    "speech.zip": ["Ready.hi.wav"],
  };

  it("reads each folder and reports its kind", async () => {
    const onKind = jest.fn();
    const readFileNames = jest.fn(async (name) => contents[name]);
    await classifyFolders({
      names: ["faces.zip", "speech.zip"],
      listIds: async () => ids,
      readFileNames,
      cache: memoryCache(),
      onKind,
    });
    expect(onKind.mock.calls).toEqual([
      ["faces.zip", "images"],
      ["speech.zip", "sound"],
    ]);
  });

  it("does not download a folder it has read before", async () => {
    const cache = memoryCache();
    const readFileNames = jest.fn(async (name) => contents[name]);
    const run = (onKind) =>
      classifyFolders({
        names: ["faces.zip", "speech.zip"],
        listIds: async () => ids,
        readFileNames,
        cache,
        onKind,
      });
    await run(jest.fn());
    expect(readFileNames).toHaveBeenCalledTimes(2);

    const onKind = jest.fn();
    await run(onKind);
    expect(readFileNames).toHaveBeenCalledTimes(2);
    expect(onKind).toHaveBeenCalledWith("faces.zip", "images");
    expect(onKind).toHaveBeenCalledWith("speech.zip", "sound");
  });

  it("reads a folder again when it has been replaced (its id changed)", async () => {
    const cache = memoryCache({ "id-faces": "images" });
    const readFileNames = jest.fn(async () => ["Ready.hi.wav"]);
    const onKind = jest.fn();
    await classifyFolders({
      names: ["faces.zip"],
      listIds: async () => ({ "faces.zip": "id-faces-new" }),
      readFileNames,
      cache,
      onKind,
    });
    expect(readFileNames).toHaveBeenCalledWith("faces.zip");
    expect(onKind).toHaveBeenCalledWith("faces.zip", "sound");
  });

  it("leaves a folder that cannot be read unreported, and carries on", async () => {
    const onKind = jest.fn();
    await classifyFolders({
      names: ["faces.zip", "speech.zip"],
      listIds: async () => ids,
      readFileNames: async (name) => {
        if (name === "faces.zip") throw new Error("404");
        return contents[name];
      },
      cache: memoryCache(),
      onKind,
    });
    expect(onKind.mock.calls).toEqual([["speech.zip", "sound"]]);
  });

  it("stops when cancelled", async () => {
    const onKind = jest.fn();
    let cancelled = false;
    await classifyFolders({
      names: ["faces.zip", "speech.zip"],
      listIds: async () => ids,
      readFileNames: async (name) => {
        cancelled = true; // e.g. the scientist signed out meanwhile
        return contents[name];
      },
      cache: memoryCache(),
      onKind,
      isCancelled: () => cancelled,
    });
    expect(onKind).not.toHaveBeenCalled();
  });

  it("asks Pavlovia nothing when there are no folders", async () => {
    const listIds = jest.fn();
    await classifyFolders({
      names: [],
      listIds,
      readFileNames: jest.fn(),
      cache: memoryCache(),
      onKind: jest.fn(),
    });
    expect(listIds).not.toHaveBeenCalled();
  });
});
