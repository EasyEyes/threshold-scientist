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
jest.mock("../Glossary", () => ({ default: () => null }));
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

jest.mock("../components/glossaryApi", () => ({
  fetchGlossaryData: jest.fn(),
}));

jest.mock("../../threshold/parameters/glossaryRegistry", () => ({
  initGlossary: jest.fn(),
}));

jest.mock("../components/phrasesApi", () => ({
  fetchPhrasesData: jest.fn(),
}));

jest.mock("../../threshold/parameters/phrasesRegistry", () => ({
  initPhrases: jest.fn(),
}));

global.fetch = jest.fn().mockResolvedValue({ ok: false });

const mockGlossaryData = {
  version: "1.0",
  glossary: { param1: { name: "param1" } },
  glossaryFull: [],
  superMatchingParams: ["param1"],
};

const mockPhrasesData = {
  version: "1.0",
  phrases: { greeting: { en: "Hello", fr: "Bonjour" } },
};

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { fetchGlossaryData } = require("../components/glossaryApi");
    fetchGlossaryData.mockResolvedValue(mockGlossaryData);
    const { fetchPhrasesData } = require("../components/phrasesApi");
    fetchPhrasesData.mockResolvedValue(mockPhrasesData);
    global.fetch.mockResolvedValue({ ok: false });
  });

  it("calls initGlossary with fetched glossary data when fetchGlossaryData resolves", async () => {
    const { initGlossary } = require("../../threshold/parameters/glossaryRegistry");

    render(<App />);

    await waitFor(() => {
      expect(initGlossary).toHaveBeenCalledWith(mockGlossaryData);
    });
  });

  it("calls initPhrases with fetched phrases data when fetchPhrasesData resolves", async () => {
    const { initPhrases } = require("../../threshold/parameters/phrasesRegistry");

    render(<App />);

    await waitFor(() => {
      expect(initPhrases).toHaveBeenCalledWith(mockPhrasesData);
    });
  });

  it("renders a phrases error message when fetchPhrasesData rejects", async () => {
    const { fetchPhrasesData } = require("../components/phrasesApi");
    fetchPhrasesData.mockRejectedValue(new Error("network error"));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(
        getByText(/failed to load phrases/i),
      ).toBeInTheDocument();
    });
  });
});
