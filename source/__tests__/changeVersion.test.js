/**
 * The swap-vs-recompile decision (issue #179): a version change may only take
 * the cheap runtime-only-swap path when the target release speaks the exact
 * same engine.compile() contract (ADR 0001) as the experiment's current pin —
 * anything else forces a full re-compile, since a differing contract can mean
 * differing compiled-data shape and no pin-only change may alter frozen
 * condition files.
 */
import {
  decideVersionChangeMode,
  filesToCommitForMode,
  applyRuntimeSwap,
  changeExperimentVersion,
} from "../engine/changeVersion";

describe("decideVersionChangeMode", () => {
  it("chooses a runtime-only swap when the target release shares the current pin's contractVersion", () => {
    expect(decideVersionChangeMode(1, 1)).toBe("swap");
  });

  it("forces a full re-compile when the target release speaks a different contractVersion", () => {
    expect(decideVersionChangeMode(1, 2)).toBe("recompile");
  });

  it("forces a full re-compile when the current pin has no known contractVersion (legacy pin)", () => {
    expect(decideVersionChangeMode(null, 1)).toBe("recompile");
  });
});

describe("filesToCommitForMode", () => {
  const files = [
    { path: "exp.csv", content: "a,b" },
    { path: "conditions/block_1.csv", content: "block" },
    { path: "conditions/blockCount.csv", content: "count" },
    { path: "index.html", content: "<html></html>" },
    { path: "coi-serviceworker.js", content: "sw" },
  ];

  it("a swap commits only the entry files (index.html, coi-serviceworker.js), leaving conditions/ and the table untouched", () => {
    const result = filesToCommitForMode(files, "swap");

    expect(result.map((f) => f.path)).toEqual([
      "index.html",
      "coi-serviceworker.js",
    ]);
  });

  it("a recompile commits every file the target release's compile() produced", () => {
    const result = filesToCommitForMode(files, "recompile");

    expect(result).toBe(files);
  });
});

describe("applyRuntimeSwap", () => {
  it("commits only the given entry files (as updates, since they already exist) plus the release pin", async () => {
    const pushCommits = jest.fn().mockResolvedValue({});
    const user = { id: 7 };
    const repo = { id: "77" };

    await applyRuntimeSwap(
      {
        user,
        repo,
        entryFiles: [
          { path: "index.html", content: "<html></html>" },
          { path: "coi-serviceworker.js", content: "sw" },
        ],
        release: "2026.7.9",
        contractVersion: 1,
      },
      { pushCommits },
    );

    expect(pushCommits).toHaveBeenCalledTimes(1);
    const [calledUser, calledRepo, actions, , branch] =
      pushCommits.mock.calls[0];
    expect(calledUser).toBe(user);
    expect(calledRepo).toBe(repo);
    expect(branch).toBe("master");
    expect(actions).toEqual([
      {
        action: "update",
        file_path: "index.html",
        content: "<html></html>",
        encoding: "text",
      },
      {
        action: "update",
        file_path: "coi-serviceworker.js",
        content: "sw",
        encoding: "text",
      },
      {
        action: "update",
        file_path: "ReleasePin.txt",
        content: JSON.stringify({
          release: "2026.7.9",
          contractVersion: 1,
        }),
        encoding: "text",
      },
    ]);
  });
});

describe("changeExperimentVersion", () => {
  const outcomeFiles = [
    { path: "exp.csv", content: "a,b" },
    { path: "conditions/block_1.csv", content: "block" },
    { path: "index.html", content: "<html></html>" },
    { path: "coi-serviceworker.js", content: "sw" },
  ];

  const makeDeps = (contractVersion) => {
    const applyRuntimeSwap = jest.fn().mockResolvedValue(undefined);
    const compileExperimentWithEngine = jest.fn().mockResolvedValue({
      files: outcomeFiles,
      diagnostics: [],
      requested: {},
      release: "2026.7.9",
      contractVersion,
    });
    const fetchExperimentTable = jest
      .fn()
      .mockResolvedValue(new File(["a,b"], "exp.csv"));
    return {
      applyRuntimeSwap,
      compileExperimentWithEngine,
      fetchExperimentTable,
    };
  };

  it("applies a runtime swap with only the entry files, when the target release matches the current pin's contractVersion", async () => {
    const deps = makeDeps(1);
    const user = { id: 7 };
    const repo = { id: "77" };

    const result = await changeExperimentVersion(
      {
        user,
        repo,
        repoName: "myExp1",
        targetRelease: "2026.7.9",
        currentContractVersion: 1,
        resources: {},
      },
      deps,
    );

    expect(deps.fetchExperimentTable).toHaveBeenCalledWith(user, "myExp1");
    expect(deps.applyRuntimeSwap).toHaveBeenCalledTimes(1);
    expect(deps.applyRuntimeSwap.mock.calls[0][0]).toMatchObject({
      user,
      repo,
      entryFiles: [
        { path: "index.html", content: "<html></html>" },
        { path: "coi-serviceworker.js", content: "sw" },
      ],
      release: "2026.7.9",
      contractVersion: 1,
    });
    expect(result).toEqual({
      mode: "swap",
      release: "2026.7.9",
      contractVersion: 1,
    });
  });

  it("does not commit anything when the target release forces a full re-compile", async () => {
    const deps = makeDeps(2);

    const result = await changeExperimentVersion(
      {
        user: { id: 7 },
        repo: { id: "77" },
        repoName: "myExp1",
        targetRelease: "2026.7.9",
        currentContractVersion: 1,
        resources: {},
      },
      deps,
    );

    expect(deps.applyRuntimeSwap).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: "recompile",
      release: "2026.7.9",
      contractVersion: 2,
    });
  });
});
