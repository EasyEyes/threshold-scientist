import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";

// A single transient 502/503 from the glossary function (e.g. a Firebase blip)
// shouldn't break the compiler. Retry with a short backoff and surface non-2xx
// as an error so callers don't try to parse an error page as JSON.
async function fetchJsonWithRetry(url, options, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = options ? await fetch(url, options) : await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries)
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// When `version` is given, fetch that immutable version (`?v=`), which the CDN
// caches indefinitely. A new publish produces a new version → a new URL →
// guaranteed cache miss, so callers never receive a stale glossary. Omitting
// `version` hits the short-cached "current" endpoint (initial display only).
export async function fetchGlossaryData(version) {
  const base = `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary`;
  const url = version ? `${base}?v=${encodeURIComponent(version)}` : base;
  return fetchJsonWithRetry(url);
}

export async function fetchGlossaryVersion() {
  return fetchJsonWithRetry(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary?versionOnly=1`,
  );
}

export async function pinGlossaryVersion(username, experimentName) {
  return fetchJsonWithRetry(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, experimentName }),
    },
  );
}

let _prefetchPromise = null;
let _settled = false;

export function startGlossaryPrefetch() {
  if (_prefetchPromise !== null || _settled) return;
  _prefetchPromise = fetchGlossaryData()
    .then((data) => {
      initGlossary(data);
    })
    .finally(() => {
      _prefetchPromise = null;
      _settled = true;
    });
  _prefetchPromise.catch(() => {});
}

export function getGlossaryPrefetch() {
  return _prefetchPromise;
}
