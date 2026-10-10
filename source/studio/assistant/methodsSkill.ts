/**
 * Methods draft: a first draft of a journal-style Methods section from the
 * table. It describes what the experiment file will run; whether that is
 * the study the authors intend is theirs to check, and the page, the card
 * and the model's reply all say so.
 *
 * The model already sees the table as csv, but a csv shows only what the
 * scientist typed; a Methods section needs what the study will run with —
 * mostly glossary defaults (viewing distance, QUEST's beta and criterion,
 * presentation time, background gray) — and the compiler's own session
 * estimate. The study_facts tool resolves every relevant parameter to its
 * effective value (cell, column B, or default, each marked) and groups the
 * conditions by block; the model writes the prose from that and nothing else.
 */
import type { TableState } from "../tableModel";
import {
  columnLetter,
  DURATION_RULE,
  effective,
  effectiveWide,
  enabledConditions,
  estimateDurationSec,
  type Effective,
} from "./effective";
import type { SystemBlock } from "./prompt";
import type { Skill } from "./skills";
import type { AssistantContext, ToolOutcome } from "./tools";

export const METHODS_TRIGGER = "/methods";

/* ------------------------------------------------------------------ */
/* Which parameters a Methods section reports                           */
/* ------------------------------------------------------------------ */

const EXPERIMENT_WIDE: readonly string[] = [
  "_about",
  "_authors",
  "_authorAffiliations",
  "_authorEmails",
  "_consentForm",
  "_debriefForm",
  "_language",
  "_participantIDGetBool",
  "_online1RecruitmentService",
  "_online2Participants",
  "_online2Minutes",
  "_online2PayPerHour",
  "_calibrateDistance",
  "calibrateDistanceBool",
  "calibrateScreenSizeBool",
  "calibrateScreenSizeCheckBool",
  "calibrateBlindSpotBool",
  "_calibrateSoundAllHzBool",
  "_calibrateSound1000HzBool",
];

/** Reported for every condition. */
const COMMON: readonly string[] = [
  "conditionName",
  "targetKind",
  "targetTask",
  "conditionTrials",
  "viewingDistanceDesiredCm",
  "viewingDistanceAllowedRatio",
  "font",
  "fontSource",
  "screenColorRGBA",
  "targetContrast",
  "responseClickedBool",
  "responseTypedBool",
  "responseSpokenBool",
  "showCounterBool",
  "needScreenWidthDeg",
  "needScreenHeightDeg",
  "fixationLocationStrategy",
  "markingFixationStrokeLengthDeg",
  "takeABreakTrialCredit",
];

/**
 * targetKind letter (and anything with a threshold). flankerCharacterSet is
 * left out: the letter runtime does not read it, flankers come from
 * fontCharacterSet.
 */
const LETTER: readonly string[] = [
  "fontCharacterSet",
  "targetEccentricityXDeg",
  "targetEccentricityYDeg",
  "targetDurationSec",
  "targetSizeDeg",
  "targetSizeIsHeightBool",
  "targetMinPhysicalPx",
  "spacingDeg",
  "spacingDirection",
  "spacingRelationToSize",
  "spacingOverSizeRatio",
  "spacingSymmetry",
  "spacingIsOuterBool",
  "thresholdParameter",
  "thresholdProcedure",
  "thresholdGuess",
  "thresholdGuessLogSd",
  "thresholdBeta",
  "thresholdDelta",
  "thresholdProportionCorrect",
  "thresholdRepeatBadBlockBool",
  "markingOffsetBeforeTargetOnsetSecs",
  "markingOnsetAfterTargetOffsetSecs",
  "responseMustTrackContinuouslyBool",
];

const READING: readonly string[] = [
  "readingCorpus",
  "readingSetSizeBy",
  "readingNominalSizeDeg",
  "readingXHeightDeg",
  "readingSpacingDeg",
  "readingPages",
  "readingLinesPerPage",
  "readingMaxCharactersPerLine",
  "readingNumberOfQuestions",
  "readingNumberOfPossibleAnswers",
  "readingTargetMaxWordFrequency",
  "readingCorpusShuffleBool",
  "fontLeftToRightBool",
];

const RSVP: readonly string[] = [
  "readingCorpus",
  "rsvpReadingNumberOfWords",
  "rsvpReadingWordsPerScreen",
  "rsvpReadingFlankTargetWithLettersBool",
  "rsvpReadingRequireUniqueWordsBool",
  "thresholdParameter",
  "thresholdGuess",
  "thresholdBeta",
  "thresholdProportionCorrect",
  "responseSpokenToExperimenterBool",
  "targetSizeDeg",
];

const SOUND: readonly string[] = [
  "targetSoundFolder",
  "maskerSoundFolder",
  "targetSoundDBSPL",
  "maskerDBSPL",
  "targetSoundNoiseDBSPL",
  "thresholdParameter",
  "thresholdGuess",
  "thresholdBeta",
  "thresholdProportionCorrect",
];

const forKind = (kind: string): readonly string[] => {
  switch (kind) {
    case "reading":
      return READING;
    case "rsvpReading":
      return RSVP;
    case "sound":
    case "vocoderPhrase":
      return SOUND;
    case "letter":
    case "repeatedLetters":
    case "gabor":
    case "image":
    case "movie":
    case "vernier":
    default:
      return LETTER;
  }
};

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

const mark = (e: Effective): string =>
  e.source === "default" ? `${e.value}*` : e.value;

/** "name value" for one parameter, or null when nothing applies. */
const fact = (name: string, e: Effective): string | null =>
  e.source === "none" ? null : `${name} ${mark(e)}`;

const sideOf = (x: number, y: number): string => {
  if (x === 0 && y === 0) return "at fixation";
  const ecc = Math.hypot(x, y);
  const side =
    Math.abs(x) >= Math.abs(y)
      ? x > 0
        ? "right"
        : "left"
      : y > 0
      ? "upper"
      : "lower";
  return `${Number(ecc.toFixed(2))} deg ${side}${
    Math.abs(x) > 0 && Math.abs(y) > 0 ? " field" : ""
  }`;
};

/** Everything a Methods section needs, as text for the model. */
export function studyFacts(table: TableState, name: string): string {
  const lines: string[] = [];
  lines.push(name ? `STUDY FACTS — ${name}` : "STUDY FACTS");
  lines.push(
    "Each value is what the study will run with: the cell, else column B, else the glossary default (marked *). A parameter missing here has no value at all.",
  );

  lines.push("");
  lines.push("Experiment-wide");
  for (const p of EXPERIMENT_WIDE) {
    const f = fact(p, effectiveWide(table, p));
    if (f) lines.push(`  ${f}`);
  }
  const questions = table.rows.filter(
    (r) =>
      /^questionAndAnswer\d+$/.test(r.name) && r.values.some((v) => v.trim()),
  );
  if (questions.length)
    lines.push(
      `  questionnaire: ${questions.length} questionAndAnswer row${
        questions.length === 1 ? "" : "s"
      } (${questions
        .map(
          (r) =>
            r.values
              .find((v) => v.trim())
              ?.split("|")[0]
              .trim() ?? "",
        )
        .filter(Boolean)
        .slice(0, 6)
        .join("; ")}${questions.length > 6 ? "; …" : ""})`,
    );
  const sec = estimateDurationSec(table);
  lines.push(
    `  estimated session ${Math.max(
      1,
      Math.round(sec / 60),
    )} min (${DURATION_RULE})`,
  );

  const cis = enabledConditions(table);
  const blocks = new Map<string, number[]>();
  for (const ci of cis) {
    const b = effective(table, "block", ci).value || "?";
    blocks.set(b, [...(blocks.get(b) ?? []), ci]);
  }
  const blockKeys = [...blocks.keys()].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  for (const b of blockKeys) {
    const members = blocks.get(b) ?? [];
    const trials = members.reduce(
      (n, ci) =>
        n + (Number(effective(table, "conditionTrials", ci).value) || 0),
      0,
    );
    lines.push("");
    lines.push(
      `Block ${b} — ${
        members.length === 1
          ? "one condition"
          : `${members.length} conditions interleaved`
      } (${members.map(columnLetter).join(", ")}), ${trials} trials`,
    );
    for (const ci of members) {
      const kind = effective(table, "targetKind", ci).value || "letter";
      const params = [...COMMON, ...forKind(kind)];
      const seen = new Set<string>();
      const facts: string[] = [];
      for (const p of params) {
        if (seen.has(p)) continue;
        seen.add(p);
        const f = fact(p, effective(table, p, ci));
        if (f) facts.push(f);
      }
      const x =
        Number(effective(table, "targetEccentricityXDeg", ci).value) || 0;
      const y =
        Number(effective(table, "targetEccentricityYDeg", ci).value) || 0;
      const where = forKind(kind) === LETTER ? ` — target ${sideOf(x, y)}` : "";
      lines.push(`  Column ${columnLetter(ci)}${where}`);
      lines.push(`    ${facts.join("; ")}`);
    }
  }
  if (cis.length === 0) {
    lines.push("");
    lines.push("No enabled conditions.");
  }
  const disabled = table.conditionCount - cis.length;
  if (disabled > 0)
    lines.push(
      `\n${disabled} disabled column${
        disabled === 1 ? "" : "s"
      } omitted (conditionEnabledBool FALSE or conditionTrials 0).`,
    );
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

/**
 * The Methods document has one fixed shape; the model supplies only the
 * prose of each section. Everything else — title block, provenance note,
 * section order and headings, the conditions table, the list of blanks,
 * the colophon — is composed here from the table, so two drafts of two
 * studies look like two sections of the same journal.
 */
export const METHODS_SECTIONS = [
  "participants",
  "apparatus",
  "stimuli",
  "procedure",
  "analysis",
] as const;

export type MethodsSectionId = (typeof METHODS_SECTIONS)[number];

const SECTION_HEADINGS: Record<MethodsSectionId, string> = {
  participants: "Participants",
  apparatus: "Apparatus",
  stimuli: "Stimuli",
  procedure: "Procedure",
  analysis: "Design and analysis",
};

export interface MethodsSections {
  title?: string;
  participants: string;
  apparatus: string;
  stimuli: string;
  procedure: string;
  analysis: string;
}

/** Prose only: the model's stray headings and labels are removed. */
const cleanProse = (raw: string, heading: string): string =>
  raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*#+\s*/, "").trimEnd())
    .filter(
      (l, i) =>
        !(
          i === 0 &&
          (l.trim().toLowerCase() === heading.toLowerCase() ||
            l.trim().toLowerCase() === `${heading.toLowerCase()}:` ||
            l.trim().replace(/\*/g, "").toLowerCase() === heading.toLowerCase())
        ),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** "[N] participants" → "N participants"; unique, in order of appearance. */
export const bracketedBlanks = (text: string): string[] => {
  const out: string[] = [];
  for (const m of text.matchAll(/\[([^[\]\n]{1,80})\]/g)) {
    const item = m[1].trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
};

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const fmtNum = (v: string): string => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Number(n.toFixed(3))) : v;
};

/** Table 1 speaks to readers, not to the compiler. */
const THRESHOLD_LABELS: Record<string, string> = {
  spacingDeg: "spacing (deg)",
  targetSizeDeg: "letter size (deg)",
  targetContrast: "contrast",
  targetDurationSec: "duration (s)",
  targetEccentricityXDeg: "horizontal eccentricity (deg)",
  targetEccentricityYDeg: "vertical eccentricity (deg)",
  targetSoundDBSPL: "sound level (dB SPL)",
  maskerDBSPL: "masker level (dB SPL)",
};

const thresholdLabel = (p: string): string =>
  p === "" ? "none (fixed)" : THRESHOLD_LABELS[p] ?? p;

export interface ConditionsTable {
  head: string[];
  /** One row per enabled condition, by block; "" = not applicable. */
  rows: string[][];
}

export const TABLE_HEAD = [
  "Block",
  "Condition",
  "Target",
  "Task",
  "Eccentricity x, y (deg)",
  "Varied by QUEST",
  "Flankers",
  "Duration (s)",
  "Trials",
  "Distance (cm)",
] as const;

/** Table 1: one row per enabled condition, by block. */
export function conditionsTable(table: TableState): ConditionsTable {
  const cis = enabledConditions(table);
  const rows = cis
    .map((ci) => ({ ci, block: effective(table, "block", ci).value || "?" }))
    .sort(
      (a, b) =>
        Number(a.block) - Number(b.block) ||
        a.block.localeCompare(b.block) ||
        a.ci - b.ci,
    )
    .map(({ ci, block }) => {
      const kind = effective(table, "targetKind", ci).value || "letter";
      const isLetter = forKind(kind) === LETTER;
      const tp = effective(table, "thresholdParameter", ci).value;
      // As the runtime lays it out: a spacing threshold is a triplet, a size
      // threshold a single letter, otherwise spacingRelationToSize decides.
      const relation = effective(table, "spacingRelationToSize", ci).value;
      const hasFlankers =
        tp === "spacingDeg" || (tp !== "targetSizeDeg" && relation !== "none");
      const flankers = hasFlankers
        ? effective(table, "spacingDirection", ci).value
        : "none";
      return [
        block,
        effective(table, "conditionName", ci).value || columnLetter(ci),
        kind,
        effective(table, "targetTask", ci).value,
        isLetter
          ? `${fmtNum(
              effective(table, "targetEccentricityXDeg", ci).value,
            )}, ${fmtNum(effective(table, "targetEccentricityYDeg", ci).value)}`
          : "",
        thresholdLabel(tp),
        isLetter ? flankers : "",
        isLetter ? fmtNum(effective(table, "targetDurationSec", ci).value) : "",
        effective(table, "conditionTrials", ci).value,
        effective(table, "viewingDistanceDesiredCm", ci).value,
      ].map((v) => (v ?? "").trim());
    });
  return { head: [...TABLE_HEAD], rows };
}

const longDate = (d: Date): string =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * What the authors must still fill in: the title block's missing lines and
 * every bracketed blank in the prose.
 */
export function methodsBlanks(
  table: TableState,
  sections: MethodsSections,
): string[] {
  const out: string[] = [];
  if (!effectiveWide(table, "_authors").value.trim()) out.push("Authors");
  if (!effectiveWide(table, "_authorAffiliations").value.trim())
    out.push("Affiliations");
  for (const b of bracketedBlanks(
    METHODS_SECTIONS.map((id) => sections[id]).join("\n"),
  ))
    if (!out.includes(b)) out.push(b);
  return out;
}

/** The document as data: what the renderer lays out, and what tests check. */
export interface MethodsDocument {
  title: string;
  authors: string;
  affiliations: string;
  about: string;
  note: string;
  sections: { heading: string; paragraphs: string[] }[];
  table: ConditionsTable;
  tableCaption: string;
  blanks: string[];
  colophon: string;
}

export const TABLE_CAPTION =
  "Conditions of the experiment, by block. Conditions that share a block were randomly interleaved within it. Eccentricity is the target center relative to fixation, horizontal then vertical, positive rightward and upward. Distance is the nominal viewing distance.";

export function methodsDocument(
  table: TableState,
  name: string,
  sections: MethodsSections,
  now: Date = new Date(),
): MethodsDocument {
  const cis = enabledConditions(table);
  const blocks = new Set(cis.map((ci) => effective(table, "block", ci).value));
  const minutes = Math.max(1, Math.round(estimateDurationSec(table) / 60));
  const study = name.trim() || "Untitled study";
  return {
    title: (sections.title ?? "").trim() || study,
    authors: effectiveWide(table, "_authors").value.trim(),
    affiliations: effectiveWide(table, "_authorAffiliations").value.trim(),
    about: effectiveWide(table, "_about").value.trim(),
    note: `Draft generated by EasyEyes Studio from the experiment file “${study}” on ${longDate(
      now,
    )}. It describes what that file will run: every value is as the file specifies, or the EasyEyes default where the file is silent. The authors should check it against what they intend before using it. Highlighted text in [square brackets] is to be completed by the authors.`,
    sections: METHODS_SECTIONS.map((id) => ({
      heading: SECTION_HEADINGS[id],
      paragraphs: cleanProse(sections[id], SECTION_HEADINGS[id])
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean),
    })),
    table: conditionsTable(table),
    tableCaption: TABLE_CAPTION,
    blanks: methodsBlanks(table, sections),
    colophon: `Draft · EasyEyes Studio · ${study} · ${cis.length} condition${
      cis.length === 1 ? "" : "s"
    } in ${blocks.size} block${
      blocks.size === 1 ? "" : "s"
    } · estimated session ${minutes} min · ${longDate(now)}`,
  };
}

/* ---- HTML ---- */

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escaped prose with each [blank] marked so it cannot be missed. */
const inline = (s: string): string =>
  esc(s).replace(
    /\[([^[\]\n]{1,80})\]/g,
    (_m, b: string) => `<mark class="blank">[${b}]</mark>`,
  );

/**
 * One stylesheet for every Methods document: a single column set like a
 * journal page, serif text, a booktabs table, and a print layout that goes
 * straight to PDF from the browser.
 */
export const METHODS_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { background: #e9eaec; }
body { margin: 0; font-family: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif; color: #1a1d1b; font-size: 17px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.page { max-width: 7.4in; margin: 40px auto 56px; padding: 72px 80px 64px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.08); }
header.title-block { margin-bottom: 36px; }
.kicker { margin: 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #8a918e; }
h1 { margin: 0 0 14px; font-size: 30px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; }
.authors { margin: 0; font-size: 17px; }
.affiliations { margin: 4px 0 0; font-size: 15px; color: #4b514e; }
.about { margin: 22px 0 0; font-size: 15.5px; font-style: italic; color: #3a3f3d; }
.note { margin: 22px 0 0; padding: 12px 16px; border-left: 3px solid #cfd6d2; background: #f6f7f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 12.5px; line-height: 1.5; color: #4b514e; }
h2 { margin: 44px 0 18px; padding-bottom: 8px; border-bottom: 1px solid #1a1d1b; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
h3 { margin: 28px 0 8px; font-size: 17.5px; font-weight: 700; }
p { margin: 0 0 12px; text-align: justify; hyphens: auto; }
mark.blank { background: #fff2a8; color: inherit; padding: 0 2px; border-radius: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
figure.table { margin: 32px -40px 0; page-break-inside: avoid; }
figcaption { margin: 0 40px 10px; font-size: 14px; line-height: 1.5; text-align: left; }
figcaption b { font-weight: 700; }
table { width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.35; }
thead th { padding: 8px 6px 7px; border-top: 1.5px solid #1a1d1b; border-bottom: 1px solid #1a1d1b; text-align: left; font-weight: 600; vertical-align: bottom; }
tbody td { padding: 6px 6px; border-bottom: 1px solid #e3e6e4; vertical-align: top; }
tbody tr:last-child td { border-bottom: 1.5px solid #1a1d1b; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.num { white-space: nowrap; }
table { table-layout: auto; }
td.none { color: #8a918e; }
section.todo { margin-top: 36px; padding: 16px 18px; border: 1px solid #e3e6e4; border-radius: 6px; background: #fbfcfb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
section.todo h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
section.todo ul { margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.6; }
section.todo p { margin: 0; font-size: 13.5px; line-height: 1.6; text-align: left; hyphens: none; }
section.todo p.check { margin-top: 10px; color: #4b514e; }
footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e3e6e4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11.5px; color: #8a918e; }
@page { size: Letter; margin: 1in; }
@media print {
  html { background: #fff; }
  body { font-size: 11pt; line-height: 1.5; }
  .page { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  figure.table { margin-left: 0; margin-right: 0; }
  figcaption { margin-left: 0; margin-right: 0; }
  h1 { font-size: 20pt; }
  h2 { margin-top: 24pt; }
  h3 { font-size: 12pt; page-break-after: avoid; }
  .note, section.todo { border-color: #bbb; background: #fff; }
  a { color: inherit; text-decoration: none; }
}
`;

const NUMERIC_COLUMNS = new Set([
  "Block",
  "Eccentricity x, y (deg)",
  "Duration (s)",
  "Trials",
  "Distance (cm)",
]);

export function renderMethodsHtml(doc: MethodsDocument): string {
  const head = doc.table.head;
  const tableHtml =
    doc.table.rows.length === 0
      ? `<p><em>No enabled conditions.</em></p>`
      : `<table>
<thead><tr>${head
          .map(
            (h) =>
              `<th${NUMERIC_COLUMNS.has(h) ? ' class="num"' : ""}>${esc(
                h,
              )}</th>`,
          )
          .join("")}</tr></thead>
<tbody>
${doc.table.rows
  .map(
    (r) =>
      `<tr>${r
        .map((v, i) => {
          const cls = [
            NUMERIC_COLUMNS.has(head[i]) ? "num" : "",
            v === "" ? "none" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<td${cls ? ` class="${cls}"` : ""}>${
            v === "" ? "—" : esc(v)
          }</td>`;
        })
        .join("")}</tr>`,
  )
  .join("\n")}
</tbody>
</table>`;

  const sections = doc.sections
    .map(
      (s) =>
        `<h3>${esc(s.heading)}</h3>\n${s.paragraphs
          .map((p) => `<p>${inline(p)}</p>`)
          .join("\n")}`,
    )
    .join("\n\n");

  const todo =
    (doc.blanks.length
      ? `<ul>${doc.blanks.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : `<p>No blanks.</p>`) +
    `\n<p class="check">Then read the draft against the experiment file and against what you intend: it states what the file will run, and only the authors can say whether that is the study they mean.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — Methods (draft)</title>
<meta name="generator" content="EasyEyes Studio">
<style>${METHODS_CSS}</style>
</head>
<body>
<article class="page">
<header class="title-block">
<p class="kicker">Methods · Draft</p>
<h1>${esc(doc.title)}</h1>
<p class="authors">${doc.authors ? esc(doc.authors) : inline("[Authors]")}</p>
<p class="affiliations">${
    doc.affiliations ? esc(doc.affiliations) : inline("[Affiliations]")
  }</p>
${
  doc.about ? `<p class="about">${esc(doc.about)}</p>\n` : ""
}<p class="note">${inline(doc.note)}</p>
</header>

<h2>Methods</h2>

${sections}

<figure class="table">
<figcaption><b>Table 1.</b> ${esc(doc.tableCaption)}</figcaption>
${tableHtml}
</figure>

<section class="todo">
<h3>To complete</h3>
${todo}
</section>

<footer>${esc(doc.colophon)}</footer>
</article>
</body>
</html>
`;
}

/** The whole document as a self-contained HTML page, always in the same shape. */
export const composeMethods = (
  table: TableState,
  name: string,
  sections: MethodsSections,
  now: Date = new Date(),
): string => renderMethodsHtml(methodsDocument(table, name, sections, now));

/* ------------------------------------------------------------------ */
/* Skill                                                               */
/* ------------------------------------------------------------------ */

export const METHODS_TOOLS = [
  {
    name: "study_facts",
    description:
      "Everything a Methods section needs from the current table: experiment-wide settings (consent, language, calibrations, recruitment), the compiler's session-length estimate, and for each enabled condition, grouped by block, the effective value of every Methods-relevant parameter — the cell, else column B, else the glossary default (marked *). Read-only. Call it before write_methods.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "write_methods",
    description:
      "Produce the Methods draft as a downloadable, print-ready HTML page, for the authors to check and finish. You supply the prose of each section; the tool typesets it in the fixed journal format (title block, provenance note, the five sections in order, Table 1 of the conditions generated from the table, the list of bracketed blanks highlighted in the text, a colophon). Call it once, after study_facts, with every section filled; call it again to revise. The scientist receives the file in the chat, so do not repeat the Methods text in your reply.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "Paper-style title for the study, e.g. “Letter crowding at 5 and 10 degrees in the right visual field”. Default: the experiment name.",
        },
        participants: {
          type: "string",
          description:
            "Prose. Who was tested is unknown: a template with bracketed blanks ([N] participants, [age range], [vision], [ethics approval]) plus the recruitment, consent and payment facts study_facts gives.",
        },
        apparatus: {
          type: "string",
          description:
            "Prose. Browser-based EasyEyes; how screen size was calibrated; how viewing distance was set or tracked and the nominal distance; background and contrast.",
        },
        stimuli: {
          type: "string",
          description:
            "Prose. Font and source, character set, position, size or spacing and what defines it, flanker arrangement, presentation duration, fixation mark; every number with units.",
        },
        procedure: {
          type: "string",
          description:
            "Prose. The trial sequence, response modes, QUEST (criterion, slope, lapse, prior), trials per condition, blocks and interleaving, breaks, session length.",
        },
        analysis: {
          type: "string",
          description:
            "Prose. Design (conditions × blocks, what varies), the dependent measure and how threshold is estimated from each QUEST run, in log units where relevant.",
        },
      },
      required: [
        "participants",
        "apparatus",
        "stimuli",
        "procedure",
        "analysis",
      ],
    },
  },
] as const;

export const METHODS_TOOL_NAMES: ReadonlySet<string> = new Set(
  METHODS_TOOLS.map((t) => t.name),
);

export const METHODS_INSTRUCTIONS = `METHODS WRITER (on)
The scientist wants a first draft of the Methods section for this study, for a paper, preregistration, or ethics application. It is a draft, not a finished Methods: it describes what the experiment file will run, and only the authors can judge whether that is the study they intend. The deliverable is a file: call study_facts, then write_methods with the prose of all five sections; the tool typesets them in the fixed journal format and the scientist gets a downloadable HTML document in the chat (it opens in the browser and prints to PDF; Copy pastes into Word or Google Docs with formatting). Your own reply is then two or three sentences: that the draft is ready to check, what it assumed, and the blanks to fill. Call it a draft; do not present it as ready to submit. Never paste the Methods text into the chat.
- Write from study_facts, not memory: a blank cell means the glossary default, which study_facts resolves (values marked * are defaults), so nothing is "unspecified" unless study_facts omits it.
- Each section is plain journal prose in the past tense: full sentences, paragraphs separated by a blank line, no headings, no bullets, no tables (the tool adds Table 1 of the conditions itself; refer to it as Table 1). Every number carries its unit. Do not name parameters; translate them (viewingDistanceDesiredCm 50 → "a viewing distance of 50 cm").
- Participants: who was tested is unknown. A template with bracketed blanks — [N] participants, [age range], [normal or corrected-to-normal vision], [ethics approval] — plus the recruitment, consent and payment facts you have (_online1RecruitmentService, _online2Participants, _online2PayPerHour, _online2Minutes, _consentForm). Brackets are how blanks are collected, so bracket every blank and nothing else.
- Apparatus: the experiment ran in the participant's web browser with EasyEyes (easyeyes.app). Screen size calibration (calibrateScreenSizeBool TRUE: the participant matched an on-screen rectangle to a credit card, giving pixels per cm). Viewing distance: _calibrateDistance names the initial method; calibrateDistanceBool TRUE means the webcam tracked distance throughout and the participant was nudged back when it drifted beyond viewingDistanceAllowedRatio; give the nominal distance in cm. Background (screenColorRGBA as a gray level) and contrast (targetContrast −1 is black on that background).
- Stimuli: font and source, character set, target position in deg from fixation, size or spacing and what defines it (targetSizeIsHeightBool; spacingRelationToSize with spacingOverSizeRatio; spacingDirection), presentation duration, fixation mark.
- Procedure: the trial (fixation, click or key to start, brief stimulus, response by clicking or typing the letter), QUEST as the staircase — threshold as the level yielding thresholdProportionCorrect correct, Weibull slope thresholdBeta, lapse rate thresholdDelta, prior mean thresholdGuess with log sd thresholdGuessLogSd — trials per condition, blocks and interleaving, breaks, estimated session length. For reading conditions describe pages, lines, and retention questions instead.
- Design and analysis: the factors (what differs across conditions and blocks), the dependent measure, and how each threshold is estimated (QUEST's final estimate, usually reported in log units and averaged across repeats).
- Do not invent anything study_facts does not say. Writing Methods never changes the table; if a design question comes up, answer it separately.`;

export const methodsSkillBlock = (): SystemBlock => ({
  type: "text",
  text: METHODS_INSTRUCTIONS,
});

const MIN_SECTION_CHARS = 40;

export function runMethodsTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AssistantContext,
): ToolOutcome {
  switch (name) {
    case "study_facts":
      return {
        result: studyFacts(ctx.table, ctx.name),
        activity: "Gathered study facts for Methods",
      };
    case "write_methods": {
      const missing = METHODS_SECTIONS.filter(
        (id) =>
          typeof input[id] !== "string" ||
          (input[id] as string).trim().length < MIN_SECTION_CHARS,
      );
      if (missing.length)
        return {
          result: `write_methods needs prose for every section; too short or missing: ${missing.join(
            ", ",
          )}.`,
          isError: true,
          activity: "Methods draft: sections missing",
        };
      const sections: MethodsSections = {
        title: typeof input.title === "string" ? input.title : undefined,
        participants: input.participants as string,
        apparatus: input.apparatus as string,
        stimuli: input.stimuli as string,
        procedure: input.procedure as string,
        analysis: input.analysis as string,
      };
      const content = composeMethods(ctx.table, ctx.name, sections);
      const blanks = methodsBlanks(ctx.table, sections);
      const words = METHODS_SECTIONS.map((id) => sections[id])
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
      const study = ctx.name.trim() || "study";
      return {
        result: `Methods draft written (${words} words, ${blanks.length} blank${
          blanks.length === 1 ? "" : "s"
        } for the authors). The scientist has it as a file in the chat; do not repeat its text. Tell them it is a draft to check against the study they intend. Blanks: ${
          blanks.join("; ") || "none"
        }.`,
        activity: "Wrote the Methods draft",
        file: {
          name: `${slug(study) || "study"}-methods-draft.html`,
          mime: "text/html",
          content,
          title: `Methods draft — ${study}`,
          subtitle: `${words} words · ${
            blanks.length
              ? `${blanks.length} blank${
                  blanks.length === 1 ? "" : "s"
                } to complete`
              : "no blanks"
          } · check before use`,
        },
      };
    }
    default:
      return {
        result: `Unknown tool ${name}`,
        isError: true,
        activity: `Unknown tool ${name}`,
      };
  }
}

export const methodsSkill: Skill = {
  id: "methods",
  title: "Methods draft",
  summary:
    "A first draft of a journal-style Methods section, written from what the experiment file will run and typeset as a print-ready page in one fixed format: Participants, Apparatus, Stimuli, Procedure, Design and analysis, Table 1 of the conditions, and the blanks only you can fill. A starting point to check and finish, not a finished Methods.",
  trigger: METHODS_TRIGGER,
  prompt: "Draft the Methods section for this study.",
  tools: METHODS_TOOLS,
  toolNames: METHODS_TOOL_NAMES,
  systemBlock: async () => methodsSkillBlock(),
  run: async (name, input, ctx) => runMethodsTool(name, input, ctx),
};
