/**
 * Drives a threshold-engine release through the frozen engine.compile()
 * contract (ADR 0001) on behalf of the compile path (Table.js), translating
 * between the shell's resource shapes and the contract's.
 */
import type {
  CompileResult,
  EngineFile,
  ThresholdEngine,
} from "../../threshold/threshold-engine/contract/engine-compile";
import { resolveEngine } from "./resolveEngine";
import { getGlossaryData } from "../../threshold/parameters/glossaryRegistry";
import { getPhrasesData } from "../../threshold/parameters/phrasesRegistry";
import { fetchGlossaryData } from "../components/glossaryApi";
import { fetchPhrasesByVersion } from "../components/phrasesApi";
import { durations } from "../../threshold/preprocess/getDuration";
import { compatibilityRequirements } from "../../threshold/preprocess/global";

export interface CompileExperimentArgs {
  /** The dropped experiment table. */
  file: File;
  /** The shell's resolvedResources (per-kind name lists, phrase Files, textContents). */
  resources: Record<string, any>;
  /** A copy of the logged-in user; currentExperiment is populated from the manifest. */
  user: any;
  /** True when re-compiling from a downloaded experiment archive. */
  compiledFromArchive: boolean;
  /** The reopened experiment's pinned release id (issue #177); "latest" when none is known. */
  pinnedRelease?: string;
}

export interface CompileExperimentDeps {
  /** Bypasses resolveEngine entirely; pair with `runtimeBaseUrl` for a full bypass. */
  engine?: ThresholdEngine;
  /** The `engine`'s runtime URL, when `engine` is injected directly. */
  runtimeBaseUrl?: string;
  /** The `engine`'s release id, when `engine` is injected directly. */
  release?: string;
  /** Injectable resolver (issue #176), defaults to the real resolveEngine. */
  resolveEngine?: typeof resolveEngine;
  /** Release-pinned datasets; default to fetching by the resolved release's manifest-pinned versions. */
  glossaryData?: unknown;
  phrasesData?: unknown;
  /** Injectable versioned fetchers (issue #182), default to the real glossaryApi/phrasesApi fetchers. */
  fetchGlossaryData?: typeof fetchGlossaryData;
  fetchPhrasesByVersion?: typeof fetchPhrasesByVersion;
  /** Compiler deploy date stamped into CompatibilityRequirements.txt. */
  compilerUpdateDate?: string;
}

/**
 * The shell-fetched Netlify deploy date, matching the legacy copy flow's
 * getGitlabBodyForCompatibilityRequirementFile. Absent on failure.
 */
const fetchCompilerUpdateDate = async (): Promise<string | undefined> => {
  try {
    const response = await fetch(
      "https://api.netlify.com/api/v1/sites/7ef5bb5a-2b97-4af2-9868-d3e9c7ca2287/",
    );
    const data = await response.json();
    return data.published_deploy.published_at;
  } catch {
    return undefined;
  }
};

export interface RequestedResources {
  forms: string[];
  fonts: string[];
  texts: string[];
  folders: string[];
  images: string[];
  code: string[];
  impulseResponses: string[];
  frequencyResponses: string[];
  targetSoundLists: string[];
  phrases: string[];
}

export interface CompileExperimentOutcome {
  /** Compiled files to write verbatim into the experiment repo. */
  files: EngineFile[];
  /** Author-facing problems; kind "error" blocks publishing. */
  diagnostics: any[];
  /** Resources the experiment needs, grouped by kind, names only. */
  requested: RequestedResources;
  /** The release actually resolved for this compile (issue #177); never "latest" as-is. */
  release: string;
  /** The engine.compile() contract version this release speaks (issue #179). */
  contractVersion: number;
  /** Provenance of the engine that produced this compile (issue #181). */
  engine?: { name?: string; version?: string; commit?: string };
  /** The glossary dataset version pinned for this compile (issue #181). */
  glossaryVersion?: string | null;
  /** The phrases dataset version pinned for this compile (issue #181). */
  phrasesVersion?: string | null;
}

const groupRequests = (
  requests: { path: string }[] | undefined,
): RequestedResources => {
  const requested: RequestedResources = {
    forms: [],
    fonts: [],
    texts: [],
    folders: [],
    images: [],
    code: [],
    impulseResponses: [],
    frequencyResponses: [],
    targetSoundLists: [],
    phrases: [],
  };
  for (const { path } of requests ?? []) {
    const slash = path.indexOf("/");
    if (slash <= 0) continue;
    const kind = path.slice(0, slash) as keyof RequestedResources;
    if (kind in requested) requested[kind].push(path.slice(slash + 1));
  }
  return requested;
};

/**
 * manifest.experiment keys that carry status-line payloads rather than
 * experiment configuration; they feed the shell globals below instead of
 * user.currentExperiment.
 */
const STATUS_GLOBAL_KEYS = [
  "durations",
  "compatibilityRequirements",
  "compatibilityParsedInfo",
] as const;

const applyManifestExperiment = (
  user: any,
  experiment: Record<string, unknown> | undefined,
): void => {
  if (!experiment) return;
  const config = { ...experiment };
  for (const key of STATUS_GLOBAL_KEYS) delete config[key];
  user.currentExperiment = { ...user.currentExperiment, ...config };

  // The shell UI (StatusLines, ExperimentNeeds) reads these module globals;
  // a dynamically-imported engine has its own copies, so sync them here.
  if (experiment.durations)
    Object.assign(durations, experiment.durations as object);
  if (experiment.compatibilityRequirements !== undefined)
    compatibilityRequirements.t =
      experiment.compatibilityRequirements as string;
  if (experiment.compatibilityParsedInfo !== undefined)
    compatibilityRequirements.parsedInfo =
      experiment.compatibilityParsedInfo as object;
};

/**
 * Resource kinds whose files live in the scientist's resources repo: the
 * shell only knows their names at compile time, so they cross the contract
 * as empty-content EngineFiles (the engine uses them for existence checks).
 */
const NAME_ONLY_KINDS = [
  "fonts",
  "forms",
  "texts",
  "folders",
  "images",
  "code",
  "impulseResponses",
  "frequencyResponses",
  "targetSoundLists",
] as const;

const buildContractResources = async (
  shellResources: Record<string, any>,
): Promise<EngineFile[]> => {
  const files: EngineFile[] = [];
  for (const kind of NAME_ONLY_KINDS) {
    for (const name of shellResources[kind] ?? []) {
      const content =
        kind === "texts" ? shellResources.textContents?.[name] ?? "" : "";
      files.push({ path: `${kind}/${name}`, content });
    }
  }
  // Phrase files dropped this session are real File objects; the engine
  // parses their content.
  for (const phraseFile of shellResources.phrases ?? []) {
    files.push({
      path: `phrases/${phraseFile.name}`,
      content: await readFileBytes(phraseFile),
    });
  }
  return files;
};

const readFileBytes = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const compileExperimentWithEngine = async (
  args: CompileExperimentArgs,
  deps: CompileExperimentDeps = {},
): Promise<CompileExperimentOutcome> => {
  const { engine, runtimeBaseUrl, release, glossaryVersion, phrasesVersion } =
    deps.engine
      ? {
          engine: deps.engine,
          runtimeBaseUrl: deps.runtimeBaseUrl ?? "",
          release: deps.release ?? "latest",
          glossaryVersion: undefined,
          phrasesVersion: undefined,
        }
      : await (deps.resolveEngine ?? resolveEngine)(
          args.pinnedRelease ?? "latest",
          {},
        );

  // Release-pinned datasets (issue #182): fetched by the resolved release's
  // manifest versions when one was resolved, so an older release's compile
  // can't pick up whatever glossary/phrases happen to be cached in the
  // shell's registries from a prior compile this session. The direct-engine
  // bypass (tests only; Table.js always resolves a release) has no manifest
  // version to pin to, so it falls back to the registry's current data.
  const glossaryData =
    deps.glossaryData ??
    (glossaryVersion !== undefined
      ? await (deps.fetchGlossaryData ?? fetchGlossaryData)(glossaryVersion)
      : getGlossaryData());
  const phrasesData =
    deps.phrasesData ??
    (phrasesVersion !== undefined
      ? await (deps.fetchPhrasesByVersion ?? fetchPhrasesByVersion)(
          phrasesVersion,
        )
      : getPhrasesData());

  const table: EngineFile = {
    path: args.file.name,
    content: await readFileBytes(args.file),
  };

  const fetchPhraseFromRepo = args.resources.fetchPhraseFromRepo;
  const result: CompileResult = await engine.compile(
    table,
    {
      files: await buildContractResources(args.resources),
      fetch: async (path: string): Promise<EngineFile | null> => {
        if (!path.startsWith("phrases/") || !fetchPhraseFromRepo) return null;
        const file = await fetchPhraseFromRepo(path.slice("phrases/".length));
        return file ? { path, content: await readFileBytes(file) } : null;
      },
    },
    {
      mode: "web",
      compiledFromArchive: args.compiledFromArchive,
      data: {
        glossary: glossaryData,
        phrases: phrasesData,
        compilerUpdateDate:
          deps.compilerUpdateDate ?? (await fetchCompilerUpdateDate()),
        // Reference-by-URL flow (issue #174): the engine emits the entry
        // index.html + asset-bridge service worker pointing the participant
        // runtime at its own release's runtime URL.
        entryBaseUrl: runtimeBaseUrl,
      },
    },
  );

  applyManifestExperiment(args.user, result.manifest.experiment);

  return {
    files: result.files,
    diagnostics: result.manifest.diagnostics ?? [],
    requested: groupRequests(result.manifest.requests),
    release,
    contractVersion: result.manifest.contractVersion,
    engine: result.manifest.engine,
    glossaryVersion:
      (glossaryData as { version?: string } | null)?.version ?? null,
    phrasesVersion:
      (phrasesData as { version?: string } | null)?.version ?? null,
  };
};
