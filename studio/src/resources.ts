/**
 * Computes which resource files the experiment table references, so the
 * scientist never has to assemble a zip by memory. Uses the compiler's own
 * ExperimentTable (effective values include glossary defaults).
 */
import type { ExperimentTable } from "../../threshold/preprocess/experimentTable";

export type ResourceKind = "font" | "form" | "sound folder" | "phrases";

export interface NeededResource {
  kind: ResourceKind;
  filename: string;
  params: string[];
}

const FONT_PAIRS: [string, string][] = [
  ["font", "fontSource"],
  ["instructionFont", "instructionFontSource"],
];

const FORM_PARAMS = ["_consentForm", "_debriefForm"];

const SOUND_FOLDER_PARAMS = ["targetSoundFolder", "maskerSoundFolder"];

export function computeNeededResources(
  t: ExperimentTable | null,
): NeededResource[] {
  if (!t) return [];
  const out = new Map<string, NeededResource>();
  const add = (kind: ResourceKind, filename: string, paramName: string) => {
    const key = `${kind}:${filename}`;
    const existing = out.get(key);
    if (existing) {
      if (!existing.params.includes(paramName)) existing.params.push(paramName);
    } else out.set(key, { kind, filename, params: [paramName] });
  };

  for (const [fontParam, sourceParam] of FONT_PAIRS) {
    if (!t.params.includes(fontParam)) continue;
    const fonts = t.effectiveValues(fontParam);
    const sources = t.effectiveValues(sourceParam);
    fonts.forEach((f, i) => {
      if (f && (sources[i] || "").trim().toLowerCase() === "file")
        add("font", f, fontParam);
    });
  }

  for (const p of FORM_PARAMS) {
    if (!t.params.includes(p)) continue;
    const v = t.colBOrDefault(p);
    if (v) add("form", v, p);
  }

  if (t.params.includes("_languagePhrasesSpreadsheet")) {
    const v = (t.colBOrDefault("_languagePhrasesSpreadsheet") ?? "").trim();
    if (v) add("phrases", v, "_languagePhrasesSpreadsheet");
  }

  for (const p of SOUND_FOLDER_PARAMS) {
    if (!t.params.includes(p)) continue;
    for (const v of t.effectiveValues(p)) {
      if (v) add("sound folder", v.endsWith(".zip") ? v : `${v}.zip`, p);
    }
  }

  return [...out.values()].sort((a, b) =>
    a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()),
  );
}
