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

// ../../netlify/functions/phrases/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler,
});
module.exports = __toCommonJS(index_exports);
var import_zlib = require("zlib");

// ../../netlify/functions/phrases/diffEnglish.ts
function diffEnglish(incomingEnglish, previousVersion, nonCyanValues) {
  if (previousVersion === null) {
    return {
      changed: Object.keys(incomingEnglish),
      removed: [],
      currentVersion: null,
    };
  }
  const prevPhrases = previousVersion.phrases;
  const changed = [];
  const removed = [];
  for (const [key, enText] of Object.entries(incomingEnglish)) {
    if (!(key in prevPhrases) || prevPhrases[key].en !== enText) {
      changed.push(key);
      continue;
    }
    if (nonCyanValues) {
      const otherVals = nonCyanValues[key];
      if (otherVals) {
        const prevRow = prevPhrases[key];
        for (const [lang, val] of Object.entries(otherVals)) {
          if (prevRow[lang] !== val) {
            changed.push(key);
            break;
          }
        }
      }
    }
  }
  for (const key of Object.keys(prevPhrases)) {
    if (!(key in incomingEnglish)) {
      removed.push(key);
    }
  }
  return {
    changed,
    removed,
    currentVersion: previousVersion.version,
  };
}

// ../../netlify/functions/phrases/translateCells.ts
var DEEPL_CODE_MAP = {
  "zh-CN": "ZH-HANS",
  "zh-TW": "ZH-HANT",
  no: "NB",
  "pt-pt": "PT-PT",
};
function deeplBaseUrl(apiKey) {
  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
}
function toDeeplTargetLang(lang) {
  return DEEPL_CODE_MAP[lang] ?? lang.toUpperCase();
}
async function callDeepL(texts, targetLang, apiKey, deeplFetch, sleep) {
  const baseUrl = deeplBaseUrl(apiKey);
  const RETRY_STATUSES = /* @__PURE__ */ new Set([429, 456]);
  for (let attempt = 0; attempt < 3; attempt++) {
    console.log("[deepl] request:", {
      targetLang,
      textCount: texts.length,
      texts,
      attempt,
    });
    const res = await deeplFetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        target_lang: targetLang,
        source_lang: "EN",
      }),
    });
    console.log("[deepl] response status:", res.status);
    if (res.ok) {
      const data = await res.json();
      const results = data.translations.map((t) => t.text);
      console.log("[deepl] translations:", { targetLang, results });
      return results;
    }
    if (RETRY_STATUSES.has(res.status)) {
      console.log("[deepl] retryable status, sleeping:", res.status);
      await sleep(1e3);
      continue;
    }
    console.log("[deepl] non-retryable error, giving up:", res.status);
    return null;
  }
  console.log("[deepl] all attempts exhausted for:", targetLang);
  return null;
}
async function translateForLanguage(lang, jobs, deps, sleep, result) {
  const BATCH_SIZE = 50;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const translations = await callDeepL(
      batch.map((j) => j.engText),
      toDeeplTargetLang(lang),
      deps.deeplApiKey,
      deps.deeplFetch,
      sleep,
    );
    for (let j = 0; j < batch.length; j++) {
      const { key, sentValue } = batch[j];
      result[key][lang] = translations?.[j] ?? sentValue;
    }
  }
}
async function translateGooglePhrase(key, engText, sentValue, deps, result) {
  const res = await deps.googleFetch(
    `https://translation.googleapis.com/language/translate/v2?key=${deps.googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: engText, target: "kn", format: "text" }),
    },
  );
  if (res.ok) {
    const data = await res.json();
    result[key]["kn"] = data.data.translations[0]?.translatedText ?? sentValue;
  } else {
    result[key]["kn"] = sentValue;
  }
}
async function translateCells(changedPhrases, colorMask, sentValues, deps) {
  const result = {};
  const sleep = deps.sleep ?? (() => Promise.resolve());
  for (const [key, engText] of Object.entries(changedPhrases)) {
    result[key] = { en: engText };
  }
  const deeplJobs = /* @__PURE__ */ new Map();
  const googleJobs = [];
  for (const [key, engText] of Object.entries(changedPhrases)) {
    const mask = colorMask[key] ?? {};
    const sent = sentValues[key] ?? {};
    for (const [lang, color] of Object.entries(mask)) {
      if (lang === "en") continue;
      const sentValue = sent[lang] ?? "";
      const isCyan = color.toLowerCase() === "#00ffff";
      if (!isCyan) {
        result[key][lang] = sentValue;
        continue;
      }
      if (lang === "kn") {
        if (deps.googleApiKey) {
          googleJobs.push({ key, engText, sentValue });
        } else {
          result[key][lang] = sentValue;
        }
        continue;
      }
      if (!deeplJobs.has(lang)) deeplJobs.set(lang, []);
      deeplJobs.get(lang).push({ key, engText, sentValue });
    }
  }
  await Promise.all([
    ...[...deeplJobs.entries()].map(([lang, jobs]) =>
      translateForLanguage(lang, jobs, deps, sleep, result),
    ),
    ...googleJobs.map(({ key, engText, sentValue }) =>
      translateGooglePhrase(key, engText, sentValue, deps, result),
    ),
  ]);
  return result;
}

// ../../netlify/functions/phrases/buildNewVersion.ts
function buildNewVersion(prev, translatedCells, removed) {
  if (
    prev !== null &&
    Object.keys(translatedCells).length === 0 &&
    removed.length === 0
  ) {
    return null;
  }
  if (prev === null) {
    return { version: "1.0", phrases: { ...translatedCells } };
  }
  const newPhrases = { ...prev.phrases };
  for (const [key, row] of Object.entries(translatedCells)) {
    newPhrases[key] = { ...newPhrases[key], ...row };
  }
  for (const key of removed) {
    delete newPhrases[key];
  }
  const prevKeys = new Set(Object.keys(prev.phrases));
  const newKeys = new Set(Object.keys(newPhrases));
  const isMajor =
    removed.length > 0 || [...newKeys].some((k) => !prevKeys.has(k));
  const [major, minor] = prev.version.split(".").map(Number);
  const newVersion = isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
  return { version: newVersion, phrases: newPhrases };
}

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

// ../../netlify/functions/phrases/index.ts
var FIREBASE_ROOT = "https://easyeyes-compiler-default-rtdb.firebaseio.com";
var JSON_HEADERS = { "Content-Type": "application/json" };
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
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "(unreadable)");
    return { ok: false, status: res.status, errorBody };
  }
  return { ok: true, status: res.status };
}
function withCors(response, origin) {
  return {
    ...response,
    headers: { ...(response.headers ?? {}), ...corsHeaders(origin) },
  };
}
var CACHE = {
  none: "no-store",
  immutable: "public, max-age=31536000, immutable",
  short: "public, max-age=60, stale-while-revalidate=86400",
};
var NETLIFY_VARY = "query, header=Origin";
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
function jsonOkGzipped(data, cache = CACHE.none) {
  const compressed = (0, import_zlib.gzipSync)(
    Buffer.from(JSON.stringify(data), "utf-8"),
  );
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Cache-Control": cache,
      "Netlify-CDN-Cache-Control": cache,
      "Netlify-Vary": NETLIFY_VARY,
    },
    body: compressed.toString("base64"),
    isBase64Encoded: true,
  };
}
function jsonErr(statusCode, message) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, "Cache-Control": CACHE.none },
    body: JSON.stringify({ error: message }),
  };
}
async function getCurrentVersion() {
  return await firebaseGet("phrases/currentVersion");
}
async function getVersionedPhrases(version) {
  const encoded = encodeFirebaseSegment(version);
  const phrases = await firebaseGet(`phrasesVersions/${encoded}/phrases`);
  if (!phrases) return null;
  return { version, phrases };
}
async function handleGet(event) {
  const params = event.queryStringParameters ?? {};
  if (params.versionOnly !== void 0) {
    const version2 = await getCurrentVersion();
    return jsonOk({ version: version2 }, CACHE.none);
  }
  if (params.v !== void 0) {
    const data2 = await getVersionedPhrases(params.v);
    if (!data2) return jsonErr(404, "Version not found");
    return jsonOkGzipped(data2, CACHE.immutable);
  }
  if (params.pinned !== void 0) {
    const slashIdx = params.pinned.indexOf("/");
    const username = params.pinned.slice(0, slashIdx);
    const experiment = params.pinned.slice(slashIdx + 1);
    const encodedUser = encodeFirebaseSegment(username);
    const encodedExp = encodeFirebaseSegment(experiment);
    const version2 = await firebaseGet(
      `users/${encodedUser}/${encodedExp}/phrasesVersion`,
    );
    if (!version2) return jsonErr(404, "No pinned version");
    return jsonOk({ version: version2 }, CACHE.none);
  }
  const version = await getCurrentVersion();
  if (!version) return jsonErr(404, "No current version");
  const data = await getVersionedPhrases(version);
  if (!data) return jsonErr(404, "Version not found");
  return jsonOkGzipped(data, CACHE.short);
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
  const version = await getCurrentVersion();
  if (!version) return jsonErr(500, "No current version");
  const encodedUser = encodeFirebaseSegment(username);
  const encodedExp = encodeFirebaseSegment(experimentName);
  await firebasePut(
    `users/${encodedUser}/${encodedExp}/phrasesVersion`,
    version,
  );
  return jsonOk({ version });
}
async function handleTranslate(body, skipSizeGuard) {
  const changedPhrases = body.changedPhrases;
  const colorMask = body.colorMask ?? {};
  const sentValues = body.sentValues ?? {};
  const requestVersion = body.currentVersion;
  console.log("[phrases/translate] input:", {
    changedPhrases,
    requestVersion,
    changedCount: changedPhrases ? Object.keys(changedPhrases).length : 0,
    colorMaskKeys: Object.keys(colorMask),
    sentValuesKeys: Object.keys(sentValues),
    skipSizeGuard,
  });
  if (!changedPhrases || typeof changedPhrases !== "object") {
    console.log("[phrases/translate] error: missing changedPhrases");
    return jsonErr(400, "Missing changedPhrases");
  }
  if (!skipSizeGuard && Object.keys(changedPhrases).length > 50) {
    console.log(
      "[phrases/translate] error: too many changed phrases",
      Object.keys(changedPhrases).length,
    );
    return jsonErr(
      400,
      "Too many changed phrases (max 50 per synchronous call)",
    );
  }
  const firebaseVersion = await getCurrentVersion();
  console.log("[phrases/translate] version check:", {
    requestVersion,
    firebaseVersion,
    match: requestVersion === firebaseVersion,
  });
  if (requestVersion !== firebaseVersion) {
    return jsonErr(409, "Version conflict: currentVersion has advanced");
  }
  const prevVersioned = firebaseVersion
    ? await getVersionedPhrases(firebaseVersion)
    : null;
  console.log("[phrases/translate] prevVersioned:", {
    version: prevVersioned?.version ?? null,
    phraseCount: prevVersioned ? Object.keys(prevVersioned.phrases).length : 0,
  });
  const httpFetch = (url, init) => fetch(url, init);
  const deps = {
    deeplFetch: httpFetch,
    googleFetch: httpFetch,
    deeplApiKey: process.env.DEEPL_API_KEY ?? "",
    googleApiKey: process.env.GOOGLE_API_KEY,
  };
  const translatedRows = await translateCells(
    changedPhrases,
    colorMask,
    sentValues,
    deps,
  );
  console.log("[phrases/translate] translatedRows:", translatedRows);
  const newVersioned = buildNewVersion(prevVersioned, translatedRows, []);
  console.log("[phrases/translate] buildNewVersion result:", {
    isNull: newVersioned === null,
    newVersion: newVersioned?.version ?? null,
    newPhraseCount: newVersioned ? Object.keys(newVersioned.phrases).length : 0,
  });
  if (newVersioned === null) {
    console.log(
      "[phrases/translate] no changes detected \u2014 returning existing version without Firebase write",
    );
    return jsonOk({ newVersion: firebaseVersion, translatedRows });
  }
  const FIREBASE_INVALID_KEY = /[.$#[\]/]|[\x00-\x1f\x7f]|^$/;
  const sanitizedPhrases = Object.fromEntries(
    Object.entries(newVersioned.phrases).filter(
      ([k]) => !FIREBASE_INVALID_KEY.test(k),
    ),
  );
  const droppedCount =
    Object.keys(newVersioned.phrases).length -
    Object.keys(sanitizedPhrases).length;
  if (droppedCount > 0) {
    const dropped = Object.keys(newVersioned.phrases).filter((k) =>
      FIREBASE_INVALID_KEY.test(k),
    );
    console.warn(
      "[phrases/translate] dropping invalid Firebase keys:",
      dropped,
    );
  }
  const encodedNewVersion = encodeFirebaseSegment(newVersioned.version);
  const phrasesResult = await firebasePut(
    `phrasesVersions/${encodedNewVersion}/phrases`,
    sanitizedPhrases,
  );
  console.log("[phrases/translate] Firebase PUT phrases:", {
    ok: phrasesResult.ok,
    status: phrasesResult.status,
    errorBody: phrasesResult.errorBody,
  });
  if (!phrasesResult.ok) {
    return jsonErr(
      502,
      `Firebase write failed for phrases (status ${phrasesResult.status}): ${
        phrasesResult.errorBody ?? ""
      }`,
    );
  }
  const versionResult = await firebasePut(
    "phrases/currentVersion",
    newVersioned.version,
  );
  console.log("[phrases/translate] Firebase PUT currentVersion:", {
    ok: versionResult.ok,
    status: versionResult.status,
    errorBody: versionResult.errorBody,
    newVersion: newVersioned.version,
  });
  if (!versionResult.ok) {
    return jsonErr(
      502,
      `Firebase write failed for currentVersion (status ${
        versionResult.status
      }): ${versionResult.errorBody ?? ""}`,
    );
  }
  console.log("[phrases/translate] success:", {
    newVersion: newVersioned.version,
    translatedRowCount: Object.keys(translatedRows).length,
  });
  return jsonOk({ newVersion: newVersioned.version, translatedRows });
}
async function handlePost(event) {
  let parsed;
  try {
    parsed = JSON.parse(event.body ?? "");
  } catch {
    return jsonErr(400, "Invalid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    return jsonErr(400, "Invalid request body");
  }
  const body = parsed;
  console.log("[phrases/POST] action:", body.action);
  if (body.action === "diff") {
    const english = body.english;
    if (!english || typeof english !== "object") {
      return jsonErr(400, "Missing or invalid english field");
    }
    const nonCyanValues = body.nonCyanValues ?? {};
    console.log(
      "[phrases/diff] input english count:",
      Object.keys(english).length,
    );
    const version = await getCurrentVersion();
    const previousVersion = version ? await getVersionedPhrases(version) : null;
    const result = diffEnglish(english, previousVersion, nonCyanValues);
    console.log("[phrases/diff] result:", result);
    return jsonOk(result);
  }
  if (body.action === "translate") {
    return handleTranslate(body, false);
  }
  if (body.action === "fullResync") {
    return handleTranslate(body, true);
  }
  return jsonErr(400, `Unknown action: ${String(body.action)}`);
}
async function handler(event) {
  const origin = event.headers["origin"] ?? event.headers["Origin"];
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }
  if (event.httpMethod === "POST") {
    const expectedSecret = process.env.PHRASES_SECRET;
    const providedSecret =
      event.headers["x-phrases-secret"] ?? event.headers["X-Phrases-Secret"];
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return withCors(jsonErr(401, "Unauthorized"), origin);
    }
  }
  try {
    if (event.httpMethod === "GET")
      return withCors(await handleGet(event), origin);
    if (event.httpMethod === "PUT")
      return withCors(await handlePut(event), origin);
    if (event.httpMethod === "POST")
      return withCors(await handlePost(event), origin);
    return jsonErr(405, "Method not allowed");
  } catch (err) {
    console.error(`[phrases] ${event.httpMethod} failed:`, err);
    return withCors(
      jsonErr(503, "Phrases backend temporarily unavailable"),
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
