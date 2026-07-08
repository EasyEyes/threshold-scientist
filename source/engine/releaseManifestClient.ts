/**
 * Client for the release manifest service (netlify/functions/release-manifest,
 * issue #175): resolves a release id to its pinned versions, or the mutable
 * "latest" pointer. Never throws — a network error, non-2xx status, or
 * malformed body all resolve to null, so resolveEngine.ts can treat every
 * manifest failure as the single "release unresolved" fallback case.
 */
import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export interface ManifestEntry {
  engineVersion: string;
  glossaryVersion: string;
  phrasesVersion: string;
  gitSha: string;
  changelog: string;
}

export interface ReleaseListEntry {
  release: string;
  changelog: string;
}

export interface ManifestClient {
  getManifest: (releaseId: string) => Promise<ManifestEntry | null>;
  getLatest: () => Promise<string | null>;
  listReleases: () => Promise<ReleaseListEntry[]>;
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
    return (data as { release?: string } | null)?.release ?? null;
  },
  listReleases: async () => {
    const base = await getEasyEyesBaseUrl();
    const data = await getJson(
      `${base}/.netlify/functions/release-manifest?list`,
      fetchImpl,
    );
    return (data as ReleaseListEntry[] | null) ?? [];
  },
});
