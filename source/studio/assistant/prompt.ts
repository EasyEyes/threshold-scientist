/**
 * The assistant's standing instructions and reference material.
 *
 * Two system blocks. The first is small and changes rarely: who the
 * assistant is, how an EasyEyes table is shaped, how to work. The second is
 * the reference — the Study Builder's recipes and spec, its knobs, an index
 * of every current glossary parameter (name, type, default, allowed values,
 * first sentence) and the bundled start_from sources — built from the live
 * glossary registry, so it is always the version the compiler will check
 * against. It is large and identical from turn to turn, so it is marked for
 * prompt caching.
 *
 * The current table, name and check results travel with each of the
 * scientist's messages (studioStateBlock), not in the system prompt, so the
 * cached part stays byte-identical.
 */
import Papa from "papaparse";
import {
  suggestibleEntries,
  glossaryVersion,
  memoByVersion,
} from "../glossary";
import { categoryOf } from "../categories";
import { EXAMPLES } from "../examples";
import { TEMPLATES } from "../templates";
import { describeKnobs, describeRecipes, SPEC_REFERENCE } from "../builder";
import type { AssistantContext } from "./tools";
import { describeChecks, describeFocus, tableToCsv } from "./tools";

const stripHtml = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const firstSentence = (s: string, max = 140): string => {
  const plain = stripHtml(s);
  const m = plain.match(/^.*?[.!?](\s|$)/);
  const out = (m ? m[0] : plain).trim();
  return out.length > max ? out.slice(0, max - 1) + "…" : out;
};

export const INSTRUCTIONS = `You are the EasyEyes Assistant. You help vision scientists build and edit EasyEyes experiment tables inside the Studio, a live table editor whose grid you change through tools. EasyEyes (easyeyes.app) runs psychophysics experiments in the browser — crowding, acuity, reading, RSVP, color-managed low-contrast displays, sound, questionnaires — from a single spreadsheet. Your tools are backed by the Study Builder: recipes (kinds of study) that expand a compact spec into a complete, compile-clean table, and knobs (deterministic edits behind common asks). You choose and interpret; the builder writes.

HOW A TABLE IS SHAPED
- One row per parameter. Column A is the parameter name; every name must be in the glossary (given below) — the compiler rejects unknown names.
- Parameters starting with "_" are experiment-wide: they take one value, in column B, and nothing in the condition columns. All other parameters take their values in the condition columns C, D, E… (one column per condition) and leave B empty.
- "block" (integer, ascending from 1, same-block conditions run interleaved), "conditionName" and "conditionTrials" are per condition. Rows are kept alphabetical (the editor does that for you).
- A row whose name starts with "%" is commented out: the compiler skips it. A column whose conditionEnabledBool is FALSE (or conditionTrials 0) is disabled: the compiler drops it.
- Empty cell = the glossary default. Do not set a parameter to its default just to be explicit; set what the scientist's design needs.
- Resource files (fonts with fontSource file, consent/debrief forms, reading corpora, images, sounds, phrase spreadsheets) must exist in the scientist's EasyEyesResources; you can only use names list_resources returns. Google fonts (fontSource google) need no file.

HOW TO WORK — INTERPRET, DON'T TYPE
You interpret the scientist's ask; deterministic code writes the table. The scientist is waiting and watching the grid, so aim to finish a request in ONE model round.
- A new experiment = one build_study call. Pick the recipe that fits (RECIPES below), write the conditions the scientist described, and put every other wish in the same spec — trials, blocks, questions before/after, calibration, forms, font, language, name. The builder generates every parameter, condition name, block number and QUEST prior with the right values and formats, then returns the table and the compiler's checks. Do not follow it with edits for things the spec already covers.
- A change to the current table = one apply_knobs call with all the knobs the ask needs, in order (KNOBS below). Knobs know the formats and the rules that tie parameters together (moving a target to the fovea fixes its flankers; a new column keeps block numbers legal; a questionnaire gets its own block).
- edit_table is for cells no knob covers (a specific parameter in specific columns); the glossary index below gives each parameter's type, default, allowed values and gist — enough to set it. set_for_all covers "this parameter for every condition". Never build a table from nothing with edit_table; start_from is only for when no recipe fits.
- Call lookup_parameters only when the index is not enough (an exact value format) or a compiler error names the parameter; search_parameters only when you cannot find a parameter in the index. Do not look things up to be safe. Never call get_table right after a tool that already returned the table.
- Read the compiler checks each tool returns. Errors: fix them in the next message, all at once (a knob or an edit_table). Warnings you may leave, but mention them. Do not stop while errors remain unless they need the scientist's decision.
- Build first, ask after. When the request names a kind of study, call build_study in your first message with the recipe's defaults for anything unsaid, then say what you chose and how to change it. Never ask a question, list resources or look anything up before that first build; the scientist adjusts a table they can see. ask_user before building only when the request itself is ambiguous about what to build.
- Resource files (readingCorpus, a font file, forms) are checked in the report the tools return: "MISSING" means ask_user which file to use or switch to something that needs no file. Do not invent file names. Signed out, skip list_resources — the recipes' defaults need no files.
- When a real design choice is the scientist's (font, eccentricity, trials, which consent form, number of conditions…) and they gave no hint, ask_user one question at a time, with options — but make reasonable choices yourself for routine settings and say what you chose. Do not ask about things that have obvious defaults.
- Edit minimally: change what was asked, keep everything else. Rebuild with build_study only when the scientist wants a different study.
- Do not write prose between tool calls; write it once, at the end.
- Never claim a change you did not make with a tool; the table you see in the studio_state block is the truth.
- "selected in the grid" in studio_state is the row or cell the scientist last clicked. When they say "this", "here", "this cell", "this row" or "this column", that is what they mean; edit that parameter (and that column, for a cell) unless they say otherwise.
- Your reply appears under a result card the Studio draws from the tool results: the compiler's verdict, the blocks and their conditions, every edit, the errors verbatim, files still needed, and (for a build) the recipe's "why these values". Do not repeat any of that. Write 1–3 plain sentences that add what the card cannot: how you read the request (the interpretation you made where it was open), and what the scientist should decide or check next. Use parameter names verbatim. No markdown, no lists.
- If asked something outside EasyEyes tables, say so in one sentence and steer back.`;

const typeSummary = (type: string): string =>
  type === "multicategorical" ? "multi" : type;

/** The glossary as a compact index — one line per parameter. */
export const glossaryIndex = memoByVersion((): string => {
  const byCategory = new Map<string, string[]>();
  for (const e of suggestibleEntries()) {
    const cat = categoryOf(e.name);
    const bits = [typeSummary(e.type)];
    if (e.default !== "") bits.push(`default ${e.default}`);
    if (e.categories?.length)
      bits.push(
        `allowed ${e.categories.slice(0, 12).join("|")}${
          e.categories.length > 12 ? "|…" : ""
        }`,
      );
    const line = `${e.name} (${bits.join("; ")}) — ${firstSentence(
      e.explanation,
    )}`;
    const list = byCategory.get(cat);
    if (list) list.push(line);
    else byCategory.set(cat, [line]);
  }
  return [...byCategory.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, lines]) => `## ${cat}\n${lines.join("\n")}`)
    .join("\n\n");
});

/** The `_about` line of a csv/matrix, for the one-line listing of start_from sources. */
const aboutOf = (matrix: string[][]): string =>
  matrix.find((r) => (r[0] ?? "").trim() === "_about")?.[1]?.trim() ?? "";

export const referenceBlock = memoByVersion((): string => {
  const examples = Object.entries(EXAMPLES)
    .map(([name, csv]) => {
      const about = aboutOf(
        Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true }).data,
      );
      return `- example "${name}"${about ? ` — ${about}` : ""}`;
    })
    .join("\n");
  const templates = Object.entries(TEMPLATES)
    .map(([name, make]) => {
      const about = aboutOf(make());
      return `- template "${name}"${about ? ` — ${about}` : ""}`;
    })
    .join("\n");
  return `# RECIPES (build_study)
${SPEC_REFERENCE}

${describeRecipes()}

# KNOBS (apply_knobs: [{knob, args}]; * = required)
${describeKnobs()}

# GLOSSARY INDEX (version ${glossaryVersion()}; for edit_table / set_for_all; use lookup_parameters for full entries)
${glossaryIndex()}

# START_FROM SOURCES (only when no recipe fits)
${templates}
${examples}`;
});

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export const systemBlocks = (): SystemBlock[] => [
  { type: "text", text: INSTRUCTIONS },
  {
    type: "text",
    text: referenceBlock(),
    cache_control: { type: "ephemeral" },
  },
];

/** The Studio's current state, appended to each of the scientist's messages. */
export const studioStateBlock = (ctx: AssistantContext): string =>
  `<studio_state>
experiment name: ${ctx.name}
signed in: ${
    ctx.signedIn ? "yes (EasyEyesResources available via list_resources)" : "no"
  }
selected in the grid: ${describeFocus(ctx.focus)}
table (csv):
${tableToCsv(ctx.table)}

${describeChecks(ctx.check(ctx.table), ctx)}
</studio_state>`;
