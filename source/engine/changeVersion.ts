/**
 * The change-version action (issue #179): decides whether moving an
 * already-compiled experiment to a different release can be a cheap
 * runtime-only swap, or must force a full re-compile.
 */

export type VersionChangeMode = "swap" | "recompile";

export const decideVersionChangeMode = (
  currentContractVersion: number | null,
  targetContractVersion: number,
): VersionChangeMode => {
  return currentContractVersion === targetContractVersion
    ? "swap"
    : "recompile";
};
