/**
 * The shell's compile path drives a dynamically-loaded engine exclusively
 * through the frozen engine.compile() contract (ADR 0001, issue #174).
 * These tests exercise compileExperimentWithEngine through its public
 * interface with a fake engine standing in at the frozen contract boundary.
 */
import { compileExperimentWithEngine } from "../engine/engineCompile";

/** A fake engine that records its compile() arguments. */
const makeFakeEngine = (
  result = { files: [], manifest: { contractVersion: 1 } },
) => {
  const calls = [];
  return {
    calls,
    engine: {
      contractVersion: 1,
      compile: async (table, resources, options) => {
        calls.push({ table, resources, options });
        return typeof result === "function"
          ? result(table, resources, options)
          : result;
      },
    },
  };
};

const compileArgs = (overrides = {}) => ({
  file: new File(["a,b\n1,2"], "myExperiment.csv", { type: "text/csv" }),
  resources: {
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
    textContents: {},
  },
  user: { id: 7, currentExperiment: {} },
  compiledFromArchive: false,
  ...overrides,
});

describe("compileExperimentWithEngine", () => {
  it("sends the dropped table to the engine as opaque bytes under its filename", async () => {
    const { engine, calls } = makeFakeEngine();
    const args = compileArgs();

    await compileExperimentWithEngine(args, { engine });

    expect(calls).toHaveLength(1);
    const { table } = calls[0];
    expect(table.path).toBe("myExperiment.csv");
    expect(Buffer.from(table.content).toString("utf8")).toBe("a,b\n1,2");
  });

  it("passes resources as kind-prefixed paths: names for repo-hosted kinds, bytes for dropped phrase files, contents for fetched texts", async () => {
    const { engine, calls } = makeFakeEngine();
    const args = compileArgs();
    args.resources.fonts = ["Sloan.woff2"];
    args.resources.forms = ["consent.pdf"];
    args.resources.texts = ["corpus.txt"];
    args.resources.textContents = { "corpus.txt": "the quick brown fox" };
    args.resources.phrases = [new File(["phrase-bytes"], "myPhrases.xlsx")];

    await compileExperimentWithEngine(args, { engine });

    const { resources } = calls[0];
    const byPath = Object.fromEntries(
      resources.files.map((f) => [f.path, f.content]),
    );
    expect(byPath["fonts/Sloan.woff2"]).toBe("");
    expect(byPath["forms/consent.pdf"]).toBe("");
    expect(byPath["texts/corpus.txt"]).toBe("the quick brown fox");
    expect(Buffer.from(byPath["phrases/myPhrases.xlsx"]).toString("utf8")).toBe(
      "phrase-bytes",
    );
  });

  it("lets the engine lazily fetch a previously-uploaded phrase file from the scientist's repo", async () => {
    let fetched;
    const { engine } = makeFakeEngine(async (table, resources) => {
      fetched = await resources.fetch("phrases/old.xlsx");
      return { files: [], manifest: { contractVersion: 1 } };
    });
    const args = compileArgs();
    args.resources.fetchPhraseFromRepo = async (name) =>
      name === "old.xlsx" ? new File(["repo-phrase-bytes"], "old.xlsx") : null;

    await compileExperimentWithEngine(args, { engine });

    expect(fetched.path).toBe("phrases/old.xlsx");
    expect(Buffer.from(fetched.content).toString("utf8")).toBe(
      "repo-phrase-bytes",
    );
  });

  it("compiles for the web with the archive flag and release-pinned glossary/phrases data", async () => {
    const { engine, calls } = makeFakeEngine();
    const glossary = { glossary: { _language: { default: "English" } } };
    const phrases = { phrases: { EE_ok: { en: "OK" } } };

    await compileExperimentWithEngine(
      compileArgs({ compiledFromArchive: true }),
      {
        engine,
        glossaryData: glossary,
        phrasesData: phrases,
        compilerUpdateDate: "2026-07-07T00:00:00.000Z",
      },
    );

    const { options } = calls[0];
    expect(options.mode).toBe("web");
    expect(options.compiledFromArchive).toBe(true);
    expect(options.data.glossary).toBe(glossary);
    expect(options.data.phrases).toBe(phrases);
    expect(options.data.compilerUpdateDate).toBe("2026-07-07T00:00:00.000Z");
  });

  it("asks the engine to emit entry files referencing the release's runtime URL", async () => {
    const { engine, calls } = makeFakeEngine();
    const { ENGINE_RUNTIME_BASE_URL } = require("../engine/loadEngine");

    await compileExperimentWithEngine(compileArgs(), {
      engine,
      glossaryData: {},
      phrasesData: {},
      compilerUpdateDate: "2026-07-07T00:00:00.000Z",
    });

    expect(calls[0].options.data.entryBaseUrl).toBe(ENGINE_RUNTIME_BASE_URL);
  });

  it("groups the manifest's resource requests into per-kind name lists", async () => {
    const { engine } = makeFakeEngine({
      files: [],
      manifest: {
        contractVersion: 1,
        requests: [
          { path: "forms/consent.pdf" },
          { path: "forms/debrief.pdf" },
          { path: "fonts/Sloan.woff2" },
          { path: "texts/corpus.txt" },
          { path: "folders/sounds.zip" },
          { path: "images/cat.png" },
          { path: "code/custom.js" },
          { path: "impulseResponses/ir.gainVTime" },
          { path: "frequencyResponses/fr.gainVFreq" },
          { path: "targetSoundLists/list.xlsx" },
          { path: "phrases/myPhrases.xlsx" },
        ],
      },
    });

    const outcome = await compileExperimentWithEngine(compileArgs(), {
      engine,
    });

    expect(outcome.requested.forms).toEqual(["consent.pdf", "debrief.pdf"]);
    expect(outcome.requested.fonts).toEqual(["Sloan.woff2"]);
    expect(outcome.requested.texts).toEqual(["corpus.txt"]);
    expect(outcome.requested.folders).toEqual(["sounds.zip"]);
    expect(outcome.requested.images).toEqual(["cat.png"]);
    expect(outcome.requested.code).toEqual(["custom.js"]);
    expect(outcome.requested.impulseResponses).toEqual(["ir.gainVTime"]);
    expect(outcome.requested.frequencyResponses).toEqual(["fr.gainVFreq"]);
    expect(outcome.requested.targetSoundLists).toEqual(["list.xlsx"]);
    expect(outcome.requested.phrases).toEqual(["myPhrases.xlsx"]);
  });

  it("populates the user's experiment config and the shell's status globals from the manifest", async () => {
    const { engine } = makeFakeEngine({
      files: [],
      manifest: {
        contractVersion: 1,
        experiment: {
          _language: "German",
          participantRecruitmentServiceName: "Prolific",
          durations: { currentDuration: 42, durationForStatusline: "42 min" },
          compatibilityRequirements: "Chrome required.",
          compatibilityParsedInfo: { browser: "Chrome" },
        },
      },
    });
    const args = compileArgs();

    await compileExperimentWithEngine(args, { engine });

    // Experiment config lands on the user copy (what production's mutable
    // `user` gave the callback) …
    expect(args.user.currentExperiment._language).toBe("German");
    expect(args.user.currentExperiment.participantRecruitmentServiceName).toBe(
      "Prolific",
    );
    // … but the status-global payloads are not experiment fields.
    expect(args.user.currentExperiment.durations).toBeUndefined();
    expect(
      args.user.currentExperiment.compatibilityRequirements,
    ).toBeUndefined();

    // The shell UI (StatusLines, ExperimentNeeds) reads these module globals.
    const { durations } = require("../../threshold/preprocess/getDuration");
    const {
      compatibilityRequirements,
    } = require("../../threshold/preprocess/global");
    expect(durations.currentDuration).toBe(42);
    expect(durations.durationForStatusline).toBe("42 min");
    expect(compatibilityRequirements.t).toBe("Chrome required.");
    expect(compatibilityRequirements.parsedInfo).toEqual({
      browser: "Chrome",
    });
  });
});
