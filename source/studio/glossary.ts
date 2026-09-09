/**
 * The studio's view of the compiler's glossary registry.
 *
 * The registry is filled by the compiler page itself (prefetch at launch,
 * refreshed to the current version before a compile), and may be
 * re-initialized with a newer glossary mid-session. So nothing here is
 * computed at module scope: every derived list is built on demand and
 * memoized per glossary version.
 */
import {
  getGlossary,
  getGlossaryVersion,
  getSuperMatchingParams,
  initGlossary,
} from "../../threshold/parameters/glossaryRegistry";
import {
  fetchGlossaryData,
  getGlossaryPrefetch,
} from "../components/glossaryApi";
import type { GlossaryEntry } from "../components/types";

export function isGlossaryReady(): boolean {
  try {
    getGlossary();
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves once the registry holds a glossary: waits for the page's in-flight
 * prefetch if there is one, otherwise fetches the current version itself.
 */
export async function ensureGlossaryReady(): Promise<void> {
  if (isGlossaryReady()) return;
  const pending = getGlossaryPrefetch();
  if (pending) {
    try {
      await pending;
    } catch {
      // fall through to a direct fetch
    }
  }
  if (isGlossaryReady()) return;
  initGlossary(await fetchGlossaryData());
}

export const glossaryVersion = (): string => getGlossaryVersion() ?? "unknown";

export const parameterCount = (): number => Object.keys(getGlossary()).length;

/** Memoize a derived value until the registry's glossary version changes. */
export function memoByVersion<T>(compute: () => T): () => T {
  let version: string | null | undefined;
  let value: T | undefined;
  return () => {
    const current = getGlossaryVersion();
    if (value === undefined || version !== current) {
      value = compute();
      version = current;
    }
    return value;
  };
}

/** All non-obsolete parameters, alphabetized — the autocomplete corpus. */
export const suggestibleEntries = memoByVersion((): GlossaryEntry[] =>
  Object.values(getGlossary())
    .filter((e) => e.type !== "obsolete")
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
);

export const getEntry = (name: string): GlossaryEntry | undefined =>
  getGlossary()[name];

/**
 * Super-matching lookup — same rule as the compiler's _superMatching
 * (experimentFileChecks.ts): a name matches a pattern like
 * "questionAndAnswer@@" when it is the shared string plus exactly as many
 * characters as there are @s (e.g. questionAndAnswer01 … 99).
 */
export const superMatchingEntryFor = (
  name: string,
): GlossaryEntry | undefined => {
  for (const pattern of getSuperMatchingParams()) {
    const shared = pattern.replace(/@/g, "");
    if (
      name.includes(shared) &&
      pattern.replace(shared, "").length === name.replace(shared, "").length
    )
      return getGlossary()[pattern];
  }
  return undefined;
};

/** Exact glossary entry, or the super-matching pattern's entry. */
export const resolveEntry = (name: string): GlossaryEntry | undefined =>
  getEntry(name) ?? superMatchingEntryFor(name);
