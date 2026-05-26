import { getRetryDelayMs, wait } from "../threshold/preprocess/retry";

let _glossaryRawText = "";

export function getGlossaryRawText() {
  return _glossaryRawText;
}

export async function fetchGlossary() {
  const url =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8888/.netlify/functions/glossary"
      : "/.netlify/functions/glossary";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Glossary fetch failed: ${response.status}`);
  }
  const text = await response.text();
  _glossaryRawText = text;
  // The function returns JS that assigns window globals — execute it.
  // eslint-disable-next-line no-new-func
  new Function("window", text)(window);
  return text;
}

export async function fetchGlossaryWithBackoff(captureError) {
  let attempt = 0;
  for (;;) {
    try {
      return await fetchGlossary();
    } catch (error) {
      captureError(error, "Glossary fetch failed at compile time", { attempt });
      console.log("Glossary fetch failed, retrying...", error);
      await wait(getRetryDelayMs(attempt));
      attempt++;
    }
  }
}
