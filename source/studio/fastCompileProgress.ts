/**
 * The Fast compile progress dialog: one dialog for the whole compile —
 * checks, upload, activation — in place of the pipeline's sequence of step
 * dialogs ("Compiling ...", "Preparing files ...", "Uploading ...",
 * "Activating ...").
 *
 * It is a SweetAlert2 dialog like every other dialog on the compiler page —
 * same popup, fonts, radius and green loader ring — so it looks native; what
 * differs is the content: "Fast compile", the seconds counting up, and one
 * quiet status line that follows the compile through the
 * phases the pipeline already records (compileMode.onCompilePhase). When the
 * pipeline runs with the "singleProgressUi" optimization (compileMode.ts,
 * Studio compiles) it opens none of its own dialogs and its retitles are
 * ignored (gitlabUtils.manuallySetSwalTitle), so this is the only thing on
 * screen until the experiment is ready or an error dialog / the error list
 * takes over.
 */
import Swal from "sweetalert2";

import {
  COMPILE_ENDED_PHASE,
  onCompilePhase,
} from "../../threshold/preprocess/compileMode";
import "./fastCompileProgress.css";

export type FastCompileMode = "compile" | "preview";

export interface PhaseStep {
  /** How far along the compile is when this phase is recorded (0–100). */
  target: number;
  /** Status line; omitted phases keep the previous one. */
  label?: string;
}

/**
 * Phase → progress and status. Phases not listed (e.g. "hosted-runtime-ready",
 * "glossary-ready") keep the previous status.
 */
export const COMPILE_STEPS: Record<string, PhaseStep> = {
  // Resources dropped in the Studio are saved to EasyEyesResources first
  // (dropzone.ts), before the table is read.
  "resources-translating": { target: 3, label: "Translating the phrases" },
  "resources-saving": { target: 4, label: "Saving the resources" },
  "input-accepted": { target: 6, label: "Reading the table" },
  "glossary-ready": { target: 10 },
  "phrases-ready": { target: 12 },
  "preamble-completed": { target: 16, label: "Checking the experiment" },
  "preprocessing-started": { target: 20, label: "Checking the experiment" },
  "preprocessing-completed": { target: 38, label: "Checks passed" },
  "upload-started": { target: 42, label: "Creating the Pavlovia project" },
  "repository-creation-requested": { target: 44 },
  "repository-created": { target: 52, label: "Packing the files" },
  "files-prepared": { target: 60, label: "Uploading" },
  // "commit-requested" repeats once per commit; handled in advance().
  "upload-completed": { target: 86, label: "Uploaded" },
  completed: { target: 88 },
  "activation-requested": { target: 90, label: "Starting on Pavlovia" },
  "activation-set-running": { target: 94, label: "Waiting for Pavlovia" },
  "pavlovia-ready": { target: 100, label: "Ready" },
};

export const PREVIEW_STEPS: Record<string, PhaseStep> = {
  "resources-translating": { target: 4, label: "Translating the phrases" },
  "resources-saving": { target: 6, label: "Saving the resources" },
  "input-accepted": { target: 10, label: "Reading the table" },
  "glossary-ready": { target: 18 },
  "phrases-ready": { target: 22 },
  "preamble-completed": { target: 28, label: "Checking the experiment" },
  "preprocessing-started": { target: 34, label: "Checking the experiment" },
  "preprocessing-completed": { target: 68, label: "Preparing the preview" },
  "preview-staged": { target: 100, label: "Opening the preview" },
  completed: { target: 100, label: "Opening the preview" },
};

/**
 * Recorded by Upload.js when the experiment's `_pavloviaPreferRunningModeBool`
 * is FALSE: the compile pauses on the compiler page's Upload step until the
 * scientist names the project and clicks Upload. The dialog steps aside for
 * that and returns with "upload-started".
 */
export const AWAITING_UPLOAD_PHASE = "upload-awaiting-confirmation";

/** Upload commits move progress from files-prepared toward this. */
const UPLOAD_END = 84;
/** How long "Ready" stays on screen before the dialog closes. */
const DONE_HOLD_MS = 900;
/** The seconds are repainted this often. */
const TICK_MS = 100;

/** Phases that end the compile unsuccessfully; the dialog leaves at once. */
const FAILURE_PHASES = new Set(["failed"]);

/**
 * Pure progress state machine, exported for tests: feed it phases, read the
 * progress and status.
 */
export class FastCompileTracker {
  target = 0;
  label = "Starting";
  done = false;
  failed = false;
  /** Waiting for the scientist on the Upload step; the dialog hides meanwhile. */
  paused = false;
  private readonly steps: Record<string, PhaseStep>;

  constructor(mode: FastCompileMode) {
    this.steps = mode === "preview" ? PREVIEW_STEPS : COMPILE_STEPS;
  }

  advance(phase: string): void {
    if (this.done || this.failed) return;
    if (FAILURE_PHASES.has(phase)) {
      this.failed = true;
      return;
    }
    if (phase === COMPILE_ENDED_PHASE) {
      this.done = true;
      return;
    }
    if (phase === AWAITING_UPLOAD_PHASE) {
      this.paused = true;
      return;
    }
    this.paused = false;
    if (phase === "commit-requested") {
      // Each commit closes half the remaining distance to the upload's end.
      const from = Math.max(
        this.target,
        this.steps["files-prepared"]?.target ?? 0,
      );
      this.target = Math.max(this.target, from + (UPLOAD_END - from) / 2);
      this.label = "Uploading";
      return;
    }
    const step = this.steps[phase];
    if (!step) return;
    // Never move backwards: a phase recorded out of the usual order must not
    // make the progress retreat.
    this.target = Math.max(this.target, step.target);
    if (step.label) this.label = step.label;
  }
}

export const formatElapsed = (ms: number): string =>
  `${(ms / 1000).toFixed(1)} s`;

/** Marks the dialog's content, so we can tell our dialog from any other. */
export const CONTAINER_ID = "ee-fast-compile";

const BOLT_PATH = "M13.5 2.5 5 13.5h6l-1.5 8 9-11.5h-6l1-7.5z";

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

let active: { close: () => void } | null = null;

/**
 * Show the progress dialog for the compile that is about to start. It closes
 * itself when the compile ends (Pavlovia ready — after a short "Ready" — or
 * failed). Showing again while one is up replaces it.
 */
export const showFastCompileProgress = (
  options: { mode?: FastCompileMode } = {},
): void => {
  if (typeof document === "undefined") return;
  active?.close();

  const mode = options.mode ?? "compile";
  const tracker = new FastCompileTracker(mode);
  const startedAt = now();
  /** Time spent paused on the Upload step, not counted as compile time. */
  let pausedFor = 0;
  let pausedAt: number | null = null;
  const elapsed = () => now() - startedAt - pausedFor;
  let closed = false;
  let off: () => void = () => {};

  // --- the dialog ----------------------------------------------------------
  /** Our content, when our dialog is the one showing. */
  const container = (): HTMLElement | null =>
    document.getElementById(CONTAINER_ID);
  const el = (cls: string): HTMLElement | null =>
    container()?.querySelector(`.${cls}`) ?? null;

  const paint = () => {
    const time = el("ee-fast-compile-time");
    if (time) time.textContent = formatElapsed(elapsed());
    const phase = el("ee-fast-compile-phase");
    if (phase) phase.textContent = tracker.label;
  };

  const open = () => {
    Swal.fire({
      title:
        `<svg class="ee-fast-compile-bolt" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${BOLT_PATH}"/></svg>` +
        (mode === "preview" ? "Preview" : "Fast compile") +
        // The Studio's beta stamp (styles.css .studio-beta), so the dialog
        // says what the button and the Studio title say.
        `<span class="ee-fast-compile-beta" title="The Studio is in beta — the Compiler tab is unchanged">beta</span>`,
      html:
        `<div id="${CONTAINER_ID}" class="ee-fast-compile" role="status" aria-live="polite">` +
        `<div class="ee-fast-compile-time">0.0 s</div>` +
        `<div class="ee-fast-compile-phase"></div>` +
        `</div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      customClass: { popup: "ee-fast-compile-popup" },
      didOpen: () => Swal.showLoading(),
    });
    paint();
  };

  /** Close the dialog only if it is still ours (an error dialog may have replaced it). */
  const closeDialog = () => {
    if (container()) Swal.close();
  };

  // --- the clock -----------------------------------------------------------
  const timer = window.setInterval(() => {
    if (!tracker.paused) paint();
  }, TICK_MS);

  // --- lifecycle -----------------------------------------------------------
  const close = () => {
    if (closed) return;
    closed = true;
    window.clearInterval(timer);
    off();
    closeDialog();
    if (active?.close === close) active = null;
  };

  const finish = () => {
    // The last phase set "Ready"; show it for a moment with the loader gone.
    window.clearInterval(timer);
    if (!container()) open();
    paint();
    container()?.classList.add("is-done");
    try {
      Swal.hideLoading();
    } catch {
      // Not open (should not happen); nothing to stop.
    }
    window.setTimeout(close, DONE_HOLD_MS);
  };

  off = onCompilePhase((phase) => {
    const wasPaused = tracker.paused;
    tracker.advance(phase);
    if (tracker.failed) {
      // The errors (list or dialog) take over.
      close();
      return;
    }
    if (tracker.done) {
      // Ended at 100 → show it complete briefly; ended early (an upload
      // aborted without a "failed" phase) → just leave.
      if (tracker.target >= 100) finish();
      else close();
      return;
    }
    if (tracker.paused && !wasPaused) {
      pausedAt = now();
      closeDialog();
      return;
    }
    if (!tracker.paused && wasPaused) {
      if (pausedAt !== null) pausedFor += now() - pausedAt;
      pausedAt = null;
    }
    // Back from a pause, or another dialog took the screen for a moment
    // (e.g. a discarded-file notice) and was dismissed: show ours again.
    if (!container()) open();
    paint();
  });

  open();
  active = { close };
};

/** Close the dialog, if one is up (e.g. the compile never started). */
export const hideFastCompileProgress = (): void => {
  active?.close();
  active = null;
};
