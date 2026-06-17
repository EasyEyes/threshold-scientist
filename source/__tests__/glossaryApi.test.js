import {
  fetchGlossaryData,
  fetchGlossaryVersion,
  pinGlossaryVersion,
} from "../components/glossaryApi";

jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: () => "",
}));

global.fetch = jest.fn();

const mockGlossaryData = {
  version: "1.0",
  glossary: { _online1Title: { default: "My Study" } },
  glossaryFull: [],
  superMatchingParams: [],
};

describe("glossaryApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchGlossaryData", () => {
    it("calls GET /.netlify/functions/glossary and returns parsed data", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockGlossaryData),
      });

      const result = await fetchGlossaryData();

      expect(global.fetch).toHaveBeenCalledWith("/.netlify/functions/glossary");
      expect(result).toEqual(mockGlossaryData);
    });

    it("fetches an explicit version via ?v= when given", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockGlossaryData),
      });

      await fetchGlossaryData("2.0");

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/glossary?v=2.0",
      );
    });

    it("retries on a failed response and then resolves", async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockGlossaryData),
        });

      const result = await fetchGlossaryData();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockGlossaryData);
    });
  });

  describe("fetchGlossaryVersion", () => {
    it("calls GET /.netlify/functions/glossary?versionOnly=1 and returns { version }", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ version: "2.5" }),
      });

      const result = await fetchGlossaryVersion();

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/glossary?versionOnly=1",
      );
      expect(result).toEqual({ version: "2.5" });
    });
  });

  describe("pinGlossaryVersion", () => {
    it("calls PUT /.netlify/functions/glossary with username and experimentName", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ version: "1.2" }),
      });

      const result = await pinGlossaryVersion("alice", "my-experiment");

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/glossary",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "alice",
            experimentName: "my-experiment",
          }),
        },
      );
      expect(result).toEqual({ version: "1.2" });
    });
  });
});

describe("glossaryApi prefetch singleton", () => {
  const mockData = {
    version: "1.0",
    glossary: {},
    glossaryFull: [],
    superMatchingParams: [],
  };

  let mod;
  let initGlossary;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../../threshold/components/easyeyesBaseUrl", () => ({
      getEasyEyesBaseUrl: () => "",
    }));
    jest.doMock("../../threshold/parameters/glossaryRegistry", () => ({
      initGlossary: jest.fn(),
    }));
    global.fetch = jest.fn();
    mod = require("../components/glossaryApi");
    initGlossary =
      require("../../threshold/parameters/glossaryRegistry").initGlossary;
  });

  it("getGlossaryPrefetch() returns null before startGlossaryPrefetch is called", () => {
    expect(mod.getGlossaryPrefetch()).toBeNull();
  });

  it("getGlossaryPrefetch() returns a Promise while the fetch is pending", () => {
    global.fetch.mockReturnValueOnce(new Promise(() => {}));
    mod.startGlossaryPrefetch();
    expect(mod.getGlossaryPrefetch()).toBeInstanceOf(Promise);
  });

  it("getGlossaryPrefetch() returns null after the fetch resolves successfully", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });
    mod.startGlossaryPrefetch();
    await mod.getGlossaryPrefetch();
    expect(mod.getGlossaryPrefetch()).toBeNull();
  });

  it("getGlossaryPrefetch() returns null after the fetch rejects", async () => {
    jest.useFakeTimers();
    global.fetch.mockRejectedValue(new Error("network error"));
    mod.startGlossaryPrefetch();
    const p = mod.getGlossaryPrefetch();
    await jest.runAllTimersAsync();
    await p.catch(() => {});
    expect(mod.getGlossaryPrefetch()).toBeNull();
    jest.useRealTimers();
  });

  it("calls initGlossary with the fetched data on success", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });
    mod.startGlossaryPrefetch();
    await mod.getGlossaryPrefetch();
    expect(initGlossary).toHaveBeenCalledWith(mockData);
  });

  it("does not call initGlossary when the fetch fails", async () => {
    jest.useFakeTimers();
    global.fetch.mockRejectedValue(new Error("network error"));
    mod.startGlossaryPrefetch();
    const p = mod.getGlossaryPrefetch();
    await jest.runAllTimersAsync();
    await p.catch(() => {});
    expect(initGlossary).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("calling startGlossaryPrefetch a second time does not trigger a second fetch", async () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    mod.startGlossaryPrefetch();
    await Promise.resolve(); // flush microtasks so fetch() is actually called once
    mod.startGlossaryPrefetch();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
