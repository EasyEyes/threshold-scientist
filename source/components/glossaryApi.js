import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export async function fetchGlossaryData() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary`,
  );
  return response.json();
}

export async function fetchGlossaryVersion() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary?versionOnly=1`,
  );
  return response.json();
}

export async function pinGlossaryVersion(username, experimentName) {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/glossary`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, experimentName }),
    },
  );
  return response.json();
}
