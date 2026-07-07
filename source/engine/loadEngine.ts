/**
 * Obtains a pinned threshold-engine release by dynamic import() of its
 * immutable jsDelivr URL, and enforces the contractVersion guard (ADR 0001):
 * the shell must refuse to drive an engine speaking a newer contract than
 * the highest version it understands.
 *
 * The release id is hardcoded for the S3 tracer (issue #174); version
 * selection arrives in a later slice.
 */
import type { ThresholdEngine } from "../../threshold/threshold-engine/contract/engine-compile";
import { CONTRACT_VERSION } from "../../threshold/threshold-engine/contract/engine-compile";

/** Highest engine.compile() contract version this shell understands. */
export const SHELL_CONTRACT_VERSION: number = CONTRACT_VERSION;

/** The engine release the shell drives (immutable, exact-version URL). */
export const ENGINE_RELEASE_URL =
  "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.7.8/dist/index.js";

/**
 * Where the participant runtime of that same release lives; the engine
 * writes this into the generated entry files (options.data.entryBaseUrl).
 */
export const ENGINE_RUNTIME_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.7.8/runtime/";

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
  url: string = ENGINE_RELEASE_URL,
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
