/**
 * Loads the parameter glossary into the production compiler's registry.
 * Uses the bundled snapshot (same data the compiler pins per experiment),
 * so the demo works offline and deterministically.
 */
import {
  glossary,
  glossaryVersion,
  superMatchingParams,
} from "./glossarySnapshot.js";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import type { GlossaryEntry } from "../../source/components/types";

const glossaryFull = Object.values(glossary) as GlossaryEntry[];

initGlossary({
  version: glossaryVersion,
  glossary: glossary as Record<string, GlossaryEntry>,
  glossaryFull,
  superMatchingParams,
});

export const GLOSSARY_VERSION: string = glossaryVersion;

export const PARAMETER_COUNT = glossaryFull.length;

/** All non-obsolete parameters, alphabetized — the autocomplete corpus. */
export const suggestibleEntries: GlossaryEntry[] = glossaryFull
  .filter((e) => e.type !== "obsolete")
  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

export const getEntry = (name: string): GlossaryEntry | undefined =>
  (glossary as Record<string, GlossaryEntry>)[name];

/**
 * Super-matching lookup — same rule as the compiler's _superMatching
 * (experimentFileChecks.ts): a name matches a pattern like
 * "questionAndAnswer@@" when it is the shared string plus exactly as many
 * characters as there are @s (e.g. questionAndAnswer01 … 99).
 */
export const superMatchingEntryFor = (
  name: string,
): GlossaryEntry | undefined => {
  for (const pattern of superMatchingParams as string[]) {
    const shared = pattern.replace(/@/g, "");
    if (
      name.includes(shared) &&
      pattern.replace(shared, "").length === name.replace(shared, "").length
    )
      return (glossary as Record<string, GlossaryEntry>)[pattern];
  }
  return undefined;
};

/** Exact glossary entry, or the super-matching pattern's entry. */
export const resolveEntry = (name: string): GlossaryEntry | undefined =>
  getEntry(name) ?? superMatchingEntryFor(name);
