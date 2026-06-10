import React from "react";
import { render, waitFor } from "@testing-library/react";
import App from "../App";

jest.mock("firebase/database", () => ({
  set: jest.fn(),
  ref: jest.fn(),
  get: jest.fn().mockResolvedValue({ val: () => ({ count: 0 }) }),
}));

jest.mock("@firebase/util", () => ({
  uuidv4: jest.fn(() => "test-uuid"),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../Step", () => () => null);
jest.mock("../StatusLines", () => () => null);

jest.mock("../components/steps", () => ({
  allSteps: jest.fn(() => ["login", "table", "upload", "running"]),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getCompatibilityRequirementsForProject: jest.fn(),
  getExperimentStatus: jest.fn(),
  getOriginalFileNameForProject: jest.fn(),
  getRecruitmentServiceConfig: jest.fn(),
  getDurationForProject: jest.fn(),
  getProlificStudyId: jest.fn(),
  User: jest.fn(() => ({})),
  getCommonResourcesNames: jest.fn(),
}));

jest.mock("../../threshold/preprocess/retry", () => ({
  getRetryDelayMs: jest.fn(() => 0),
}));

jest.mock("../../threshold/preprocess/constants", () => ({
  resourcesFileTypes: ["fonts", "images"],
}));

jest.mock("../components/firebase", () => ({
  auth: {},
  db: {},
}));

jest.mock("../components/prolificIntegration", () => ({
  getProlificAccount: jest.fn(),
  getProlificStudySubmissions: jest.fn(),
}));

jest.mock("../../threshold/components/compatibilityCheck", () => ({
  getCompatibilityRequirements: jest.fn(),
}));

jest.mock("../../threshold/preprocess/global", () => ({
  compatibilityRequirements: { t: [] },
}));

jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn().mockResolvedValue({}),
}));

jest.mock("../components/firebase_soundProfile", () => ({
  getSoundProfileStatement: jest.fn(),
}));

jest.mock("../sentry", () => ({
  captureError: jest.fn(),
}));

jest.mock("../components/phrasesApi", () => ({
  fetchPhrasesVersion: jest.fn(),
  fetchPhrasesByVersion: jest.fn(),
}));

jest.mock("../../threshold/parameters/phrasesRegistry", () => ({
  initPhrases: jest.fn(),
}));

global.fetch = jest.fn().mockResolvedValue({ ok: false });

const mockPhrasesData = {
  version: "1.0",
  phrases: { greeting: { en: "Hello", fr: "Bonjour" } },
};

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockResolvedValue({ version: mockPhrasesData.version });
    fetchPhrasesByVersion.mockResolvedValue(mockPhrasesData);
    global.fetch.mockResolvedValue({ ok: false });
  });

  it("checks the latest version, then fetches that specific version and calls initPhrases", async () => {
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
    } = require("../../threshold/parameters/phrasesRegistry");

    render(<App />);

    await waitFor(() => {
      expect(initPhrases).toHaveBeenCalledWith(mockPhrasesData);
    });
    expect(fetchPhrasesVersion).toHaveBeenCalledTimes(1);
    expect(fetchPhrasesByVersion).toHaveBeenCalledWith(mockPhrasesData.version);
  });

  it("renders a phrases error message when the version probe rejects", async () => {
    const { fetchPhrasesVersion } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockRejectedValue(new Error("network error"));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText(/failed to load phrases/i)).toBeInTheDocument();
    });
  });
});
