/**
 * Obtains a pinned threshold-engine release by dynamic import() of its
 * immutable jsDelivr URL, and enforces the contractVersion guard (ADR 0001):
 * the shell must refuse to drive an engine speaking a newer contract than
 * the highest version it understands.
 *
 * The release URL is resolved by resolveEngine.ts (issue #176) from a
 * release id via the release manifest; this module only knows how to load
 * and contract-guard a specific, already-resolved URL.
 */
import type { ThresholdEngine } from "../../threshold/threshold-engine/contract/engine-compile";
import { CONTRACT_VERSION } from "../../threshold/threshold-engine/contract/engine-compile";

/** Highest engine.compile() contract version this shell understands. */
export const SHELL_CONTRACT_VERSION: number = CONTRACT_VERSION;

const ENGINE_NPM_PACKAGE = "@easyeyes-stage/threshold-engine";

/**
 * The immutable per-version jsDelivr URLs for a resolved engineVersion: the
 * compiler-facing module (`releaseUrl`) and the base URL under which that
 * same release's participant runtime lives (`runtimeBaseUrl`, written into
 * generated entry files as options.data.entryBaseUrl).
 */
export const engineUrlsForVersion = (
  engineVersion: string,
): { releaseUrl: string; runtimeBaseUrl: string } => {
  const base = `https://cdn.jsdelivr.net/npm/${ENGINE_NPM_PACKAGE}@${engineVersion}`;
  return {
    releaseUrl: `${base}/dist/index.js`,
    runtimeBaseUrl: `${base}/runtime/`,
  };
};

type ImportModule = (url: string) => Promise<{ default?: unknown }>;

// The engine must be fetched from the CDN at runtime with a NATIVE dynamic
// import. Neither TypeScript (module: commonjs) nor webpack may see a
// static `import()` here — both rewrite it into a bundled require (webpack
// turns it into a context module), which breaks the URL import. The
// Function constructor keeps it opaque to both toolchains.
const nativeImport: ImportModule = new Function(
  "url",
  "return import(url);",
) as ImportModule;

export const loadEngine = async (
  url: string,
  importModule: ImportModule = nativeImport,
): Promise<ThresholdEngine> => {
  const module = await importModule(url);
  const engine = module.default as ThresholdEngine | undefined;

  if (
    !engine ||
    typeof engine.compile !== "function" ||
    !Number.isInteger(engine.contractVersion)
  ) {
    throw new Error(
      `The module at ${url} is not a threshold engine (no compile()/contractVersion export).`,
    );
  }

  if (engine.contractVersion > SHELL_CONTRACT_VERSION) {
    throw new Error(
      `This engine release speaks contract version ${engine.contractVersion}, ` +
        `but this compiler page only understands version ${SHELL_CONTRACT_VERSION} or lower. ` +
        `Please reload the page to update the compiler.`,
    );
  }

  return engine;
};
