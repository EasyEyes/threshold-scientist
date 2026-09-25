jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  createOrUpdateProlificToken: jest.fn(),
  DEFAULT_EXPERIMENT_LANGUAGE: "en",
}));

jest.mock("../../threshold/preprocess/global", () => ({
  compatibilityRequirements: { t: "" },
}));

jest.mock("../../threshold/preprocess/getDuration", () => ({
  durations: { durationForStatusline: "EasyEyes=5, _online2Minutes=6" },
}));

jest.mock("../components/ExperimentNeeds", () => ({
  displayExperimentNeedsPopup: jest.fn(),
}));

jest.mock("../repositoryState", () => ({
  isEmptyRepository: jest.fn(() => false),
}));

import React from "react";
import StatusLines from "../StatusLines";
import { render, screen } from "@testing-library/react";

const previousExperimentViewed = {
  originalFileName: "study.csv",
  previousExperimentStatus: "RUNNING",
  previousCompatibilityRequirements: "",
  previousExperimentDuration: "EasyEyes=5, _online2Minutes=6",
  previousExperimentLanguage: null,
  previousExperimentPhrasesColumnName: null,
  previousRecruitmentInformation: {},
};

const baseProps = {
  activeExperiment: "new",
  previousExperimentViewed,
  user: {
    name: "Ada",
    username: "ada",
    avatar_url: "",
    currentExperiment: { _language: "ar" },
  },
  prolificToken: null,
  prolificAccount: null,
  filename: "study.csv",
  projectName: "study",
  experimentStatus: "RUNNING",
  functions: {
    getprofileStatement: jest.fn(),
    getProlificStudySubmissionDetails: jest.fn(),
  },
  prolificStudyStatus: "",
  profileStatement: "",
  newRepo: { name: "study" },
  completedSteps: [],
};

describe("StatusLines _language", () => {
  it("shows the spreadsheet _language for the study just compiled", () => {
    render(<StatusLines {...baseProps} />);

    expect(screen.getByText("_language:")).toBeInTheDocument();
    expect(screen.getByText("ar")).toBeInTheDocument();
  });

  it("shows the glossary default when _language was not assigned", () => {
    render(
      <StatusLines
        {...baseProps}
        user={{
          ...baseProps.user,
          currentExperiment: {},
        }}
      />,
    );

    expect(screen.getByText("_language:")).toBeInTheDocument();
    expect(screen.getByText("en")).toBeInTheDocument();
  });

  it("displays whatever string is stored, including codes longer than two letters", () => {
    render(
      <StatusLines
        {...baseProps}
        activeExperiment={{ id: 7, name: "old-study" }}
        previousExperimentViewed={{
          ...previousExperimentViewed,
          previousExperimentLanguage: "zh-Hans",
        }}
      />,
    );

    expect(screen.getByText("_language:")).toBeInTheDocument();
    expect(screen.getByText("zh-Hans")).toBeInTheDocument();
    expect(screen.queryByText("ar")).not.toBeInTheDocument();
  });
});

describe("StatusLines _phrasesColumnName", () => {
  it("is hidden when the spreadsheet did not assign _phrasesColumnName", () => {
    render(<StatusLines {...baseProps} />);

    expect(screen.queryByText("_phrasesColumnName:")).not.toBeInTheDocument();
  });

  it("is hidden when _phrasesColumnName is blank", () => {
    render(
      <StatusLines
        {...baseProps}
        user={{
          ...baseProps.user,
          currentExperiment: { _language: "ar", _phrasesColumnName: "  " },
        }}
      />,
    );

    expect(screen.queryByText("_phrasesColumnName:")).not.toBeInTheDocument();
  });

  it("shows _phrasesColumnName right below _language for the study just compiled", () => {
    render(
      <StatusLines
        {...baseProps}
        user={{
          ...baseProps.user,
          currentExperiment: { _language: "ar", _phrasesColumnName: "A'" },
        }}
      />,
    );

    const languageTitle = screen.getByText("_language:");
    const phrasesTitle = screen.getByText("_phrasesColumnName:");
    expect(phrasesTitle).toBeInTheDocument();
    expect(screen.getByText("A'")).toBeInTheDocument();

    const languageLine = languageTitle.closest("li");
    const phrasesLine = phrasesTitle.closest("li");
    expect(languageLine.nextElementSibling).toBe(phrasesLine);
  });

  it("shows the _phrasesColumnName stored with a previously compiled study", () => {
    render(
      <StatusLines
        {...baseProps}
        activeExperiment={{ id: 7, name: "old-study" }}
        previousExperimentViewed={{
          ...previousExperimentViewed,
          previousExperimentLanguage: "it",
          previousExperimentPhrasesColumnName: "Italian_v2",
        }}
      />,
    );

    expect(screen.getByText("_phrasesColumnName:")).toBeInTheDocument();
    expect(screen.getByText("Italian_v2")).toBeInTheDocument();
  });
});
