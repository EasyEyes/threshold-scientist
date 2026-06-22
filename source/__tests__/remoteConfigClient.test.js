describe("remoteConfigClient", () => {
  let getTranslationConfig;
  let mockFetchAndActivate;
  let mockGetValue;
  let mockGetRemoteConfig;
  const mockApp = { name: "mock-app" };
  const mockRemoteConfig = {};

  beforeEach(() => {
    jest.resetModules();

    mockFetchAndActivate = jest.fn().mockResolvedValue(true);
    mockGetValue = jest.fn();
    mockGetRemoteConfig = jest.fn().mockReturnValue(mockRemoteConfig);

    jest.doMock("../components/firebase", () => ({ app: mockApp }));
    jest.doMock("firebase/remote-config", () => ({
      getRemoteConfig: mockGetRemoteConfig,
      fetchAndActivate: mockFetchAndActivate,
      getValue: mockGetValue,
    }));

    ({ getTranslationConfig } = require("../remoteConfigClient"));
  });

  it("returns parsed supportedLanguages and translationKeys from Remote Config", async () => {
    const languages = [{ code: "DE", label: "German" }];
    const keys = ["targetLanguage"];

    mockGetValue
      .mockReturnValueOnce({ asString: () => JSON.stringify(languages) })
      .mockReturnValueOnce({ asString: () => JSON.stringify(keys) });

    const result = await getTranslationConfig();

    expect(result).toEqual({
      supportedLanguages: languages,
      translationKeys: keys,
    });
  });

  it("initialises Remote Config with the app instance from firebase", async () => {
    mockGetValue.mockReturnValue({ asString: () => "[]" });

    await getTranslationConfig();

    expect(mockGetRemoteConfig).toHaveBeenCalledWith(mockApp);
  });

  it("caches the result — fetchAndActivate is called only once across multiple calls", async () => {
    mockGetValue.mockReturnValue({ asString: () => "[]" });

    await getTranslationConfig();
    await getTranslationConfig();

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1);
  });

  it("returns empty arrays when Remote Config is unreachable", async () => {
    mockFetchAndActivate.mockRejectedValue(new Error("Network error"));

    const result = await getTranslationConfig();

    expect(result).toEqual({ supportedLanguages: [], translationKeys: [] });
  });
});
