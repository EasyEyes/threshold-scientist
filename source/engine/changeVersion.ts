/**
 * The change-version action (issue #179): decides whether moving an
 * already-compiled experiment to a different release can be a cheap
 * runtime-only swap, or must force a full re-compile.
 */
import {
  pushCommits,
  fetchExperimentTable,
} from "../../threshold/preprocess/gitlabUtils";
import type { Repository } from "../../threshold/preprocess/gitlabUtils";
import { compileExperimentWithEngine } from "./engineCompile";

export type VersionChangeMode = "swap" | "recompile";

export const decideVersionChangeMode = (
  currentContractVersion: number | null,
  targetContractVersion: number,
): VersionChangeMode => {
  return currentContractVersion === targetContractVersion
    ? "swap"
    : "recompile";
};

/**
 * Only index.html and coi-serviceworker.js are release-pure (a function of
 * entryBaseUrl alone, not the table/resources) — every other path a compile
 * can emit is data. A swap must structurally exclude everything else so no
 * pin-only change can ever alter frozen condition files.
 */
const ENTRY_FILE_ALLOWLIST = new Set(["index.html", "coi-serviceworker.js"]);

export const filesToCommitForMode = <T extends { path: string }>(
  files: T[],
  mode: VersionChangeMode,
): T[] =>
  mode === "swap"
    ? files.filter((file) => ENTRY_FILE_ALLOWLIST.has(file.path))
    : files;

export interface ApplyRuntimeSwapArgs {
  user: any;
  repo: Repository;
  /** Already filtered to the entry-file allowlist via filesToCommitForMode. */
  entryFiles: { path: string; content: string }[];
  release: string;
  contractVersion: number;
}

export interface ApplyRuntimeSwapDeps {
  pushCommits?: typeof pushCommits;
}

/**
 * Commits a runtime-only swap: the entry files are updated in place (they
 * already exist — a swap is only ever offered for an already-compiled
 * experiment) alongside the release pin. Nothing else in the repo is
 * touched, so conditions/block_*.csv stay frozen.
 */
export const applyRuntimeSwap = async (
  args: ApplyRuntimeSwapArgs,
  deps: ApplyRuntimeSwapDeps = {},
): Promise<void> => {
  const push = deps.pushCommits ?? pushCommits;

  const actions = [
    ...args.entryFiles.map((file) => ({
      action: "update" as const,
      file_path: file.path,
      content: file.content,
      encoding: "text" as const,
    })),
    {
      action: "update" as const,
      file_path: "ReleasePin.txt",
      content: JSON.stringify({
        release: args.release,
        contractVersion: args.contractVersion,
      }),
      encoding: "text" as const,
    },
  ];

  await push(
    args.user,
    args.repo,
    actions,
    `Change engine version to ${args.release} (runtime swap)`,
    "master",
  );
};

export interface ChangeExperimentVersionArgs {
  user: any;
  repo: Repository;
  repoName: string;
  targetRelease: string;
  /** From the experiment's own ReleasePin.txt; null for a legacy/unknown pin. */
  currentContractVersion: number | null;
  /** The shared EasyEyesResources name lists (App.js's already-fetched resources state). */
  resources: Record<string, any>;
}

export interface ChangeExperimentVersionDeps {
  compileExperimentWithEngine?: typeof compileExperimentWithEngine;
  applyRuntimeSwap?: typeof applyRuntimeSwap;
  /** Reconstructs the experiment's previously-uploaded table without asking the scientist to re-drop it. */
  fetchExperimentTable?: (user: any, repoName: string) => Promise<File>;
}

export interface ChangeExperimentVersionResult {
  mode: VersionChangeMode;
  release: string;
  contractVersion: number;
}

/**
 * Resolves the target release against the experiment's current pin and
 * either applies a runtime-only swap, or — when the contract differs —
 * leaves the repo untouched and reports "recompile" so the caller can defer
 * to the existing full compile-and-upload flow (which already requires the
 * scientist to re-provide the table).
 */
export const changeExperimentVersion = async (
  args: ChangeExperimentVersionArgs,
  deps: ChangeExperimentVersionDeps = {},
): Promise<ChangeExperimentVersionResult> => {
  const compile =
    deps.compileExperimentWithEngine ?? compileExperimentWithEngine;
  const applySwap = deps.applyRuntimeSwap ?? applyRuntimeSwap;
  const fetchTable = deps.fetchExperimentTable ?? fetchExperimentTable;

  const table = await fetchTable(args.user, args.repoName);

  const outcome = await compile({
    file: table,
    resources: args.resources,
    user: args.user,
    compiledFromArchive: false,
    pinnedRelease: args.targetRelease,
  });

  const mode = decideVersionChangeMode(
    args.currentContractVersion,
    outcome.contractVersion,
  );

  if (mode === "swap") {
    await applySwap({
      user: args.user,
      repo: args.repo,
      entryFiles: filesToCommitForMode(outcome.files, "swap"),
      release: outcome.release,
      contractVersion: outcome.contractVersion,
    });
  }

  return {
    mode,
    release: outcome.release,
    contractVersion: outcome.contractVersion,
  };
};
