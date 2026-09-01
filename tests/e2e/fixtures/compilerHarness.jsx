import React from "react";
import { createRoot } from "react-dom/client";
import Running from "../../../source/Running";

const studyConfig = (title, url) => ({
  titleOfStudy: title,
  descriptionOfStudy: `${title} description`,
  _online1InternalName: title,
  experimentUrl: url,
  _participantsHowMany: 20,
  _participantDurationMinutes: 15,
  _online2Pay: 2,
  _online2PayPerHour: 8,
  _prolific2CompletionPath: "approveAndPay",
  prolificWorkspaceProjectId: "workspace-e2e",
});

const studies = {
  newlyCompiled: {
    id: "newlyCompiled",
    name: "Newly compiled study",
    runnable: true,
    previous: false,
    config: studyConfig("Newly compiled study", "https://run.invalid/new"),
    files: {
      ".easyeyes/prolific-study-config.json": JSON.stringify(
        studyConfig("Newly compiled study", "https://run.invalid/new"),
      ),
    },
  },
  existing: {
    id: "existing",
    name: "Study with existing ID",
    runnable: true,
    previous: true,
    config: studyConfig("Existing study", "https://run.invalid/existing"),
    files: { "ProlificStudyId.txt": "existing-123" },
  },
  missing: {
    id: "missing",
    name: "Study without ID",
    runnable: true,
    previous: true,
    config: studyConfig("Selected study B", "https://run.invalid/study-b"),
    files: {},
  },
  legacy: {
    id: "legacy",
    name: "Legacy study",
    runnable: true,
    previous: true,
    config: null,
    files: {},
  },
  unavailable: {
    id: "unavailable",
    name: "Unavailable study",
    runnable: false,
    previous: true,
    config: null,
    files: {},
  },
};

window.__EASYEYES_E2E__ = {
  repositories: Object.fromEntries(
    Object.values(studies).map((study) => [
      study.id,
      { files: { ...study.files }, commits: [] },
    ]),
  ),
};

class RunningFixture extends Running {
  componentDidMount() {}
  componentDidUpdate(prevProps) {
    if (this.props.activeExperiment !== prevProps.activeExperiment) {
      this.setState({
        completionCode: undefined,
        prolificStudyState: "idle",
        preparedProlificStudyId: null,
        pavloviaIsReady: this.props.experimentStatus === "RUNNING",
      });
    }
  }
}

const noOp = () => {};
const functions = {
  handleSetActivateExperiment: noOp,
  handleUpdateUser: noOp,
  getProlificStudySubmissionDetails: noOp,
};

function CompilerHarness() {
  const [selectedId, setSelectedId] = React.useState("newlyCompiled");
  const study = studies[selectedId];
  const user = React.useMemo(
    () => ({
      username: "e2e-scientist",
      currentExperiment: studyConfig(
        "Unrelated current study",
        "https://run.invalid/unrelated",
      ),
    }),
    [],
  );

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", fontFamily: "Arial" }}>
      <h1>EasyEyes Compiler</h1>
      <label htmlFor="study-picker">Selected compiled study</label>{" "}
      <select
        id="study-picker"
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {Object.values(studies).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <section data-testid="running-actions" style={{ marginTop: 24 }}>
        <RunningFixture
          key={study.id}
          user={user}
          activeExperiment={{ id: study.id, name: study.name }}
          projectName={study.name}
          prolificToken="e2e-prolific-token"
          currentProlificConfig={study.config}
          experimentStatus={study.runnable ? "RUNNING" : "INACTIVE"}
          viewingPreviousExperiment={study.previous}
          previousExperimentViewed={{
            previousExperimentStatus: study.runnable ? "RUNNING" : "INACTIVE",
            previousRecruitmentInformation: { recruitmentServiceName: null },
            previousProlificConfig: study.config,
          }}
          functions={functions}
          compileWarnings={[]}
          scrollToCurrentStep={noOp}
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<CompilerHarness />);
