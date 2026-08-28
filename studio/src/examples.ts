/**
 * Real example tables from threshold/examples/tables, bundled as text.
 */
import minimal from "../../threshold/examples/tables/minimalExperiment.csv?raw";
import demoExperiment from "../../threshold/examples/tables/demoExperiment.csv?raw";
import reading from "../../threshold/examples/tables/readingExperiment.csv?raw";
import question from "../../threshold/examples/tables/questionExperiment.csv?raw";

export const EXAMPLES: Record<string, string> = {
  "Minimal experiment": minimal,
  "Demo experiment": demoExperiment,
  "Reading experiment": reading,
  "Question experiment": question,
};
