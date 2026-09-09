/**
 * Real example tables from threshold/examples/tables, bundled as text.
 */
import minimal from "../../threshold/examples/tables/minimalExperiment.csv";
import demoExperiment from "../../threshold/examples/tables/demoExperiment.csv";
import reading from "../../threshold/examples/tables/readingExperiment.csv";
import question from "../../threshold/examples/tables/questionExperiment.csv";

export const EXAMPLES: Record<string, string> = {
  "Minimal experiment": minimal,
  "Demo experiment": demoExperiment,
  "Reading experiment": reading,
  "Question experiment": question,
};
