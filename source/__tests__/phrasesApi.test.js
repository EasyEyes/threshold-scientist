import {
  fetchPhrasesData,
  fetchPhrasesVersion,
  pinPhrasesVersion,
} from "../components/phrasesApi";

jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: () => "",
}));

global.fetch = jest.fn();

const mockPhrasesData = {
  version: "1.0",
  phrases: { greeting: { en: "Hello", fr: "Bonjour" } },
};

describe("phrasesApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchPhrasesData", () => {
    it("calls GET /.netlify/functions/phrases and returns parsed data", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPhrasesData),
      });

      const result = await fetchPhrasesData();

      expect(global.fetch).toHaveBeenCalledWith("/.netlify/functions/phrases");
      expect(result).toEqual(mockPhrasesData);
    });
  });

  describe("fetchPhrasesVersion", () => {
    it("calls GET /.netlify/functions/phrases?versionOnly=1 and returns { version }", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ version: "2.5" }),
      });

      const result = await fetchPhrasesVersion();

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/phrases?versionOnly=1",
      );
      expect(result).toEqual({ version: "2.5" });
    });
  });

  describe("pinPhrasesVersion", () => {
    it("calls PUT /.netlify/functions/phrases with username and experimentName", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ version: "1.2" }),
      });

      const result = await pinPhrasesVersion("alice", "my-experiment");

      expect(global.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/phrases",
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
