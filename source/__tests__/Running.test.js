jest.mock("firebase/database", () => ({
  get: jest.fn(),
  ref: jest.fn(),
}));

jest.mock("../components/firebase", () => ({ db: {} }));
jest.mock("../sentry", () => ({ captureError: jest.fn() }));

jest.mock("../components/prolificIntegration", () => ({
  prolificCreateDraft: jest.fn(),
  downloadDemographicData: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  createProlificStudyIdFile: jest.fn(),
  downloadCommonResources: jest.fn(),
  downloadDataFolder: jest.fn(),
  generateAndUploadCompletionURL: jest.fn(),
  getAllProjects: jest.fn(),
  getDataFolderCsvLength: jest.fn(),
  getExperimentStatus: jest.fn(),
  getPavloviaNeedsCredit: jest.fn(),
  getProlificStudyId: jest.fn(),
  runExperiment: jest.fn(),
}));

jest.mock("../../threshold/parameters/glossaryRegistry", () => ({
  getGlossary: jest.fn(() => ({})),
}));

// Row map for the glossary-link mock below. name → row.
const mockGlossaryRows = {};
const mockGlossaryUrl = (name) =>
  name in mockGlossaryRows
    ? `https://example.test/glossary&range=A${mockGlossaryRows[name]}`
    : null;

jest.mock("../../threshold/parameters/glossaryLink", () => ({
  glossaryParameterUrl: (name) => mockGlossaryUrl(name),
  linkGlossaryParameters: (html) =>
    html.replace(
      /<span class="alert-parameter">([^<]+)<\/span>/g,
      (span, name) => {
        const href = mockGlossaryUrl(name);
        return href
          ? `<a class="alert-parameter-link" href="${href}" target="_blank" rel="noopener noreferrer">${span}</a>`
          : span;
      },
    ),
}));

import Running from "../Running";
import Swal from "sweetalert2";
import { render, screen } from "@testing-library/react";
import { prolificCreateDraft } from "../components/prolificIntegration";
import {
  createProlificStudyIdFile,
  generateAndUploadCompletionURL,
  getAllProjects,
  getDataFolderCsvLength,
  getPavloviaNeedsCredit,
  getProlificStudyId,
  runExperiment,
} from "../../threshold/preprocess/gitlabUtils";
import { beginCompile } from "../../threshold/preprocess/compileMode";
import { showFastCompileProgress } from "../studio/fastCompileProgress";

describe("Pavlovia activation", () => {
  it.each(["compiler", "studio"])(
    "records a credit rejection after a %s activation, with no dialog left open",
    async (source) => {
      beginCompile(source);
      getAllProjects.mockResolvedValue([]);
      runExperiment.mockResolvedValue({
        activationFailure: "insufficient-credits",
      });
      const running = new Running({
        activeExperiment: { id: 42, name: "compiled-study" },
        user: { currentExperiment: { experimentUrl: "https://example.test" } },
        functions: { handleSetProjectList: jest.fn() },
      });
      const setState = jest
        .spyOn(running, "setState")
        .mockImplementation(() => {});
      const waitForReady = jest.spyOn(running, "waitForPavloviaReady");

      if (source === "studio") showFastCompileProgress("compile");
      try {
        await running.setModeToRun();
        expect(setState).toHaveBeenCalledWith({ needsPavloviaCredit: true });
        expect(waitForReady).not.toHaveBeenCalled();
        expect(Swal.isVisible()).toBe(false);
        expect(running._isActivating).toBe(false);
      } finally {
        Swal.close();
      }
    },
  );

  it("treats a RUNNING study without license or credit as needing credit, without waiting for Pavlovia", async () => {
    getAllProjects.mockResolvedValue([]);
    runExperiment.mockResolvedValue({ newStatus: "RUNNING" });
    getPavloviaNeedsCredit.mockResolvedValue(true);
    const running = new Running({
      activeExperiment: { id: 42, name: "compiled-study" },
      user: { currentExperiment: { experimentUrl: "https://example.test" } },
      functions: { handleSetProjectList: jest.fn() },
    });
    const setState = jest
      .spyOn(running, "setState")
      .mockImplementation(() => {});
    const waitForReady = jest.spyOn(running, "waitForPavloviaReady");
    try {
      await running.setModeToRun();
      expect(setState).toHaveBeenLastCalledWith({ needsPavloviaCredit: true });
      expect(waitForReady).not.toHaveBeenCalled();
    } finally {
      Swal.close();
    }
  });

  it("explains the missing credit for a RUNNING study too", () => {
    const running = new Running({
      user: {
        username: "scientist",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "ColorRsvp12" },
      projectName: "ColorRsvp12",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: true,
      previousExperimentViewed: { previousExperimentStatus: "RUNNING" },
      functions: { handleSetActivateExperiment: jest.fn() },
    });
    running.state.needsPavloviaCredit = true;
    const { container } = render(running.render());
    expect(container.querySelector(".green-status-banner")).toHaveTextContent(
      "needs Pavlovia participant-testing credits",
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("explains the missing credit and strikes through Run and Create Prolific study", () => {
    const running = new Running({
      user: {
        username: "scientist",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "ColorRsvp12" },
      projectName: "ColorRsvp12",
      experimentStatus: "INACTIVE",
      viewingPreviousExperiment: false,
      previousExperimentViewed: { previousExperimentStatus: "INACTIVE" },
      functions: { handleSetActivateExperiment: jest.fn() },
    });
    running.state.needsPavloviaCredit = true;
    const { container } = render(running.render());

    const banner = container.querySelector(".green-status-banner");
    expect(banner).toHaveTextContent(
      "Study compiled successfully, but needs Pavlovia participant-testing credits to run.",
    );
    expect(banner).toHaveTextContent("Use an institutional license.");
    expect(banner).toHaveTextContent("Buy and assign credits.");
    expect(banner).toHaveTextContent("Test in Pilot mode.");
    expect(
      screen.getByRole("link", { name: "study dashboard" }),
    ).toHaveAttribute("href", "https://pavlovia.org/scientist/ColorRsvp12");
    for (const name of ["Run", "Create Prolific study to run online"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveClass("button-green", "button-needs-credit");
    }
  });
});

describe("Running compile warnings", () => {
  const baseProps = {
    user: {
      username: "scientist",
      currentExperiment: {},
      projectList: Promise.resolve([]),
    },
    activeExperiment: { id: 42, name: "compiled-study" },
    projectName: "compiled-study",
    experimentStatus: "RUNNING",
    viewingPreviousExperiment: false,
    previousExperimentViewed: {
      previousExperimentStatus: "RUNNING",
      previousRecruitmentInformation: null,
      previousProlificConfig: null,
    },
    functions: {
      handleSetActivateExperiment: jest.fn(),
    },
  };

  it("keeps phrase warnings below all study controls and clears them on the next result", () => {
    const warning = {
      context: "preprocessor",
      kind: "warning",
      name: "Warning: 1 missing phrase",
      message:
        "This study’s source references 1 key that is not defined in International Phrases:<br>EE_exampleMissingPhrase",
      hint: "Can I run the study? Yes, if the missing phrases are not essential.<br><br>Report the problem. Please select “Report bug” at the top of this page to notify the developers.",
      parameters: [],
    };
    const renderResult = (warnings) =>
      new Running({ ...baseProps, compileWarnings: warnings }).render();
    const { container, rerender } = render(renderResult([warning]));
    const warnings = container.querySelector(".alert-list");
    for (const button of screen.getAllByRole("button")) {
      // The dismiss x lives inside the warnings box itself; every study
      // control must still precede the box.
      if (warnings.contains(button)) continue;
      expect(
        button.compareDocumentPosition(warnings) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(container.querySelector(".alert-message")).toHaveTextContent(
      "EE_exampleMissingPhrase",
    );
    expect(container.querySelector(".alert-hint")).toHaveTextContent(
      "Report bug",
    );
    expect(container.querySelector(".alert-name")).toHaveTextContent(
      "⚠️ Warning: 1 missing phrase",
    );
    rerender(renderResult([]));
    expect(container.querySelector(".alert-list")).toBeNull();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("shows each parameter once even when the warning lists it twice", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      user: {
        username: "s",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "e" },
      projectName: "e",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: false,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: null,
        previousProlificConfig: null,
      },
      functions: { handleSetActivateExperiment: jest.fn() },
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font", "font"],
        },
      ],
    });
    const { container } = render(running.render());
    const row = container.querySelector(".alert-parameters");
    expect(row.textContent).toBe("font");
    expect(row.querySelectorAll("a")).toHaveLength(1);
  });

  it("places the parameter line first in the warning box", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      user: {
        username: "s",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "e" },
      projectName: "e",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: false,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: null,
        previousProlificConfig: null,
      },
      functions: { handleSetActivateExperiment: jest.fn() },
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font"],
          message: "M",
          hint: "H",
        },
      ],
    });
    const { container } = render(running.render());
    const item = container.querySelector(".alert-card-warning");
    expect(item.firstElementChild.classList.contains("alert-parameters")).toBe(
      true,
    );
  });

  it("labels and links the parameters of each warning", () => {
    mockGlossaryRows.font = 288;
    const running = new Running({
      ...baseProps,
      compileWarnings: [
        {
          context: "preprocessor",
          kind: "warning",
          name: "W",
          parameters: ["font"],
          message: 'Set <span class="alert-parameter">font</span> to taste.',
        },
      ],
    });
    const { container } = render(running.render());

    const row = container.querySelector(".alert-parameters");
    expect(row.textContent).toBe("font");
    const links = [...row.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(links[0].href).toContain("range=A288");
    expect(links[0].target).toBe("_blank");

    const messageLink = container.querySelector(".alert-message a");
    expect(messageLink).not.toBeNull();
    expect(messageLink.href).toContain("range=A288");
  });
});

describe("Running Prolific study creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Swal, "fire").mockResolvedValue({ isConfirmed: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows Run and Create Prolific study for a runnable previous study without recruitment metadata", () => {
    const running = new Running({
      user: {
        username: "scientist",
        currentExperiment: {},
        projectList: Promise.resolve([]),
      },
      activeExperiment: { id: 42, name: "compiled-study" },
      projectName: "compiled-study",
      prolificToken: "token",
      experimentStatus: "RUNNING",
      viewingPreviousExperiment: true,
      previousExperimentViewed: {
        previousExperimentStatus: "RUNNING",
        previousRecruitmentInformation: {
          recruitmentServiceName: null,
        },
        previousProlificConfig: null,
      },
      functions: {
        handleSetActivateExperiment: jest.fn(),
      },
      compileWarnings: [],
    });
    running.state.pavloviaIsReady = true;

    render(running.render());

    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Pavlovia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Create Prolific study to run online",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Prolific" }),
    ).toBeInTheDocument();
  });

  it("opens a newly created Prolific study after the first click", async () => {
    const user = { currentExperiment: {} };
    const activeExperiment = { id: 42 };
    const running = new Running({
      user,
      activeExperiment,
      projectName: "Contrast sensitivity",
      prolificToken: "token",
      currentProlificConfig: {},
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };

    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({
      id: "study-123",
      status: "UNPUBLISHED",
    });
    createProlificStudyIdFile.mockResolvedValue(undefined);
    const studyWindow = {
      focus: jest.fn(),
      location: { replace: jest.fn() },
    };
    window.open = jest.fn(() => studyWindow);

    await running.createOrOpenProlificStudy();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(studyWindow.location.replace).toHaveBeenCalledWith(
      "https://app.prolific.com/researcher/workspaces/studies/study-123",
    );
    expect(running.state).toMatchObject({
      prolificStudyState: "ready",
      preparedProlificStudyId: "study-123",
    });
  });

  it("creates a draft from the selected previous study's persisted config", async () => {
    const selectedConfig = {
      titleOfStudy: "Selected study",
      experimentUrl: "https://run.example/selected-study",
    };
    const user = {
      currentExperiment: { titleOfStudy: "Different current study" },
    };
    const activeExperiment = { id: 42 };
    const running = new Running({
      user,
      activeExperiment,
      projectName: "Selected study",
      prolificToken: "token",
      viewingPreviousExperiment: true,
      previousExperimentViewed: {
        previousProlificConfig: selectedConfig,
      },
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };

    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({
      id: "study-123",
      status: "UNPUBLISHED",
    });
    window.open = jest.fn(() => ({
      focus: jest.fn(),
      location: { replace: jest.fn() },
    }));

    await running.createOrOpenProlificStudy();

    expect(prolificCreateDraft).toHaveBeenCalledWith(
      selectedConfig,
      "Selected study",
      "complete",
      "incompatible",
      "aborted",
      "token",
    );
  });

  it("opens an existing study without creating a duplicate draft", async () => {
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 42 },
      functions: {},
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getProlificStudyId.mockResolvedValue("existing-study");
    window.open = jest.fn(() => ({
      focus: jest.fn(),
      location: { replace: jest.fn() },
    }));

    await running.createOrOpenProlificStudy();

    expect(prolificCreateDraft).not.toHaveBeenCalled();
    expect(createProlificStudyIdFile).not.toHaveBeenCalled();
    expect(running.state.prolificStudyState).toBe("ready");
  });

  it("returns to idle without persisting an invalid draft response", async () => {
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 42 },
      projectName: "Study",
      prolificToken: "token",
      currentProlificConfig: {},
      viewingPreviousExperiment: false,
      functions: { handleUpdateUser: jest.fn() },
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    });
    prolificCreateDraft.mockResolvedValue({ status: "ACTIVE" });
    window.open = jest.fn(() => ({ close: jest.fn() }));

    await running.createOrOpenProlificStudy();

    expect(createProlificStudyIdFile).not.toHaveBeenCalled();
    expect(running.state.prolificStudyState).toBe("idle");
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fatal error: Prolific study creation failed",
        text: expect.stringContaining(
          "did not confirm a valid unpublished study",
        ),
      }),
    );
    expect(Swal.fire.mock.calls[0][0]).not.toHaveProperty("icon");
  });

  it.each(["draft", "Pavlovia completion codes", "missing settings"])(
    "shows an icon-free fatal error for %s failures",
    async (stage) => {
      const message =
        stage === "draft"
          ? "Prolific rejected _prolific3CustomBlockList in your spreadsheet. Filter custom_blocklist requires unique values."
          : "Pavlovia rejected the completion-code upload: permission denied.";
      const running = new Running({
        user: {},
        activeExperiment: { id: 42 },
        projectName: "Study",
        currentProlificConfig: stage === "missing settings" ? null : {},
        functions: { handleUpdateUser: jest.fn() },
      });
      running.setState = (update) => {
        running.state = { ...running.state, ...update };
      };
      getProlificStudyId.mockResolvedValue(null);
      generateAndUploadCompletionURL.mockResolvedValue({ code: "complete" });
      prolificCreateDraft.mockRejectedValue(new Error(message));
      if (stage === "Pavlovia completion codes")
        generateAndUploadCompletionURL.mockRejectedValue(new Error(message));
      const popup = { close: jest.fn() };
      window.open = jest.fn(() => popup);

      await expect(
        running.createOrOpenProlificStudy(),
      ).resolves.toBeUndefined();

      expect(popup.close).toHaveBeenCalledTimes(1);
      expect(running.state.prolificStudyState).toBe("idle");
      expect(createProlificStudyIdFile).not.toHaveBeenCalled();
      const options = Swal.fire.mock.calls[0][0];
      expect(options.title).toContain("Fatal error");
      expect(options.text).toContain(
        stage === "missing settings"
          ? "Prolific study settings unavailable"
          : message,
      );
      expect(options).not.toHaveProperty("icon");
      expect(options).not.toHaveProperty("html");
    },
  );

  it("keeps completion codes intact when retrying after a rejected draft", async () => {
    const running = new Running({
      user: {},
      activeExperiment: { id: 42 },
      currentProlificConfig: {},
      functions: {},
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    const codes = {
      code: "complete",
      incompatibleCompletionCode: "incompatible",
      abortedCompletionCode: "aborted",
    };
    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue(codes);
    prolificCreateDraft
      .mockRejectedValueOnce(new Error("Duplicate IDs"))
      .mockResolvedValueOnce({ id: "study-123", status: "UNPUBLISHED" });
    createProlificStudyIdFile.mockResolvedValue(undefined);
    window.open = jest.fn(() => ({
      close: jest.fn(),
      focus: jest.fn(),
      location: { replace: jest.fn() },
    }));

    await running.createOrOpenProlificStudy();
    await running.createOrOpenProlificStudy();

    expect(generateAndUploadCompletionURL).toHaveBeenCalledTimes(1);
    expect(prolificCreateDraft.mock.calls[1].slice(2, 5)).toEqual([
      "complete",
      "incompatible",
      "aborted",
    ]);
    expect(running.state.prolificStudyState).toBe("ready");
  });

  it("reports a Pavlovia save failure after creation without creating another draft on retry", async () => {
    const running = new Running({
      user: {},
      activeExperiment: { id: 42 },
      currentProlificConfig: {},
      functions: {},
    });
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getProlificStudyId.mockResolvedValue(null);
    generateAndUploadCompletionURL.mockResolvedValue({ code: "complete" });
    prolificCreateDraft.mockResolvedValue({
      id: "created-123",
      status: "UNPUBLISHED",
    });
    createProlificStudyIdFile.mockRejectedValue(
      new Error("Pavlovia save failed"),
    );
    window.open = jest.fn(() => ({ close: jest.fn(), focus: jest.fn() }));

    await running.createOrOpenProlificStudy();
    expect(Swal.fire.mock.calls[0][0].text).toContain(
      "Prolific created study created-123",
    );
    expect(Swal.fire.mock.calls[0][0].text).toContain("Pavlovia save failed");
    await running.createOrOpenProlificStudy();
    expect(prolificCreateDraft).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenLastCalledWith(
      "https://app.prolific.com/researcher/workspaces/studies/created-123",
      "_blank",
    );
  });

  it("clears prepared IDs and completion codes when switching studies", async () => {
    const previousExperiment = { id: 1 };
    const running = new Running({
      user: { currentExperiment: {} },
      activeExperiment: { id: 2 },
      viewingPreviousExperiment: true,
      previousExperimentViewed: { previousExperimentStatus: "RUNNING" },
    });
    running.state.completionCode = { code: "prior-code" };
    running.state.preparedProlificStudyId = "prior-study";
    running.setState = (update) => {
      running.state = { ...running.state, ...update };
    };
    getDataFolderCsvLength.mockResolvedValue([0, false]);

    await running.componentDidUpdate({ activeExperiment: previousExperiment });

    expect(running.state.completionCode).toBeUndefined();
    expect(running.state.preparedProlificStudyId).toBeNull();
  });
});

describe("Running warning dismissal", () => {
  const baseProps = {
    user: {
      username: "scientist",
      currentExperiment: {},
      projectList: Promise.resolve([]),
    },
    activeExperiment: { id: 42, name: "compiled-study" },
    projectName: "compiled-study",
    experimentStatus: "RUNNING",
    viewingPreviousExperiment: false,
    previousExperimentViewed: {
      previousExperimentStatus: "RUNNING",
      previousRecruitmentInformation: null,
      previousProlificConfig: null,
    },
    functions: {
      handleSetActivateExperiment: jest.fn(),
    },
  };
  const warning = (n) => ({
    context: "preprocessor",
    kind: "warning",
    name: `Warning ${n}`,
    message: `message ${n}`,
    hint: "",
    parameters: [],
  });

  it("warning cards carry the shared dismiss x, like error and success cards", () => {
    const instance = new Running({
      ...baseProps,
      compileWarnings: [warning(1), warning(2)],
    });
    const { container } = render(instance.render());
    expect(container.querySelectorAll(".alert-card")).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Dismiss warning message" }),
    ).toHaveLength(2);
  });

  it("a dismissed warning drops its card but keeps the others", () => {
    const compileWarnings = [warning(1), warning(2)];
    const instance = new Running({ ...baseProps, compileWarnings });
    instance.state = {
      ...instance.state,
      dismissedCompileWarnings: [compileWarnings[0]],
    };
    const { container } = render(instance.render());
    expect(container.querySelectorAll(".alert-card")).toHaveLength(1);
    expect(container.querySelector(".alert-name").textContent).toContain(
      "Warning 2",
    );
    // Last card dismissed → the whole (empty) box disappears.
    instance.state = {
      ...instance.state,
      dismissedCompileWarnings: compileWarnings,
    };
    const cleared = render(instance.render());
    expect(cleared.container.querySelector(".alert-list")).toBeNull();
  });

  it("a new compile's warnings are all shown, ignoring stale dismissals", () => {
    const oldWarnings = [warning(1), warning(2)];
    const previous = new Running({
      ...baseProps,
      compileWarnings: oldWarnings,
    });
    previous.state = {
      ...previous.state,
      dismissedCompileWarnings: oldWarnings,
    };
    // Same component state, fresh compileWarnings array (new objects).
    const fresh = new Running({
      ...baseProps,
      compileWarnings: [warning(3)],
    });
    fresh.state = previous.state;
    const { container } = render(fresh.render());
    expect(container.querySelectorAll(".alert-card")).toHaveLength(1);
    expect(container.querySelector(".alert-name").textContent).toContain(
      "Warning 3",
    );
  });
});
