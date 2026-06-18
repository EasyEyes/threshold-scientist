import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export async function fetchConfig() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/config`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
