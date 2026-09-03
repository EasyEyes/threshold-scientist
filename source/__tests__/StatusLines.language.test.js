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
