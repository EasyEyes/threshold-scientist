"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toCommonJS = (mod) =>
  __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../netlify/functions/glossary/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler,
});
module.exports = __toCommonJS(index_exports);

// ../../netlify/functions/shared/encodeFirebaseSegment.ts
var ENCODING_MAP = {
  ".": "_dot_",
  "#": "_hash_",
  $: "_dollar_",
  "[": "_lbracket_",
  "]": "_rbracket_",
  "/": "_slash_",
};
var DECODING_MAP = Object.fromEntries(
  Object.entries(ENCODING_MAP).map(([k, v]) => [v, k]),
);
function encodeFirebaseSegment(segment) {
  return segment.replace(/[.#$[\]/]/g, (c) => ENCODING_MAP[c]);
}
function decodeFirebaseSegment(segment) {
  return segment.replace(
    /_dot_|_hash_|_dollar_|_lbracket_|_rbracket_|_slash_/g,
    (m) => DECODING_MAP[m],
  );
}

// ../../netlify/functions/shared/cors.ts
var NETLIFY_PREVIEW_RE = /^https:\/\/[a-z0-9-]+--easyeyes\.netlify\.app$/;
var STATIC_ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://run.pavlovia.org",
  "https://pavlovia.org",
  "https://easyeyes.app",
  "http://localhost:5500",
]);
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return NETLIFY_PREVIEW_RE.test(origin);
}
function corsHeaders(origin, allowedHeaders = "Content-Type") {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": allowedHeaders,
    Vary: "Origin",
  };
}

// ../../netlify/functions/glossary/index.ts
var FIREBASE_ROOT = "https://easyeyes-compiler-default-rtdb.firebaseio.com";
var asString = (v) => String(v ?? "");
function transformRawRows(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0].map((h) => asString(h).trim().toUpperCase());
  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[h] = i;
  });
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = asString(row[colIndex["INPUT PARAMETER"] ?? 0]);
    if (!name || name.includes("__")) continue;
    const type = asString(row[colIndex["TYPE"] ?? 2]);
    const rawCategories = asString(row[colIndex["CATEGORIES"] ?? 6]);
    const rawDefault = row[colIndex["DEFAULT"] ?? 3];
    const normalizedDefault =
      type === "boolean"
        ? asString(rawDefault).trim().toUpperCase()
        : asString(rawDefault);
    const entry = {
      name,
      availability: asString(row[colIndex["NOW"] ?? 1]),
      type,
      default: normalizedDefault,
      explanation: asString(row[colIndex["EXPLANATION"] ?? 4]),
      example: asString(row[colIndex["EXAMPLE"] ?? 5]),
      categories:
        type === "categorical" || type === "multicategorical"
          ? rawCategories.split(",").map((s) => s.trim())
          : [],
    };
    result[encodeFirebaseSegment(name)] = entry;
  }
  return result;
}
function firebaseUrl(path) {
  return `${FIREBASE_ROOT}/${path}.json?auth=${process.env.FIREBASE_DB}`;
}
async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 5e3,
  retries = 1,
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      lastErr = err;
      if (attempt < retries)
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
async function firebaseGet(path) {
  const res = await fetchWithTimeout(firebaseUrl(path));
  if (!res.ok) throw new Error(`Firebase GET ${path} \u2192 ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error(`Firebase GET ${path} returned a non-JSON body`);
  }
}
async function firebaseGetKeys(path) {
  const url = `${firebaseUrl(path)}&shallow=true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok)
    throw new Error(`Firebase GET (shallow) ${path} \u2192 ${res.status}`);
  const data = await res.json();
  return new Set(Object.keys(data ?? {}));
}
async function firebasePut(path, value) {
  const res = await fetchWithTimeout(
    firebaseUrl(path),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
    5e3,
    0,
  );
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  console.log(
    `[glossary] firebasePut ${path} \u2192 ${res.status}`,
    JSON.stringify(body),
  );
  return { ok: res.ok, status: res.status, body };
}
function bumpVersion(current, incomingKeys, existingKeys) {
  const [major, minor] = current.split(".").map(Number);
  const isMajor =
    incomingKeys.size !== existingKeys.size ||
    [...incomingKeys].some((k) => !existingKeys.has(k));
  if (isMajor) return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}
async function getGlossaryData(version) {
  const raw = await firebaseGet(
    `versions/${encodeFirebaseSegment(version)}/glossary`,
  );
  if (!raw) return null;
  const glossary = {};
  for (const [k, v] of Object.entries(raw)) {
    glossary[decodeFirebaseSegment(k)] = v;
  }
  return {
    version,
    glossary,
    glossaryFull: Object.values(glossary),
    superMatchingParams: Object.keys(glossary).filter((k) => k.includes("@")),
  };
}
var JSON_HEADERS = { "Content-Type": "application/json" };
var CACHE = {
  none: "no-store",
  immutable: "public, max-age=31536000, immutable",
  short: "public, max-age=60, stale-while-revalidate=86400",
};
var NETLIFY_VARY = "query, header=Origin";
var GLOSSARY_ALLOWED_HEADERS = "Content-Type, x-glossary-secret";
function withCors(response, origin) {
  return {
    ...response,
    headers: {
      ...(response.headers ?? {}),
      ...corsHeaders(origin, GLOSSARY_ALLOWED_HEADERS),
    },
  };
}
function jsonOk(data, cache = CACHE.none) {
  return {
    statusCode: 200,
    headers: {
      ...JSON_HEADERS,
      "Cache-Control": cache,
      "Netlify-CDN-Cache-Control": cache,
      "Netlify-Vary": NETLIFY_VARY,
    },
    body: JSON.stringify(data),
  };
}
function jsonErr(statusCode, message) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, "Cache-Control": CACHE.none },
    body: JSON.stringify({ error: message }),
  };
}
async function handleGet(event) {
  const params = event.queryStringParameters ?? {};
  console.log(`[glossary] GET params=${JSON.stringify(params)}`);
  if (params.versionOnly !== void 0) {
    const version = await firebaseGet("currentVersion");
    console.log(`[glossary] GET versionOnly currentVersion=${version}`);
    return jsonOk({ version }, CACHE.none);
  }
  const currentVersion = await firebaseGet("currentVersion");
  console.log(`[glossary] GET currentVersion=${currentVersion}`);
  if (params.v !== void 0) {
    const data2 = await getGlossaryData(params.v);
    console.log(
      `[glossary] GET by v=${params.v} found=${!!data2} entries=${
        data2 ? Object.keys(data2.glossary).length : 0
      }`,
    );
    if (!data2) return jsonErr(404, "Version not found");
    return jsonOk(data2, CACHE.immutable);
  }
  if (params.username !== void 0 && params.experiment !== void 0) {
    const encodedUser = encodeFirebaseSegment(params.username);
    const encodedExp = encodeFirebaseSegment(params.experiment);
    const pinned = await firebaseGet(
      `users/${encodedUser}/${encodedExp}/glossaryVersion`,
    );
    const version = pinned ?? currentVersion ?? "1.0";
    console.log(
      `[glossary] GET user=${params.username} exp=${params.experiment} pinned=${pinned} resolvedVersion=${version}`,
    );
    const data2 = await getGlossaryData(version);
    console.log(
      `[glossary] GET data found=${!!data2} entries=${
        data2 ? Object.keys(data2.glossary).length : 0
      }`,
    );
    if (!data2) return jsonErr(404, "Version not found");
    const response = jsonOk(data2, CACHE.none);
    console.log(
      `[glossary] GET responding 200 bodyBytes=${response.body.length}`,
    );
    return response;
  }
  if (!currentVersion) return jsonErr(404, "No current version");
  const data = await getGlossaryData(currentVersion);
  console.log(
    `[glossary] GET fallback currentVersion data found=${!!data} entries=${
      data ? Object.keys(data.glossary).length : 0
    }`,
  );
  if (!data) return jsonErr(404, "Version not found");
  return jsonOk(data, CACHE.short);
}
async function handlePut(event) {
  let parsed;
  try {
    parsed = JSON.parse(event.body ?? "");
  } catch {
    return jsonErr(400, "Invalid JSON");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.username !== "string" ||
    typeof parsed.experimentName !== "string"
  ) {
    return jsonErr(400, "Missing or invalid username or experimentName");
  }
  const { username, experimentName } = parsed;
  const currentVersion = await firebaseGet("currentVersion");
  const encodedUser = encodeFirebaseSegment(username);
  const encodedExp = encodeFirebaseSegment(experimentName);
  await firebasePut(
    `users/${encodedUser}/${encodedExp}/glossaryVersion`,
    currentVersion,
  );
  return jsonOk({ version: currentVersion });
}
async function handlePost(event) {
  const secret = event.headers["x-glossary-secret"];
  if (!secret || secret !== process.env.GLOSSARY_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  let parsed;
  try {
    parsed = JSON.parse(event.body ?? "");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray(parsed.rows)
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid rows" }),
    };
  }
  const rows = parsed.rows;
  const incoming = transformRawRows(rows);
  const currentVersion = await firebaseGet("currentVersion");
  let newVersion;
  if (!currentVersion) {
    newVersion = "1.0";
  } else {
    const existingKeys = await firebaseGetKeys(
      `versions/${encodeFirebaseSegment(currentVersion)}/glossary`,
    );
    const incomingKeys = new Set(Object.keys(incoming));
    newVersion = bumpVersion(currentVersion, incomingKeys, existingKeys);
  }
  const encodedVersion = encodeFirebaseSegment(newVersion);
  console.log(
    `[glossary] writing versions/${encodedVersion}/glossary (${
      Object.keys(incoming).length
    } entries)`,
  );
  const glossaryResult = await firebasePut(
    `versions/${encodedVersion}/glossary`,
    incoming,
  );
  if (!glossaryResult.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "Firebase write failed for glossary",
        firebaseStatus: glossaryResult.status,
        firebaseBody: glossaryResult.body,
      }),
    };
  }
  console.log(`[glossary] writing currentVersion = ${newVersion}`);
  const versionResult = await firebasePut("currentVersion", newVersion);
  if (!versionResult.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "Firebase write failed for currentVersion",
        firebaseStatus: versionResult.status,
        firebaseBody: versionResult.body,
      }),
    };
  }
  return { statusCode: 200, body: JSON.stringify({ version: newVersion }) };
}
async function handler(event) {
  const origin = event.headers["origin"] ?? event.headers["Origin"];
  console.log(
    `[glossary] ${event.httpMethod} origin=${
      origin ?? "<none>"
    } allowed=${isAllowedOrigin(origin)} qs=${JSON.stringify(
      event.queryStringParameters ?? {},
    )}`,
  );
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(origin, GLOSSARY_ALLOWED_HEADERS),
      body: "",
    };
  }
  try {
    if (event.httpMethod === "GET")
      return withCors(await handleGet(event), origin);
    if (event.httpMethod === "PUT")
      return withCors(await handlePut(event), origin);
    return withCors(await handlePost(event), origin);
  } catch (err) {
    console.error(`[glossary] ${event.httpMethod} failed:`, err);
    return withCors(
      jsonErr(503, "Glossary backend temporarily unavailable"),
      origin,
    );
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    handler,
  });
//# sourceMappingURL=index.js.map
