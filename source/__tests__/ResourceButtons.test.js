// ResourceButtons: the row of resource buttons on the Compiler's first
// screen. A folder of images is counted under Images, a folder of sounds
// under Sound, and a folder not yet read under both.
import React from "react";
import { act, render } from "@testing-library/react";
import ResourceButtons from "../ResourceButtons";
import { loadFolderKinds } from "../components/folderKinds";

jest.mock("sweetalert2", () => ({ fire: jest.fn() }));
jest.mock("../components/folderKinds", () => ({
  ...jest.requireActual("../components/folderKinds"),
  loadFolderKinds: jest.fn(),
}));
jest.mock("jszip", () => ({ loadAsync: jest.fn() }));
jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn(() => null) },
}));

const ready = (names) => ({ kind: "ready", names });
const catalog = (overrides = {}) => ({
  kind: "settled",
  listings: {
    fonts: ready([]),
    forms: ready([]),
    texts: ready([]),
    folders: ready(["faces.zip", "speech.zip"]),
    images: ready(["logo.png"]),
    code: ready([]),
    impulseResponses: ready(["room.gainVTime.csv"]),
    frequencyResponses: ready([]),
    targetSoundLists: ready([]),
    phrases: ready([]),
    ...overrides,
  },
});
const labels = (container) =>
  Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

// loadFolderKinds, under the test's control: `finish()` is the moment every
// folder has been looked at.
const startSorting = () => {
  let finish;
  loadFolderKinds.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  return {
    report: (name, kind) => loadFolderKinds.mock.calls.at(-1)[2](name, kind),
    finish: () => finish(),
  };
};
const spinners = (container) =>
  Array.from(container.querySelectorAll("button"))
    .filter((button) => button.querySelector(".resource-count-spinner"))
    .map((button) => button.textContent.trim());

describe("ResourceButtons", () => {
  beforeEach(() => jest.clearAllMocks());

  it("has no button for folders", () => {
    startSorting();
    const { container } = render(
      <ResourceButtons resourceCatalog={catalog()} user={{ id: 1 }} />,
    );
    expect(labels(container).join(" ")).not.toMatch(/folder/i);
    expect(labels(container)).toHaveLength(7);
  });

  it("shows no number on Images or Sound until the folders are sorted", async () => {
    const sorting = startSorting();
    const { container } = render(
      <ResourceButtons resourceCatalog={catalog()} user={{ id: 1 }} />,
    );
    expect(loadFolderKinds.mock.calls.at(-1)[1]).toEqual([
      "faces.zip",
      "speech.zip",
    ]);
    // Only those two wait; the others already show their numbers.
    expect(spinners(container)).toEqual(["images", "sound files"]);
    expect(labels(container)).toContain("0 font");

    // A folder being sorted does not make a number appear early.
    act(() => sorting.report("faces.zip", "images"));
    expect(spinners(container)).toEqual(["images", "sound files"]);

    act(() => sorting.report("speech.zip", "sound"));
    await act(async () => sorting.finish());
    expect(spinners(container)).toEqual([]);
    // 1 image + faces.zip; speech.zip + 1 impulse response.
    expect(labels(container)).toContain("2 images");
    expect(labels(container)).toContain("2 sound files");
  });

  it("keeps a folder that holds both kinds, or could not be read, under both", async () => {
    const sorting = startSorting();
    const { container } = render(
      <ResourceButtons resourceCatalog={catalog()} user={{ id: 1 }} />,
    );
    act(() => sorting.report("speech.zip", "sound"));
    // faces.zip is never reported: it could not be read.
    await act(async () => sorting.finish());
    expect(labels(container)).toContain("2 images");
    expect(labels(container)).toContain("3 sound files");
  });

  it("waits for nothing when there are no folders", () => {
    startSorting();
    const { container } = render(
      <ResourceButtons
        resourceCatalog={catalog({ folders: ready([]) })}
        user={{ id: 1 }}
      />,
    );
    expect(spinners(container)).toEqual([]);
    expect(labels(container)).toContain("1 image");
    expect(labels(container)).toContain("1 sound file");
  });

  it("does not read the folders again when nothing has changed", () => {
    startSorting();
    const props = { resourceCatalog: catalog(), user: { id: 1 } };
    const { rerender } = render(<ResourceButtons {...props} />);
    const calls = loadFolderKinds.mock.calls.length;
    rerender(<ResourceButtons {...props} user={{ id: 1 }} />);
    expect(loadFolderKinds).toHaveBeenCalledTimes(calls);
  });

  it("shows a spinner, not a stale number, the moment the folders change", async () => {
    const first = startSorting();
    const { container, rerender } = render(
      <ResourceButtons resourceCatalog={catalog()} user={{ id: 1 }} />,
    );
    act(() => first.report("faces.zip", "images"));
    act(() => first.report("speech.zip", "sound"));
    await act(async () => first.finish());
    expect(labels(container)).toContain("2 images");

    startSorting();
    rerender(
      <ResourceButtons
        resourceCatalog={catalog({
          folders: ready(["faces.zip", "speech.zip", "more.zip"]),
        })}
        user={{ id: 1 }}
      />,
    );
    expect(spinners(container)).toEqual(["images", "sound files"]);
  });

  it("shows the loading state while the list of resources is loading", () => {
    startSorting();
    const { container } = render(
      <ResourceButtons
        resourceCatalog={{ kind: "loading" }}
        user={{ id: 1 }}
      />,
    );
    // A small spinner stands in for each number; the names already show.
    expect(container.querySelectorAll(".resource-count-spinner")).toHaveLength(
      7,
    );
    expect(container.querySelectorAll(".icon-spin")).toHaveLength(0);
    expect(labels(container).map((label) => label.trim())).toContain("fonts");
    expect(labels(container).map((label) => label.trim())).toContain(
      "sound files",
    );
  });
});
