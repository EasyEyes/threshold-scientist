const { buildPayload, buildFetchOptions } = require("../appsScript/glossaryPush");

const SAMPLE_ROWS = [
  ["INPUT PARAMETER", "NOW", "TYPE", "DEFAULT", "EXPLANATION", "EXAMPLE", "CATEGORIES"],
  ["targetKind", "now", "text", "letter", "What to show", "A", ""],
];

// ─── buildPayload ─────────────────────────────────────────────────────────────

describe("buildPayload", () => {
  it("wraps rows in { rows } without transformation", () => {
    const payload = buildPayload(SAMPLE_ROWS);
    expect(payload).toEqual({ rows: SAMPLE_ROWS });
  });

  it("preserves the header row as-is", () => {
    const payload = buildPayload(SAMPLE_ROWS);
    expect(payload.rows[0]).toEqual(SAMPLE_ROWS[0]);
  });

  it("does not mutate the input", () => {
    const copy = SAMPLE_ROWS.map((r) => [...r]);
    buildPayload(SAMPLE_ROWS);
    expect(SAMPLE_ROWS).toEqual(copy);
  });
});

// ─── buildFetchOptions ────────────────────────────────────────────────────────

describe("buildFetchOptions", () => {
  const URL = "https://example.netlify.app/.netlify/functions/glossary";
  const SECRET = "test-secret-abc";
  const PAYLOAD = { rows: SAMPLE_ROWS };

  function makeOptions() {
    return buildFetchOptions(URL, SECRET, PAYLOAD);
  }

  it("uses POST method", () => {
    expect(makeOptions().method).toBe("post");
  });

  it("sets Content-Type to application/json", () => {
    expect(makeOptions().contentType).toBe("application/json");
  });

  it("puts the secret in x-glossary-secret header", () => {
    expect(makeOptions().headers["x-glossary-secret"]).toBe(SECRET);
  });

  it("serializes payload as JSON string", () => {
    expect(makeOptions().payload).toBe(JSON.stringify(PAYLOAD));
  });

  it("sets muteHttpExceptions to true so the caller can inspect status codes", () => {
    expect(makeOptions().muteHttpExceptions).toBe(true);
  });
});
