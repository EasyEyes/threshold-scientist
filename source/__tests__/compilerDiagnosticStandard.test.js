import fs from "fs";
import path from "path";

const source = (...parts) => path.join(__dirname, "..", ...parts);
const read = (...parts) => fs.readFileSync(source(...parts), "utf8");

const diagnosticSurfaces = [
  "Table.js",
  "Running.js",
  "studio/components/ErrorPanel.tsx",
  "studio/components/ResourcePanel.tsx",
];

describe("one compiler-diagnostic standard", () => {
  it.each(diagnosticSurfaces)("%s delegates diagnostic rendering", (file) => {
    const text = read(file);
    expect(text).toContain("CompilerDiagnostic");
    expect(text).not.toContain("compile-warning-item");
    expect(text).not.toContain("error-card");
    expect(text).not.toContain("error-item error-");
  });

  it("leaves no legacy warning palette or card CSS in its callers", () => {
    for (const file of ["css/Table.scss", "css/Running.scss"])
      expect(read(file)).not.toContain("#f78812");
    for (const file of [
      "css/Table.scss",
      "css/Running.scss",
      "studio/styles.css",
    ]) {
      const text = read(file);
      expect(text).not.toContain(".compile-warning-item");
      expect(text).not.toContain(".error-card.warning");
      expect(text).not.toContain(".error-warning");
    }
  });

  it("keeps presentation symbols out of diagnostic producers", () => {
    for (const file of [
      "../threshold/preprocess/errorMessages.ts",
      "../threshold/preprocess/validateExperimentTable.ts",
      "../threshold/preprocess/studyPhraseAnalysis.ts",
    ]) {
      const text = read(file);
      for (const line of text.split("\n")) {
        if (/^\s*name:/.test(line)) expect(line).not.toContain("⚠️");
      }
    }
  });
});
