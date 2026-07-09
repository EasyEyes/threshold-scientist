/**
 * The Engine Loader / Version Resolver (issue #176): given a release id (or
 * a request for "latest"), resolves it through the release manifest to an
 * engineVersion, derives that release's immutable engine URL, and drives it
 * through loadEngine's existing contractVersion guard (ADR 0001). Replaces
 * the S3 tracer's hardcoded release (issue #174).
 *
 * Fails closed: an unknown/missing release id, an unresolvable "latest"
 * pointer, or a manifest-service failure never falls through to compiling
 * with an unintended engine — the resolver throws a clear, user-visible
 * error instead.
 */
import type { ThresholdEngine } from "../../threshold/threshold-engine/contract/engine-compile";
import { loadEngine, engineUrlsForVersion } from "./loadEngine";
import {
  createReleaseManifestClient,
  type ManifestClient,
} from "./releaseManifestClient";

type ImportModule = Parameters<typeof loadEngine>[1];

export interface ResolveEngineDeps {
  manifestClient?: ManifestClient;
  importModule?: ImportModule;
}

export interface EngineHandle {
  engine: ThresholdEngine;
  /** Base URL for this same release's participant runtime. */
  runtimeBaseUrl: string;
  /** The concrete release id actually resolved ("latest" is never returned as-is). */
  release: string;
  /** This release's manifest-pinned glossary dataset version. */
  glossaryVersion: string;
  /** This release's manifest-pinned phrases dataset version. */
  phrasesVersion: string;
}

export const resolveEngine = async (
  releaseId: string,
  deps: ResolveEngineDeps = {},
): Promise<EngineHandle> => {
  const manifestClient = deps.manifestClient ?? createReleaseManifestClient();

  const resolvedRelease =
    releaseId === "latest" ? await manifestClient.getLatest() : releaseId;

  if (!resolvedRelease) {
    throw new Error(
      "Could not determine the latest threshold-engine release: the release manifest service is unavailable. Compiling has been stopped rather than risk using the wrong engine.",
    );
  }

  const entry = await manifestClient.getManifest(resolvedRelease);
  if (!entry) {
    throw new Error(
      `Release "${resolvedRelease}" was not found in the release manifest. Compiling has been stopped rather than risk using the wrong engine.`,
    );
  }

  const { releaseUrl, runtimeBaseUrl } = engineUrlsForVersion(
    entry.engineVersion,
  );
  const engine = await loadEngine(releaseUrl, deps.importModule);

  return {
    engine,
    runtimeBaseUrl,
    release: resolvedRelease,
    glossaryVersion: entry.glossaryVersion,
    phrasesVersion: entry.phrasesVersion,
  };
};
