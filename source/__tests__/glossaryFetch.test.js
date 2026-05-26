import {
  fetchGlossary,
  fetchGlossaryWithBackoff,
  getGlossaryRawText,
} from "../glossaryFetch";

const MOCK_GLOSSARY = { targetKind: { type: "text" } };
const MOCK_GLOSSARY_FULL = { targetKind: { type: "text", explanation: "full" } };
const MOCK_SUPER_MATCHING_PARAMS = ["targetKind"];

// The Netlify function returns JS that assigns window globals, not JSON.
const MOCK_JS_BODY = [
  `window.GLOSSARY = ${JSON.stringify(MOCK_GLOSSARY)};`,
  `window.GLOSSARY_FULL = ${JSON.stringify(MOCK_GLOSSARY_FULL)};`,
  `window.SUPER_MATCHING_PARAMS = ${JSON.stringify(MOCK_SUPER_MATCHING_PARAMS)};`,
].join("\n");

function mockSuccess() {
  return { ok: true, text: async () => MOCK_JS_BODY };
}

function mockFailure(status = 503) {
  return { ok: false, status };
}

beforeEach(() => {
  global.fetch = jest.fn();
  delete window.GLOSSARY;
  delete window.GLOSSARY_FULL;
  delete window.SUPER_MATCHING_PARAMS;
});

// ─── fetchGlossary ────────────────────────────────────────────────────────────

describe("fetchGlossary", () => {
  it("sets all three window globals on 200", async () => {
    global.fetch.mockResolvedValueOnce(mockSuccess());

    await fetchGlossary();

    expect(window.GLOSSARY).toEqual(MOCK_GLOSSARY);
    expect(window.GLOSSARY_FULL).toEqual(MOCK_GLOSSARY_FULL);
    expect(window.SUPER_MATCHING_PARAMS).toEqual(MOCK_SUPER_MATCHING_PARAMS);
  });

  it("returns the raw JS text on 200", async () => {
    global.fetch.mockResolvedValueOnce(mockSuccess());

    const result = await fetchGlossary();

    expect(result).toBe(MOCK_JS_BODY);
  });

  it("throws on non-200 response", async () => {
    global.fetch.mockResolvedValueOnce(mockFailure());

    await expect(fetchGlossary()).rejects.toThrow();
  });
});

// ─── getGlossaryRawText ───────────────────────────────────────────────────────

describe("getGlossaryRawText", () => {
  it("returns the raw text after a successful fetchGlossary", async () => {
    global.fetch.mockResolvedValueOnce(mockSuccess());
    await fetchGlossary();

    expect(getGlossaryRawText()).toBe(MOCK_JS_BODY);
  });
});

// ─── fetchGlossaryWithBackoff ─────────────────────────────────────────────────

describe("fetchGlossaryWithBackoff", () => {
  const noop = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    noop.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves on first success without calling captureError", async () => {
    global.fetch.mockResolvedValueOnce(mockSuccess());

    const result = await fetchGlossaryWithBackoff(noop);

    expect(noop).not.toHaveBeenCalled();
    expect(window.GLOSSARY).toEqual(MOCK_GLOSSARY);
    expect(result).toBe(MOCK_JS_BODY);
  });

  it("retries after one failure and resolves on second attempt", async () => {
    global.fetch
      .mockResolvedValueOnce(mockFailure())
      .mockResolvedValueOnce(mockSuccess());

    const promise = fetchGlossaryWithBackoff(noop);
    await jest.runAllTimersAsync();
    await promise;

    expect(noop).toHaveBeenCalledTimes(1);
    expect(window.GLOSSARY).toEqual(MOCK_GLOSSARY);
  });

  it("calls captureError once per failed attempt", async () => {
    global.fetch
      .mockResolvedValueOnce(mockFailure())
      .mockResolvedValueOnce(mockFailure())
      .mockResolvedValueOnce(mockFailure())
      .mockResolvedValueOnce(mockSuccess());

    const promise = fetchGlossaryWithBackoff(noop);
    await jest.runAllTimersAsync();
    await promise;

    expect(noop).toHaveBeenCalledTimes(3);
  });

  it("never rejects", async () => {
    global.fetch
      .mockResolvedValueOnce(mockFailure())
      .mockResolvedValueOnce(mockSuccess());

    const promise = fetchGlossaryWithBackoff(noop);
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBeDefined();
  });
});
