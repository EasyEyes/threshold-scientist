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

export async function pinPhrasesVersion(username, experimentName) {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/phrases`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, experimentName }),
    },
  );
  return response.json();
}
