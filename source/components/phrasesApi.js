import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export async function fetchPhrasesData() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/phrases`,
  );
  return response.json();
}

export async function fetchPhrasesVersion() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/phrases?versionOnly=1`,
  );
  return response.json();
}

export async function fetchPhrasesByVersion(version) {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/phrases?v=${encodeURIComponent(
      version,
    )}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch phrases version ${version}`);
  }
  return response.json();
}

export async function pinPhrasesVersion(username, experimentName, version) {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/phrases`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, experimentName, version }),
    },
  );
  if (!response.ok) throw new Error(`Failed to pin phrases version ${version}`);
  const result = await response.json();
  if (result.version !== version) {
    const error = new Error(
      `Pinned phrase version does not match validated version ${version}`,
    );
    error.code = "CATALOG_PIN_VERSION_MISMATCH";
    throw error;
  }
  return result;
}
