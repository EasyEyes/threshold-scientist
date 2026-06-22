import { getEasyEyesBaseUrl } from "../threshold/components/easyeyesBaseUrl";

export class TranslateExportError extends Error {}

export async function translateExport(strings, targetLangCode) {
  const base = await getEasyEyesBaseUrl();
  const response = await fetch(
    `${base}/.netlify/functions/translate-experiment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: strings, targetLang: targetLangCode }),
    },
  );
  if (!response.ok) {
    throw new TranslateExportError(
      `Translation request failed: ${response.status}`,
    );
  }
  const { translations } = await response.json();
  return translations;
}
