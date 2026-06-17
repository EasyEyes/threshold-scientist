import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

// Fetches the footer's GitHub values (threshold stars/license, website's latest
// commit URL) via our cached Netlify proxy instead of hitting GitHub or a badge
// service directly. See netlify/functions/github-stats.
export async function fetchGitHubStats() {
  const response = await fetch(
    `${await getEasyEyesBaseUrl()}/.netlify/functions/github-stats`,
  );
  if (!response.ok) {
    throw new Error(`github-stats responded ${response.status}`);
  }
  return response.json();
}
