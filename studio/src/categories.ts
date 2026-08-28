/**
 * Parameter categorization. The glossary has no topic field, so categories
 * are derived from the (very regular) parameter naming conventions.
 * First matching rule wins.
 */
import { suggestibleEntries, getEntry } from "./glossary";
import type { GlossaryEntry } from "../../source/components/types";

const RULES: [RegExp, string][] = [
  [/^_?calibrate/i, "Calibration"],
  [/^_?need/i, "Requirements (needs)"],
  [/^_prolific/i, "Prolific recruitment"],
  [
    /^_pavlovia|^_save|^save|^_?log|^_participant|^_session/i,
    "Saving & logging",
  ],
  [/^_language|^_phrases|^international/i, "Language & phrases"],
  [/^_timeout/i, "Timeouts"],
  [
    /^_author|^_about$|^_date|^_?invite|^_text|^_consent|^_debrief|^notes$|^_work|^_can/i,
    "Study info & forms",
  ],
  [
    /^_debug|^simulat|^screenshot|^error|^_track|^_daisy/i,
    "Debugging & simulation",
  ],
  [/image/i, "Images"],
  [/sound|masker|vocoder/i, "Sound"],
  [/^movie/i, "Movies"],
  [/^reading/i, "Reading"],
  [/^rsvp/i, "RSVP reading"],
  [/^_?question/i, "Questions & surveys"],
  [/^font|^EasyEyesLettersVersion/, "Fonts"],
  [/^instruction/i, "Instructions"],
  [/^target/i, "Target & stimulus"],
  [/^threshold/i, "Threshold (QUEST)"],
  [/^spacing|^flanker/i, "Crowding & spacing"],
  [/^_?show/i, "Display & feedback"],
  [/^mark|^fixation/i, "Fixation & markers"],
  [/^response|^_keyboard|^take/i, "Response & breaks"],
  [/^_?block|^_?condition|^shuffle/i, "Blocks & conditions"],
  [/^_?viewing|^screen|^flip|^set|^measure/i, "Screen & viewing"],
];

export function categoryOf(name: string): string {
  for (const [re, cat] of RULES) if (re.test(name)) return cat;
  return name.startsWith("_") ? "Experiment-wide (other)" : "Other";
}

export interface Category {
  name: string;
  entries: GlossaryEntry[];
}

/** All categories with their (non-obsolete) parameters, biggest impact first. */
export const CATEGORIES: Category[] = (() => {
  const map = new Map<string, GlossaryEntry[]>();
  for (const e of suggestibleEntries) {
    const c = categoryOf(e.name);
    const list = map.get(c);
    if (list) list.push(e);
    else map.set(c, [e]);
  }
  return [...map.entries()]
    .map(([name, entries]) => ({ name, entries }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

/**
 * Which categories matter most for a given experiment, judged from the
 * table's targetKind / targetTask values. Used to build the
 * "Recommended for …" group in the catalog.
 */
const KIND_CATEGORIES: Record<string, string[]> = {
  letter: [
    "Crowding & spacing",
    "Target & stimulus",
    "Threshold (QUEST)",
    "Fonts",
  ],
  repeatedLetters: [
    "Crowding & spacing",
    "Target & stimulus",
    "Threshold (QUEST)",
    "Fonts",
  ],
  gabor: ["Target & stimulus", "Threshold (QUEST)"],
  vernier: ["Target & stimulus", "Threshold (QUEST)"],
  image: ["Images", "Target & stimulus"],
  movie: ["Movies", "Target & stimulus"],
  sound: ["Sound", "Threshold (QUEST)"],
  vocoderPhrase: ["Sound"],
  reading: ["Reading", "Fonts"],
  rsvpReading: ["RSVP reading", "Reading", "Fonts"],
};

const TASK_CATEGORIES: Record<string, string[]> = {
  questionAndAnswer: ["Questions & surveys"],
  questionAnswer: ["Questions & surveys"],
};

export interface Recommendation {
  label: string;
  entries: GlossaryEntry[];
}

export function recommendedFor(
  targetKinds: string[],
  targetTasks: string[],
): Recommendation | null {
  const kinds = [...new Set(targetKinds.filter((k) => k))];
  const catNames = new Set<string>();
  for (const k of kinds)
    for (const c of KIND_CATEGORIES[k] ?? []) catNames.add(c);
  for (const t of new Set(targetTasks))
    for (const c of TASK_CATEGORIES[t] ?? []) catNames.add(c);
  if (catNames.size === 0) return null;
  const entries = CATEGORIES.filter((c) => catNames.has(c.name)).flatMap(
    (c) => c.entries,
  );
  return {
    label: `Recommended for ${kinds.join(" + ") || "this experiment"}`,
    entries: entries.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    ),
  };
}

export function categoryOfEntry(name: string): string | null {
  return getEntry(name) ? categoryOf(name) : null;
}

function entriesForCategories(catNames: string[]): GlossaryEntry[] {
  const wanted = new Set(catNames);
  return CATEGORIES.filter((c) => wanted.has(c.name))
    .flatMap((c) => c.entries)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Always-available recommendation groups, pinned in the catalog. */
export const PRESET_RECOMMENDATIONS: Recommendation[] = [
  {
    label: "For reading",
    entries: entriesForCategories([
      ...KIND_CATEGORIES.reading,
      ...KIND_CATEGORIES.rsvpReading,
    ]),
  },
  {
    label: "For sound",
    entries: entriesForCategories([
      ...KIND_CATEGORIES.sound,
      ...KIND_CATEGORIES.vocoderPhrase,
    ]),
  },
].map((r) => ({
  ...r,
  entries: [...new Map(r.entries.map((e) => [e.name, e])).values()],
}));
