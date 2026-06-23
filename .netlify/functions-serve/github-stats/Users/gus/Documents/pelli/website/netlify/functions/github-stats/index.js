// ../../netlify/functions/github-stats/index.js
var THRESHOLD_REPO = "EasyEyes/threshold";
var WEBSITE_REPO = "EasyEyes/website";
var SUCCESS_CACHE = "public, max-age=86400, s-maxage=86400";
var NO_CACHE = "no-store";
var responseWrapper = (statusCode, body, cacheControl) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": cacheControl,
  },
  body: JSON.stringify(body),
});
var ghJson = async (endpoint, headers) => {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${endpoint} failed: ${response.status}`);
  }
  return response.json();
};
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return responseWrapper(200, {}, NO_CACHE);
  }
  const headers = { "User-Agent": "easyeyes-compiler" };
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const [repo, commits] = await Promise.all([
      ghJson(`/repos/${THRESHOLD_REPO}`, headers),
      ghJson(`/repos/${WEBSITE_REPO}/commits?per_page=1`, headers),
    ]);
    return responseWrapper(
      200,
      {
        available: true,
        stars: repo.stargazers_count,
        license: (repo.license && repo.license.spdx_id) || "MIT",
        lastCommitUrl: commits[0] && commits[0].html_url,
      },
      SUCCESS_CACHE,
    );
  } catch (error) {
    console.error("github-stats error:", error);
    return responseWrapper(
      200,
      { available: false, reason: error.message || "Unknown error" },
      NO_CACHE,
    );
  }
};
//# sourceMappingURL=index.js.map
