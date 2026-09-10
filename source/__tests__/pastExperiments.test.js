// The Studio's "Open past experiment…": the table a compile left in the root
// of the experiment repository, read back into the grid. GitLab is mocked at
// the helpers pastExperiments.ts uses.
jest.mock("../../threshold/preprocess/fetchAllPages", () => ({
  fetchAllPages: jest.fn(),
}));
jest.mock("../../threshold/preprocess/fileUtils", () => ({
  getTextFileDataFromGitLab: jest.fn(),
}));
jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectsByName: jest.fn(),
}));
jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getProjectsPage: jest.fn(),
}));
jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "id", redirectUri: "uri" }),
}));
jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn(() => null) },
}));

import { fetchAllPages } from "../../threshold/preprocess/fetchAllPages";
import { getTextFileDataFromGitLab } from "../../threshold/preprocess/fileUtils";
import { searchProjectsByName } from "../../threshold/preprocess/gitlabSearch";
import { getProjectsPage } from "../../threshold/preprocess/gitlabUtils";
import { GitLabOAuthClient } from "../../threshold/preprocess/auth/gitlabOAuthClient";
import { repoTableToMatrix } from "../studio/fileImport";
import {
  asExperiments,
  findTableFileName,
  isTableFileName,
  makePastExperimentsApi,
  openPastExperiment,
} from "../studio/pastExperiments";

const treeResponse = (entries) => [{ json: async () => entries }];
const client = { apiRequest: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("repoTableToMatrix", () => {
  it("parses a csv table as the Studio's own import does", () => {
    expect(
      repoTableToMatrix("exp.csv", "_about,hello\nconditionName,a,b\n\n"),
    ).toEqual([
      ["_about", "hello"],
      ["conditionName", "a", "b"],
    ]);
  });

  it("reads an xlsx upload back from the JSON rows the compile stored", () => {
    const stored = JSON.stringify([
      ["_about", "Reading study", null],
      ["conditionName", "a", "b"],
      ["thresholdBeta", 2.3, true],
      [],
      ["_participantIDPutBool", "TRUE"],
    ]);
    expect(repoTableToMatrix("exp.xlsx", stored)).toEqual([
      ["_about", "Reading study", ""],
      ["conditionName", "a", "b"],
      ["thresholdBeta", "2.3", "true"],
      ["_participantIDPutBool", "TRUE"],
    ]);
  });

  it("falls back to csv for an xlsx-named file that is not JSON", () => {
    expect(repoTableToMatrix("exp.xlsx", "_about,x\nconditionName,a")).toEqual([
      ["_about", "x"],
      ["conditionName", "a"],
    ]);
  });
});

describe("the table file in a repository", () => {
  it("is the first csv/xlsx in the root, never the recruitment config", () => {
    expect(isTableFileName("myExp.csv")).toBe(true);
    expect(isTableFileName("myExp.XLSX")).toBe(true);
    expect(isTableFileName("recruitmentServiceConfig.csv")).toBe(false);
    expect(isTableFileName("index.html")).toBe(false);
    expect(isTableFileName("README.md")).toBe(false);
  });

  it("is found among the root entries, skipping folders", async () => {
    fetchAllPages.mockResolvedValue(
      treeResponse([
        { name: "conditions", type: "tree" },
        { name: "index.html", type: "blob" },
        { name: "recruitmentServiceConfig.csv", type: "blob" },
        { name: "reading.csv", type: "blob" },
      ]),
    );
    await expect(findTableFileName(42, client)).resolves.toBe("reading.csv");
    expect(fetchAllPages).toHaveBeenCalledWith(
      "/projects/42/repository/tree/?path=%2E",
      client,
    );
  });

  it("is null when the repository keeps no table", async () => {
    fetchAllPages.mockResolvedValue(
      treeResponse([{ name: "index.html", type: "blob" }]),
    );
    await expect(findTableFileName(42, client)).resolves.toBeNull();
  });
});

describe("openPastExperiment", () => {
  it("returns the experiment's name and its table as a matrix", async () => {
    fetchAllPages.mockResolvedValue(
      treeResponse([{ name: "reading.csv", type: "blob" }]),
    );
    getTextFileDataFromGitLab.mockResolvedValue(
      "_about,study\nconditionName,a,b\n",
    );
    const table = await openPastExperiment(
      { id: 7, name: "reading_3", created_at: "2026-01-01T00:00:00Z" },
      client,
    );
    expect(table).toEqual({
      name: "reading_3",
      fileName: "reading.csv",
      matrix: [
        ["_about", "study"],
        ["conditionName", "a", "b"],
      ],
    });
    expect(getTextFileDataFromGitLab).toHaveBeenCalledWith(
      7,
      "reading.csv",
      client,
    );
  });

  it("explains when the repository has no table", async () => {
    fetchAllPages.mockResolvedValue(treeResponse([]));
    await expect(
      openPastExperiment(
        { id: 7, name: "old", created_at: "2026-01-01T00:00:00Z" },
        client,
      ),
    ).rejects.toThrow(/“old” has no experiment table/);
    expect(getTextFileDataFromGitLab).not.toHaveBeenCalled();
  });

  it("needs a signed-in client when none is given", async () => {
    GitLabOAuthClient.loadFromStorage.mockReturnValue(null);
    await expect(
      openPastExperiment({
        id: 7,
        name: "x",
        created_at: "2026-01-01T00:00:00Z",
      }),
    ).rejects.toThrow(/Not signed in/);
  });
});

describe("makePastExperimentsApi", () => {
  const projects = [
    { id: 1, name: "EasyEyesResources", created_at: "2025-01-01T00:00:00Z" },
    { id: 2, name: "reading", created_at: "2026-02-01T00:00:00Z" },
    { id: 3, name: "crowding", created_at: "2026-03-01T00:00:00Z" },
  ];
  const makeUser = () => ({
    projectList: Promise.resolve(projects),
    totalProjectPages: 3,
    initProjectList: jest.fn(async function () {
      this.projectList = Promise.resolve([
        ...projects,
        { id: 4, name: "fresh", created_at: "2026-04-01T00:00:00Z" },
      ]);
    }),
  });

  it("lists the compiler page's own project list without the resources repo", async () => {
    const user = makeUser();
    const api = makePastExperimentsApi(user);
    await expect(api.list()).resolves.toEqual({
      experiments: [projects[1], projects[2]],
      totalPages: 3,
    });
    expect(user.initProjectList).not.toHaveBeenCalled();
  });

  it("asks Pavlovia again on refresh", async () => {
    const user = makeUser();
    const api = makePastExperimentsApi(user);
    const { experiments } = await api.list(true);
    expect(user.initProjectList).toHaveBeenCalledWith(true);
    expect(experiments.map((e) => e.name)).toEqual([
      "reading",
      "crowding",
      "fresh",
    ]);
  });

  it("fetches further pages and searches through the same GitLab calls", async () => {
    const user = makeUser();
    const api = makePastExperimentsApi(user);
    getProjectsPage.mockResolvedValue([
      { id: 9, name: "page2", created_at: "2025-06-01T00:00:00Z" },
      null,
    ]);
    await expect(api.page(2)).resolves.toEqual([
      { id: 9, name: "page2", created_at: "2025-06-01T00:00:00Z" },
    ]);
    expect(getProjectsPage).toHaveBeenCalledWith(user, 2);

    searchProjectsByName.mockResolvedValue([projects[0], projects[1]]);
    await expect(api.search("read")).resolves.toEqual([projects[1]]);
    expect(searchProjectsByName).toHaveBeenCalledWith(user, "read");
  });

  it("filters out anything that is not a project", () => {
    expect(
      asExperiments([null, {}, { id: 5, name: "ok", created_at: "" }]),
    ).toEqual([{ id: 5, name: "ok", created_at: "" }]);
  });
});
