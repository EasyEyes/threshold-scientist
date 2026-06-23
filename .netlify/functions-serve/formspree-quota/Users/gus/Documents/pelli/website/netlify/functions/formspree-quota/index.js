// ../../netlify/functions/formspree-quota/index.js
var FORMSPREE_API_BASE = "https://formspree.io/api/0";
var DEFAULT_FORM_ID = "mqkrdveg";
var DEFAULT_MONTHLY_QUOTA = 2e4;
var responseWrapper = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
};
var startOfCurrentMonthISO = () => {
  const now = /* @__PURE__ */ new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
  );
  return start.toISOString().replace(/\.\d{3}Z$/, "");
};
var countSubmissionsThisMonth = async (formId, apiKey) => {
  const since = startOfCurrentMonthISO();
  const pageLimit = 1e3;
  const maxPages = 60;
  let total = 0;
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const url = `${FORMSPREE_API_BASE}/forms/${formId}/submissions?since=${encodeURIComponent(
      since,
    )}&limit=${pageLimit}&offset=${offset}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Formspree submissions request failed: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();
    const items = Array.isArray(data)
      ? data
      : data.submissions || data.results || [];
    total += items.length;
    if (items.length < pageLimit) break;
    offset += pageLimit;
  }
  return total;
};
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return responseWrapper(200, {});
  }
  const apiKey = process.env.FORMSPREE_API_KEY;
  const formId = process.env.FORMSPREE_FORM_ID || DEFAULT_FORM_ID;
  const limit =
    parseInt(process.env.FORMSPREE_MONTHLY_QUOTA, 10) || DEFAULT_MONTHLY_QUOTA;
  if (!apiKey) {
    return responseWrapper(200, {
      available: false,
      reason: "FORMSPREE_API_KEY not configured",
    });
  }
  try {
    const used = await countSubmissionsThisMonth(formId, apiKey);
    return responseWrapper(200, {
      available: true,
      used,
      limit,
      month: startOfCurrentMonthISO().slice(0, 7),
    });
  } catch (error) {
    console.error("formspree-quota error:", error);
    return responseWrapper(200, {
      available: false,
      reason: error.message || "Unknown error",
    });
  }
};
//# sourceMappingURL=index.js.map
