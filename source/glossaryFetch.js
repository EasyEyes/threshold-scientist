import { getRetryDelayMs, wait } from "../threshold/preprocess/retry";

export async function fetchGlossary() {
  const response = await fetch("/.netlify/functions/glossary");
  if (!response.ok) {
    throw new Error(`Glossary fetch failed: ${response.status}`);
  }
  const text = await response.text();
  // The function returns JS that assigns window globals — execute it.
  // eslint-disable-next-line no-new-func
  new Function("window", text)(window);
}

export async function fetchGlossaryWithBackoff(captureError) {
  let attempt = 0;
  for (;;) {
    try {
      await fetchGlossary();
      return;
    } catch (error) {
      captureError(error, "Glossary fetch failed at compile time", { attempt });
      console.log("Glossary fetch failed, retrying...", error);
      await wait(getRetryDelayMs(attempt));
      attempt++;
    }
  }
}
