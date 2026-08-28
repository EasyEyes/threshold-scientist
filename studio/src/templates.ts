/**
 * Starter templates: known-good tables prefilled per experiment type.
 * Built by patching the real example tables so they stay compile-clean.
 */
import { parseCsvString } from "./fileImport";
import minimal from "../../threshold/examples/tables/minimalExperiment.csv?raw";
import reading from "../../threshold/examples/tables/readingExperiment.csv?raw";

type Matrix = string[][];

/** Patch per-parameter values (underscore params in col B, others in C); null deletes the row. */
function patch(matrix: Matrix, edits: Record<string, string | null>): Matrix {
  return matrix.flatMap((row) => {
    const name = (row[0] ?? "").trim();
    if (name in edits) {
      const v = edits[name];
      if (v === null) return [];
      const r = [...row];
      while (r.length < 3) r.push("");
      if (name.startsWith("_")) r[1] = v;
      else r[2] = v;
      return [r];
    }
    return [row];
  });
}

export const TEMPLATES: Record<string, () => Matrix> = {
  "Blank (one block)": () => [
    ["_about", "new experiment"],
    ["block", "", "1"],
    ["conditionName", "", "condition1"],
    // Default spacingDirection (radial) is undefined at the default foveal
    // eccentricity, so a fovea-compatible direction keeps the blank clean.
    ["spacingDirection", "", "horizontal"],
    ["targetKind", "", "letter"],
    ["targetTask", "", "identify"],
    ["thresholdParameter", "", "spacingDeg"],
  ],
  "Letter crowding": () => parseCsvString(minimal),
  "Letter acuity": () =>
    patch(parseCsvString(minimal), {
      _about: "acuity, one block",
      conditionName: "acuity",
      thresholdParameter: "targetSizeDeg",
      spacingRelationToSize: "none",
      spacingOverSizeRatio: null,
      spacingDirection: null,
    }),
  Reading: () => parseCsvString(reading),
};
