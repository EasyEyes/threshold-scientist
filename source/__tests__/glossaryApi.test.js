import { fetchGlossaryData, fetchGlossaryVersion, pinGlossaryVersion } from "../components/glossaryApi";

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
  });

  describe("fetchGlossaryVersion", () => {
    it("calls GET /.netlify/functions/glossary?versionOnly=1 and returns { version }", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ version: "2.5" }),
      });

      const result = await fetchGlossaryVersion();

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/glossary?versionOnly=1"
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

      expect(global.fetch).toHaveBeenCalledWith("/.netlify/functions/glossary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", experimentName: "my-experiment" }),
      });
      expect(result).toEqual({ version: "1.2" });
    });
  });
});
