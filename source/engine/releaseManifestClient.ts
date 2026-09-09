/**
 * Client for the release manifest service (netlify/functions/release-manifest,
 * issue #175): resolves a release id to its pinned versions, or the mutable
 * "latest" pointer. Never throws — a network error, non-2xx status, or
 * malformed body all resolve to null, so resolveEngine.ts can treat every
 * manifest failure as the single "release unresolved" fallback case.
 */
import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export interface ManifestEntry {
  schemaVersion: 1;
  releaseId: string;
  contractVersion: number;
  engine: { package: string; version: string; integrity: string };
  glossary: { version: string; digest: string };
  phrases: { version: string; digest: string };
  catalogUsageReportId: string;
  publishedAt: string;
  manifestDigest: string;
}

export interface ReleaseListEntry {
  release: string;
  changelog: string;
}

export interface ManifestClient {
  getManifest: (releaseId: string) => Promise<ManifestEntry | null>;
  getLatest: () => Promise<string | null>;
  listReleases: () => Promise<ReleaseListEntry[]>;
  getExperimentPin: (
    username: string,
    experiment: string,
    accessToken: string,
  ) => Promise<ExperimentReleasePin | null>;
}

export interface ExperimentReleasePin {
  releaseId: string;
  manifestDigest: string;
  artifactRevision: string;
  pinnedAt: string;
}

type FetchImpl = typeof fetch;

const getJson = async (
  url: string,
  fetchImpl: FetchImpl,
): Promise<unknown | null> => {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const createReleaseManifestClient = (
  fetchImpl: FetchImpl = fetch,
): ManifestClient => ({
  getManifest: async (releaseId) => {
    const base = await getEasyEyesBaseUrl();
    const data = await getJson(
      `${base}/.netlify/functions/release-manifest?release=${encodeURIComponent(
        releaseId,
      )}`,
      fetchImpl,
    );
    return (data as ManifestEntry | null) ?? null;
  },
  getLatest: async () => {
    const base = await getEasyEyesBaseUrl();
    const data = await getJson(
      `${base}/.netlify/functions/release-manifest?latest`,
      fetchImpl,
    );
    return (data as ManifestEntry | null)?.releaseId ?? null;
  },
  listReleases: async () => {
    const base = await getEasyEyesBaseUrl();
    const data = await getJson(
      `${base}/.netlify/functions/release-manifest?list`,
      fetchImpl,
    );
    return (data as ReleaseListEntry[] | null) ?? [];
  },
  getExperimentPin: async (username, experiment, accessToken) => {
    const base = await getEasyEyesBaseUrl();
    try {
      const response = await fetchImpl(
        `${base}/.netlify/functions/release-manifest?username=${encodeURIComponent(
          username,
        )}&experiment=${encodeURIComponent(experiment)}`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) return null;
      return (await response.json()) as ExperimentReleasePin;
    } catch {
      return null;
    }
  },
});
