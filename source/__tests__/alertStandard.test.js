import fs from "fs";
import path from "path";

const source = (...parts) => path.join(__dirname, "..", ...parts);
const read = (...parts) => fs.readFileSync(source(...parts), "utf8");

const alertSurfaces = [
  "Table.js",
  "Running.js",
  "Media.js",
  "studio/assistant/AssistantPanel.tsx",
  "studio/components/AlertPanel.tsx",
  "studio/components/ResourcePanel.tsx",
];

describe("one AlertCard standard", () => {
  it.each(alertSurfaces)("%s delegates alert rendering", (file) => {
    const text = read(file);
    expect(text).toContain("AlertCard");
    expect(text).not.toContain("CompilerDiagnostic");
    expect(text).not.toContain("error-item error-");
    expect(text).not.toContain("asst-result-error-msg");
    expect(text).not.toContain("all-clear-mark");
  });

  it("leaves no duplicate alert card CSS in callers", () => {
    for (const file of [
      "css/Media.scss",
      "studio/styles.css",
      "studio/assistant/assistant.css",
    ]) {
      const text = read(file);
      expect(text).not.toContain(".error-item");
      expect(text).not.toContain(".asst-result-errors");
      expect(text).not.toContain(".all-clear");
      expect(text).not.toContain(".error-parameter");
      expect(text).not.toContain(".alert-parameter");
    }
  });

  it("keeps presentation symbols out of alert producers", () => {
    for (const file of [
      "../threshold/preprocess/alerts.ts",
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
