// A small SweetAlert2 stand-in that renders the dialog into the document the
// way the real one does (one popup at a time; #swal2-title and
// #swal2-html-container), so the progress dialog's content can be inspected.
jest.mock("sweetalert2", () => {
  const api = {
    _popup: null,
    _remove: () => {
      api._popup?.remove();
      api._popup = null;
    },
    fire: jest.fn((opts = {}) => {
      api._remove();
      const popup = document.createElement("div");
      popup.className = `swal2-popup ${opts.customClass?.popup ?? ""}`;
      popup.innerHTML =
        `<h2 id="swal2-title">${opts.title ?? ""}</h2>` +
        `<div id="swal2-html-container">${opts.html ?? ""}</div>`;
      document.body.appendChild(popup);
      api._popup = popup;
      opts.didOpen?.();
      return Promise.resolve({});
    }),
    close: jest.fn(() => api._remove()),
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    isVisible: () => api._popup !== null,
  };
  return { __esModule: true, default: api };
});

import Swal from "sweetalert2";
import {
  AWAITING_UPLOAD_PHASE,
  COMPILE_STEPS,
  CONTAINER_ID,
  FastCompileTracker,
  PREVIEW_STEPS,
  formatElapsed,
  hideFastCompileProgress,
  showFastCompileProgress,
} from "../studio/fastCompileProgress";
import {
  COMPILE_ENDED_PHASE,
  beginCompile,
  endCompile,
} from "../../threshold/preprocess/compileMode";
import { markCompilePhase } from "../../threshold/preprocess/compileTiming";

// The phases a Studio compile records, in order (Table.js, Upload.js,
// gitlabUtils.recordUploadPhase, Running.js).
const COMPILE_PHASES = [
  "input-accepted",
  "glossary-ready",
  "phrases-ready",
  "preamble-completed",
  "preprocessing-started",
  "preprocessing-completed",
  "upload-started",
  "repository-creation-requested",
  "repository-created",
  "hosted-runtime-ready",
  "files-prepared",
  "commit-requested",
  "commit-requested",
  "upload-completed",
  "completed",
  "activation-requested",
  "activation-set-running",
  "pavlovia-ready",
];

describe("FastCompileTracker", () => {
  it("moves forward through a compile, never backwards, and ends at 100 on pavlovia-ready", () => {
    const t = new FastCompileTracker("compile");
    let last = 0;
    for (const phase of COMPILE_PHASES) {
      t.advance(phase);
      expect(t.target).toBeGreaterThanOrEqual(last);
      last = t.target;
    }
    expect(t.target).toBe(100);
    expect(t.label).toBe("Ready");
    expect(t.done).toBe(false);
    t.advance(COMPILE_ENDED_PHASE);
    expect(t.done).toBe(true);
  });

  it("uses the recorded phases' labels and keeps the last one through unlabelled phases", () => {
    const t = new FastCompileTracker("compile");
    t.advance("input-accepted");
    expect(t.label).toBe("Reading the table");
    t.advance("glossary-ready"); // no label of its own
    expect(t.label).toBe("Reading the table");
    t.advance("hosted-runtime-ready"); // not a step at all
    expect(t.label).toBe("Reading the table");
    t.advance("preprocessing-completed");
    expect(t.label).toBe("Checks passed");
  });

  it("steps each upload commit halfway to the upload's end, staying under upload-completed", () => {
    const t = new FastCompileTracker("compile");
    t.advance("files-prepared");
    const start = t.target;
    t.advance("commit-requested");
    const one = t.target;
    t.advance("commit-requested");
    const two = t.target;
    t.advance("commit-requested");
    const three = t.target;
    expect(one).toBeGreaterThan(start);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    expect(three).toBeLessThan(COMPILE_STEPS["upload-completed"].target);
    expect(t.label).toBe("Uploading");
  });

  it("stops on failure and ignores whatever follows", () => {
    const t = new FastCompileTracker("compile");
    t.advance("preprocessing-started");
    t.advance("failed");
    expect(t.failed).toBe(true);
    const target = t.target;
    t.advance("upload-started");
    t.advance(COMPILE_ENDED_PHASE);
    expect(t.target).toBe(target);
    expect(t.done).toBe(false);
  });

  it("pauses while the Upload step waits for the scientist and resumes on upload-started", () => {
    const t = new FastCompileTracker("compile");
    t.advance("preprocessing-completed");
    t.advance(AWAITING_UPLOAD_PHASE);
    expect(t.paused).toBe(true);
    t.advance("upload-started");
    expect(t.paused).toBe(false);
    expect(t.target).toBe(COMPILE_STEPS["upload-started"].target);
  });

  it("a preview ends at 100 when the preview is staged", () => {
    const t = new FastCompileTracker("preview");
    for (const phase of [
      "input-accepted",
      "preamble-completed",
      "preprocessing-started",
      "preprocessing-completed",
      "preview-staged",
      "completed",
    ])
      t.advance(phase);
    expect(t.target).toBe(100);
    expect(t.label).toBe("Opening the preview");
    // A preview never uploads; those phases mean nothing to it.
    expect(PREVIEW_STEPS["upload-started"]).toBeUndefined();
  });
});

describe("formatElapsed", () => {
  it("shows tenths of a second", () => {
    expect(formatElapsed(0)).toBe("0.0 s");
    expect(formatElapsed(6842)).toBe("6.8 s");
  });
});

describe("showFastCompileProgress (dialog)", () => {
  const container = () => document.getElementById(CONTAINER_ID);
  const title = () => document.getElementById("swal2-title")?.textContent;
  const text = (cls) => container()?.querySelector(`.${cls}`)?.textContent;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    beginCompile("studio");
  });
  afterEach(() => {
    hideFastCompileProgress();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    // endCompile also emits compile-ended; the dialog is already gone.
    endCompile();
    Swal.close();
    document.body.innerHTML = "";
  });

  it("is a SweetAlert2 dialog with the loader, the seconds and a status line", () => {
    showFastCompileProgress({ mode: "compile" });
    expect(container()).not.toBeNull();
    expect(title()).toContain("Fast compile");
    // The Studio's beta stamp, as on the Studio title.
    expect(
      document.querySelector("#swal2-title .ee-fast-compile-beta")?.textContent,
    ).toBe("beta");
    expect(text("ee-fast-compile-time")).toBe("0.0 s");
    expect(text("ee-fast-compile-phase")).toBe("Starting");
    // The page's own dialog conventions: blocking, no buttons, loader ring.
    const options = Swal.fire.mock.calls[0][0];
    expect(options).toMatchObject({
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });
    expect(Swal.showLoading).toHaveBeenCalled();
  });

  it("follows the recorded phases and counts the seconds", () => {
    showFastCompileProgress({ mode: "compile" });
    markCompilePhase("input-accepted");
    expect(text("ee-fast-compile-phase")).toBe("Reading the table");
    markCompilePhase("files-prepared");
    expect(text("ee-fast-compile-phase")).toBe("Uploading");
    jest.advanceTimersByTime(1000);
    expect(text("ee-fast-compile-time")).toMatch(/^\d+\.\d s$/);
  });

  it("shows Ready with the loader stopped, then closes", () => {
    showFastCompileProgress({ mode: "compile" });
    markCompilePhase("pavlovia-ready");
    endCompile(); // → compile-ended
    expect(container().classList.contains("is-done")).toBe(true);
    expect(text("ee-fast-compile-phase")).toBe("Ready");
    expect(Swal.hideLoading).toHaveBeenCalled();
    expect(Swal.close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(900 + 10);
    expect(Swal.close).toHaveBeenCalledTimes(1);
    expect(container()).toBeNull();
  });

  it("closes at once when the compile fails, so the errors can be seen", () => {
    showFastCompileProgress({ mode: "compile" });
    markCompilePhase("preprocessing-started");
    markCompilePhase("failed");
    expect(container()).toBeNull();
  });

  it("does not close an error dialog that replaced it", () => {
    showFastCompileProgress({ mode: "compile" });
    // The pipeline reports the failure in its own dialog, then records "failed".
    Swal.fire({ title: "Failed to create Pavlovia experiment." });
    Swal.close.mockClear();
    markCompilePhase("failed");
    expect(Swal.close).not.toHaveBeenCalled();
    expect(title()).toBe("Failed to create Pavlovia experiment.");
  });

  it("closes when the compile ends before it is complete", () => {
    showFastCompileProgress({ mode: "compile" });
    markCompilePhase("input-accepted");
    endCompile();
    expect(container()).toBeNull();
  });

  it("steps aside while the Upload step waits for the scientist and comes back", () => {
    showFastCompileProgress({ mode: "compile" });
    markCompilePhase("preprocessing-completed");
    markCompilePhase(AWAITING_UPLOAD_PHASE);
    expect(container()).toBeNull();
    markCompilePhase("upload-started");
    expect(container()).not.toBeNull();
    expect(text("ee-fast-compile-phase")).toBe("Creating the Pavlovia project");
  });

  it("returns after another dialog took the screen for a moment", () => {
    showFastCompileProgress({ mode: "compile" });
    // e.g. dropzone's "<file> was discarded." notice, dismissed by the scientist
    Swal.fire({ title: "notice" });
    expect(container()).toBeNull();
    Swal.close();
    markCompilePhase("input-accepted");
    expect(container()).not.toBeNull();
    expect(text("ee-fast-compile-phase")).toBe("Reading the table");
  });

  it("labels a preview as such", () => {
    showFastCompileProgress({ mode: "preview" });
    expect(title()).toContain("Preview");
    markCompilePhase("preview-staged");
    expect(text("ee-fast-compile-phase")).toBe("Opening the preview");
  });

  it("showing again replaces the dialog that is up", () => {
    showFastCompileProgress({ mode: "compile" });
    showFastCompileProgress({ mode: "preview" });
    expect(document.querySelectorAll(`#${CONTAINER_ID}`)).toHaveLength(1);
    expect(title()).toContain("Preview");
  });
});
