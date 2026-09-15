import React, { Component, createRef } from "react";
import Dropzone from "react-dropzone";
import Swal from "sweetalert2";

import { handleDrop } from "./components/dropzone";
import ResourceButton from "./ResourceButton";
import { preprocessExperimentFile } from "../threshold/preprocess/main";
import {
  linkGlossaryParameters,
  loadGlossaryRows,
} from "../threshold/parameters/glossaryLink";
import ParameterList from "./components/ParameterList";
import {
  userRepoFiles,
  resourcesRepoName,
} from "../threshold/preprocess/constants";
import {
  getAllProjects,
  copyUser,
  setRepoName,
  searchRepoNameMatches,
  manuallySetSwalTitle,
  fetchPhraseFileFromResources,
  gatherGeneratedFileActions,
  gatherUserUploadedFileActions,
  gatherRequestedResourceActions,
} from "../threshold/preprocess/gitlabUtils";
import { PREVIEW_PIN, stagePreview, showPreview } from "./studio/preview";
import { buildArchiveResources } from "../threshold/preprocess/archiveResources";
import { exportStudyBeforeCompiling } from "../threshold/preprocess/exportBeforeCompile";
import { searchProjectByName } from "../threshold/preprocess/gitlabSearch";
import { getTextFileDataFromGitLab } from "../threshold/preprocess/fileUtils";
import { GitLabOAuthClient } from "../threshold/preprocess/auth/gitlabOAuthClient";
import { getAuthConfig } from "../threshold/preprocess/auth/config";

import "./css/Table.scss";
import { Dropdown } from "./components/Dropdown";
import {
  fetchGlossaryData,
  fetchGlossaryVersion,
  pinGlossaryVersion,
  getGlossaryPrefetch,
} from "./components/glossaryApi";
import {
  initGlossary,
  getGlossaryVersion,
} from "../threshold/parameters/glossaryRegistry";
import {
  fetchPhrasesData,
  fetchPhrasesVersion,
  pinPhrasesVersion,
} from "./components/phrasesApi";
import {
  initPhrases,
  getPhrasesVersion,
} from "../threshold/parameters/phrasesRegistry";
import FreshnessStatus from "./components/FreshnessStatus";
import {
  captureCompilerFailure,
  finishCompilerOperation,
  recordCompilerPhase,
  startCompilerOperation,
} from "./sentry";
import {
  beginCompile,
  endCompile,
  optimizationOn,
} from "../threshold/preprocess/compileMode";
import { endCompileTiming } from "../threshold/preprocess/compileTiming";

export default class Table extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tableName: null,
      errors: [],
      showDropZone: true,
    };

    this.onDrop = this.onDrop.bind(this);
    this.onDropForExport = this.onDropForExport.bind(this);

    this.ref = createRef();
    this.dropZoneRef = createRef();

    this.finalSuccessMessage =
      "Compiled successfully. Compile a new experiment, anytime, by submitting it above.";
  }

  componentDidMount() {
    // Warm the parameter→glossary-row map in the background so the first
    // compile's errors can already link to exact glossary rows. Non-blocking:
    // the page renders while this fetch runs.
    loadGlossaryRows();
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.errors !== this.state.errors) {
      this.props.functions.handleSetCompileErrorsVisible?.(
        this.state.errors.some((err) => err.kind === "error"),
      );
    }
  }

  componentWillUnmount() {
    this.props.functions.handleSetCompileErrorsVisible?.(false);
  }

  onDrop(files) {
    this.compileFiles(files, "compiler");
  }

  /**
   * The one entry point to compilation, for files dropped on this page
   * ("compiler") and for files handed over by the Studio ("studio"). The
   * source only selects which speed optimizations are on (compileMode.ts);
   * the compile itself is the same.
   *
   * With `preview` ({ placeholder: Window | null }), the compile stops after
   * validation and, instead of uploading, opens the experiment in the
   * placeholder tab served from the browser (see studio/preview.ts).
   */
  compileFiles(files, source, preview = undefined) {
    beginCompile(source);
    this.pendingPreview = preview ?? null;
    this.setState({ errors: [] });
    const { user, functions } = this.props;
    if (!user || !user.initProjectList)
      throw new Error(
        `Table.js::onDrop User ${
          user ? "initProjectList method" : "object"
        } undefined.`,
      );
    user.initProjectList(true);
    handleDrop(
      user,
      files,
      functions.handleAddResources,
      this.handleTable.bind(this),
      functions.handleArchivedExperimentBool,
      functions.handleZipArchive,
    );
  }

  async onDropForExport(files) {
    // Exporting is deliberately tolerant and does not compile: whatever is
    // wrong with the study will be caught when the export is eventually
    // compiled. Any export failure is shown in the same list as compiler
    // errors, disambiguated by the "Download source error:" prefix (see render).
    const exportErrors = await exportStudyBeforeCompiling(
      this.props.user,
      files,
    );
    if (exportErrors.length > 0) {
      this.setState((prevState) => ({
        // Keep any compiler errors on display (they are why the scientist is
        // exporting), but replace stale export errors from earlier attempts.
        errors: [
          ...prevState.errors.filter((err) => err.context !== "export"),
          ...exportErrors,
        ],
      }));
      this.props.scrollToCurrentStep();
    }
  }

  /**
   * Whether this compile shows its progress in the classic step dialogs. With
   * the "singleProgressUi" optimization (compileMode.ts, Studio compiles) the
   * whole compile is shown by one continuous progress view that follows the
   * recorded phases (studio/fastCompileProgress.ts); no dialog is open, so the
   * retitles below (manuallySetSwalTitle) find nothing and Swal.showLoading()
   * — which would open an empty dialog — must not be called.
   */
  usingStepDialogs() {
    return !optimizationOn("singleProgressUi");
  }

  /** Spin the open step dialog's loader (a no-op without step dialogs). */
  showDialogSpinner() {
    if (this.usingStepDialogs()) Swal.showLoading(null);
  }

  /**
   * Make sure the glossary registry holds the server's current version.
   * Returns true when it does, false after reporting a download failure (the
   * caller aborts the compile and closes the dialog).
   */
  async refreshGlossary(operation) {
    const prefetchPromise = getGlossaryPrefetch();
    if (prefetchPromise !== null) {
      manuallySetSwalTitle("Loading glossary …");
      this.showDialogSpinner();
      try {
        await prefetchPromise;
      } catch (error) {
        captureCompilerFailure(
          error,
          operation,
          "glossary-prefetch",
          {},
          "dependency",
        );
      }
    }
    let shouldFetch = true;
    let serverVersion = null;
    try {
      ({ version: serverVersion } = await fetchGlossaryVersion());
      const cachedVersion = getGlossaryVersion();
      if (
        serverVersion !== null &&
        cachedVersion !== null &&
        serverVersion === cachedVersion
      ) {
        shouldFetch = false;
      }
    } catch (error) {
      captureCompilerFailure(
        error,
        operation,
        "glossary-version",
        {},
        "dependency",
      );
      // fall through to full fetch
    }

    if (shouldFetch) {
      // The glossary isn't ready yet; tell the scientist we're waiting on it.
      manuallySetSwalTitle("Loading glossary …");
      this.showDialogSpinner();
      try {
        // Fetch by explicit version so the CDN returns the just-published
        // glossary (new version = new URL = cache miss), never a stale copy.
        // If the probe failed, serverVersion is null → falls back to current.
        const data = await fetchGlossaryData(serverVersion);
        initGlossary(data);
      } catch (err) {
        captureCompilerFailure(
          err,
          operation,
          "glossary-download",
          {},
          "dependency",
        );
        finishCompilerOperation(operation, "failed", {
          failedPhase: "glossary-download",
        });
        console.error("Failed to refresh glossary:", err);
        return false;
      }
    }
    if (optimizationOn("timing"))
      recordCompilerPhase(operation, "glossary-ready", {
        downloaded: shouldFetch,
      });
    return true;
  }

  /**
   * Same contract as refreshGlossary, for the phrases registry.
   */
  async refreshPhrases(operation) {
    try {
      let shouldFetchPhrases = true;
      try {
        const { version: serverVersion } = await fetchPhrasesVersion();
        const cachedVersion = getPhrasesVersion();
        if (
          serverVersion !== null &&
          cachedVersion !== null &&
          serverVersion === cachedVersion
        ) {
          shouldFetchPhrases = false;
        }
      } catch (error) {
        captureCompilerFailure(
          error,
          operation,
          "phrases-version",
          {},
          "dependency",
        );
        // fall through to full fetch
      }

      if (shouldFetchPhrases) {
        const data = await fetchPhrasesData();
        initPhrases(data);
      }
      if (optimizationOn("timing"))
        recordCompilerPhase(operation, "phrases-ready", {
          downloaded: shouldFetchPhrases,
        });
      return true;
    } catch (err) {
      captureCompilerFailure(
        err,
        operation,
        "phrases-download",
        {},
        "dependency",
      );
      finishCompilerOperation(operation, "failed", {
        failedPhase: "phrases-download",
      });
      console.error("Failed to refresh phrases:", err);
      return false;
    }
  }

  /**
   * Resolve once App has listed the scientist's EasyEyesResources.
   * When run alongside the other preamble tasks (parallel), relabel the open
   * "Compiling ..." dialog rather than firing a new one, so the modal stays
   * put; otherwise show the classic "Listing resources ..." dialog.
   */
  waitForResourcesLoaded(parallel) {
    if (this.props.resourcesLoaded) return Promise.resolve();
    if (parallel) {
      manuallySetSwalTitle("Listing resources ...");
      this.showDialogSpinner();
    } else if (!this.usingStepDialogs()) {
      // No dialog to open; the progress view is showing the compile.
    } else {
      Swal.fire({
        title: "Listing resources ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading(null);
        },
      });
    }
    return new Promise((resolve) => {
      const checkResourcesLoaded = () => {
        if (this.props.resourcesLoaded) {
          // Leave the dialog open; it seamlessly becomes the compiling dialog.
          manuallySetSwalTitle("Compiling ...");
          resolve();
        } else setTimeout(checkResourcesLoaded, 10);
      };
      checkResourcesLoaded();
    });
  }

  /** Resolve once the user's project list (a promise while loading) is in. */
  async waitForProjectList() {
    const { user } = this.props;
    if (user && user.projectList && typeof user.projectList.then === "function")
      await user.projectList;
  }

  /**
   * Content of every text file in the scientist's EasyEyesResources (from
   * `this.props.resources.texts`, so the listing must be in), keyed by file
   * name, for compile-time corpus length validation. Never rejects: read
   * failures are reported and the affected files are left out.
   */
  async readTextResources(operation, resourcesRepoPromise) {
    const textContents = {};
    try {
      const resourcesRepo = await resourcesRepoPromise;
      const texts = this.props.resources?.texts;
      if (resourcesRepo && texts?.length > 0) {
        const repoID = parseInt(resourcesRepo.id);
        const { clientId, redirectUri } = getAuthConfig();
        const gitlabOAuthClient = GitLabOAuthClient.loadFromStorage(
          clientId,
          redirectUri,
        );
        if (!gitlabOAuthClient) throw new Error("AUTH_TOKEN_INVALID");
        const entries = await Promise.all(
          texts.map(async (filename) => {
            try {
              const content = await getTextFileDataFromGitLab(
                repoID,
                `texts/${filename}`,
                gitlabOAuthClient,
              );
              return [filename, content];
            } catch (e) {
              captureCompilerFailure(
                e,
                operation,
                "optional-text-resource-read",
                { resourceType: "texts" },
                "user-correctable",
              );
              return null;
            }
          }),
        );
        Object.assign(
          textContents,
          Object.fromEntries(entries.filter(Boolean)),
        );
      }
    } catch (e) {
      captureCompilerFailure(
        e,
        operation,
        "text-resources-list",
        {},
        "dependency",
      );
    }
    return textContents;
  }

  async handleTable(file) {
    // Set by compileFiles for a Studio preview; consumed by this compile only.
    const preview = this.pendingPreview ?? null;
    this.pendingPreview = null;
    const operation = startCompilerOperation("experiment-compilation", {
      source: this.props.isCompiledFromArchiveBool ? "archive" : "spreadsheet",
      fileExtension: file.name.split(".").pop()?.toLowerCase(),
      fileSize: file.size,
      ...(preview ? { preview: true } : {}),
    });
    recordCompilerPhase(operation, "input-accepted");
    // Any early exit below leaves the preview's placeholder tab orphaned;
    // close it so the scientist is not left with a blank "Preparing…" tab.
    const closePlaceholder = () => preview?.placeholder?.close?.();
    // Preamble: refresh the glossary and phrases, wait for the resources
    // listing and the project list. handleDrop has already opened a
    // "Compiling ..." dialog before calling us; we relabel that same dialog
    // for each phase instead of firing/closing our own, so the modal stays
    // open continuously — closing it would leave a blank screen through the
    // rest of the compile.
    //
    // The EasyEyesResources lookup is only needed for a plain spreadsheet
    // compile (an archive is self-contained); its result is consumed below.
    const lookupResourcesRepo = () =>
      this.props.isCompiledFromArchiveBool
        ? Promise.resolve(null)
        : Promise.resolve()
            .then(() => searchProjectByName(this.props.user, resourcesRepoName))
            .catch((e) => {
              captureCompilerFailure(
                e,
                operation,
                "text-resources-list",
                {},
                "dependency",
              );
              return null;
            });

    // With "overlapMetadataCalls", metadata round trips run alongside the
    // work they used to precede (each is consumed below where it was before):
    // - the project list is not waited for — nothing before the upload step
    //   reads it (the drop already refreshed it in the background);
    // - the corpus texts are read as soon as the resources listing is in,
    //   instead of after the whole preamble;
    // - the repo-name search (read-only) starts now rather than after
    //   validation.
    const overlapMetadata =
      optimizationOn("overlapMetadataCalls") &&
      !this.props.isCompiledFromArchiveBool;
    const baseName = file.name.split(".")[0];
    let repoNameMatches;
    if (overlapMetadata) {
      repoNameMatches = searchRepoNameMatches(this.props.user, baseName);
      // setRepoName awaits (and fails on) this later; this only prevents an
      // unhandled-rejection report if the compile stops before that.
      repoNameMatches.catch(() => {});
    }

    let resourcesRepoPromise;
    let textContentsPromise;
    if (optimizationOn("parallelPreamble")) {
      // These are independent round trips, so run them concurrently. Each
      // refresh keeps its own failure handling and reports false on failure;
      // the compile aborts on either, exactly as when they ran in sequence.
      resourcesRepoPromise = lookupResourcesRepo();
      const resourcesListed = this.waitForResourcesLoaded(true);
      if (overlapMetadata)
        textContentsPromise = resourcesListed.then(() =>
          this.readTextResources(operation, resourcesRepoPromise),
        );
      const [glossaryReady, phrasesReady] = await Promise.all([
        this.refreshGlossary(operation),
        this.refreshPhrases(operation),
        resourcesListed,
        overlapMetadata ? Promise.resolve() : this.waitForProjectList(),
      ]);
      if (!glossaryReady) {
        Swal.close();
        closePlaceholder();
        return;
      }
      if (!phrasesReady) {
        closePlaceholder();
        return;
      }
      recordCompilerPhase(operation, "preamble-completed");
    } else {
      // The classic order: one after another.
      if (!(await this.refreshGlossary(operation))) {
        Swal.close();
        closePlaceholder();
        return;
      }
      // Restore the compiling status before handing off to the resource/compile
      // flow, which manages its own status dialog.
      manuallySetSwalTitle("Compiling ...");
      if (!(await this.refreshPhrases(operation))) {
        closePlaceholder();
        return;
      }
      await this.waitForResourcesLoaded(false);
      await this.waitForProjectList();
    }
    // Restore the compiling status before handing off to the resource/compile
    // flow, which manages its own status dialog.
    manuallySetSwalTitle("Compiling ...");

    let resolvedResources;

    this.dropZoneRef.current.classList.add("drop-disabled");
    await this.reset();
    this.dropZoneRef.current.classList.remove("drop-disabled");

    this.setState({
      tableName: file.name,
      showDropZone: false,
    });

    const errors = [];

    userRepoFiles.impulseResponses = [];

    userRepoFiles.frequencyResponses = [];

    userRepoFiles.targetSoundLists = [];

    if (this.props.isCompiledFromArchiveBool && this.props.archivedZip) {
      // An export archive is self-contained: the zip's files are the resource
      // pool. Build the same easyeyesResources shape (name lists, textContents,
      // localFetchers) from the archive, so the compiler runs the same
      // resource validations, sourcing from the zip instead of the
      // scientist's EasyEyesResources repo.
      try {
        resolvedResources = await buildArchiveResources(this.props.archivedZip);
      } catch (e) {
        captureCompilerFailure(
          e,
          operation,
          "archive-resources-read",
          {},
          "user-correctable",
        );
        resolvedResources = {};
      }
    } else {
      // Shallow-copy so the compile-time augmentation below (phrases File
      // objects, textContents, fetchPhraseFromRepo) does not mutate the shared
      // `resources` state. Mutating it in place overwrote the phrase filenames
      // shown by the resource buttons with raw File objects ("[object File]").
      resolvedResources = { ...this.props.resources };

      // Corpus text file content for compile-time length validation. With
      // "overlapMetadataCalls" the read was started during the preamble and
      // is normally already resolved; otherwise read now, as before.
      resolvedResources.textContents = await (textContentsPromise ??
        this.readTextResources(
          operation,
          resourcesRepoPromise ?? lookupResourcesRepo(),
        ));
      resolvedResources.phrases = userRepoFiles.phrases;
      // Let the compiler fetch a previously-uploaded phrase file from the
      // scientist's `phrases/` folder when it was not dropped this session.
      resolvedResources.fetchPhraseFromRepo = (name) =>
        fetchPhraseFileFromResources(this.props.user, name);
    }

    recordCompilerPhase(operation, "preprocessing-started");
    // Parameter→glossary-row map for error links: fetch in parallel with the
    // compile so it costs no wall-clock time. Failures degrade to
    // whole-glossary links (see loadGlossaryRows).
    loadGlossaryRows();
    try {
      await preprocessExperimentFile(
        file,
        copyUser(this.props.user),
        errors,
        resolvedResources,
        this.props.isCompiledFromArchiveBool,
        async (
          user,
          requestedForms, // : any,
          requestedFontList, // : string[],
          requestedTextList, // : string[],
          requestedFolderList, // : string[],
          requestedImageList,
          requestedCodeList, // : string[],
          fileList, // : File[],
          errorList, // : any[]
          requestedImpulseResponseList, // : string[]
          requestedFrequencyResponseList, // : string[]
          requestedTargetSoundListList, // : string[]
          requestedPhraseFileName, // : string
        ) => {
          // Rows for parameter links were fetched in parallel with the
          // compile (kicked off before preprocessing), so this is normally
          // already resolved. If a slow retry just started, render after a
          // short grace period instead of blocking on it — a later compile
          // will have the rows.
          if (errorList.length > 0)
            await Promise.race([
              loadGlossaryRows(),
              new Promise((resolve) => setTimeout(resolve, 500)),
            ]);
          // scroll to the top of the step block
          this.props.scrollToCurrentStep();

          const formList = [];

          if (requestedForms.debriefForm)
            formList.push(requestedForms.debriefForm);
          if (requestedForms.consentForm)
            formList.push(requestedForms.consentForm);

          userRepoFiles.requestedForms = formList;
          userRepoFiles.requestedFonts = requestedFontList;
          userRepoFiles.requestedTexts = requestedTextList;
          userRepoFiles.requestedFolders = requestedFolderList;
          userRepoFiles.requestedImages = requestedImageList;
          userRepoFiles.requestedCode = requestedCodeList;
          userRepoFiles.requestedImpulseResponses =
            requestedImpulseResponseList;
          userRepoFiles.requestedFrequencyResponses =
            requestedFrequencyResponseList;
          userRepoFiles.requestedTargetSoundLists =
            requestedTargetSoundListList;
          userRepoFiles.requestedPhrases = requestedPhraseFileName
            ? [requestedPhraseFileName]
            : [];
          userRepoFiles.blockFiles = fileList;

          // Warnings (kind === "warning") do not block compilation; only real
          // errors do. They are shown alongside the success message below.
          const hasBlockingError = errorList.some(
            (err) => err.kind === "error",
          );
          const warningList = errorList.filter((err) => err.kind === "warning");

          if (hasBlockingError) {
            finishCompilerOperation(operation, "failed", {
              failedPhase: "validation",
            });
            // When compilation fails, show only the blocking errors (not the
            // non-blocking warnings), so the experimenter focuses on what must be
            // fixed.
            const blockingErrors = errorList.filter(
              (err) => err.kind === "error",
            );
            captureCompilerFailure(
              new Error("Experiment validation failed"),
              operation,
              "validation",
              {
                errorCount: blockingErrors.length,
                errorContexts: [
                  ...new Set(blockingErrors.map((error) => error.context)),
                ],
              },
              "user-correctable",
            );

            // Sort by parameter list (codepoint order, as before);
            // Array.prototype.sort is stable, so errors listing the same
            // parameters keep the compiler's emission order (e.g. font-by-font
            // for corpus coverage errors).
            blockingErrors.sort((errA, errB) => {
              const a = (errA.parameters ?? []).join(",");
              const b = (errB.parameters ?? []).join(",");
              return a < b ? -1 : a > b ? 1 : 0;
            });

            // show errors
            this.setState({
              errors: [...blockingErrors],
              showDropZone: true,
            });

            Swal.close();
            closePlaceholder();

            return;
          } else {
            recordCompilerPhase(operation, "preprocessing-completed", {
              warningCount: warningList.length,
            });

            // A Studio preview ends here: the validated experiment is served
            // from the browser instead of being uploaded.
            if (preview) {
              await this.openPreview(user, operation, preview);
              return;
            }

            // only accept the filename as official when there are no errors
            this.props.functions.handleSetFilename(file.name);

            if (user.id != undefined) {
              // user logged in
              const resolvedProjectName = await setRepoName(
                user,
                baseName,
                repoNameMatches,
              );
              this.props.functions.handleSetProjectName(resolvedProjectName);
              // The project-list refresh does not depend on the phrases pin;
              // with "overlapMetadataCalls" it runs alongside it. Its result
              // is awaited (and any failure surfaces) below, where it was.
              let projectsPromise;
              if (overlapMetadata) {
                projectsPromise = getAllProjects(user);
                projectsPromise.catch(() => {});
              }
              pinGlossaryVersion(user.username, resolvedProjectName)
                .then(({ version }) =>
                  console.log("Glossary version pinned:", version),
                )
                .catch((error) => {
                  console.warn("Failed to pin glossary version:", error);
                  captureCompilerFailure(
                    error,
                    operation,
                    "glossary-version-pin",
                    {},
                    "external-service",
                  );
                });

              try {
                await pinPhrasesVersion(user.username, resolvedProjectName);
              } catch (error) {
                console.error("Failed to pin phrases version:", error);
                captureCompilerFailure(
                  error,
                  operation,
                  "phrases-version-pin",
                  {},
                  "external-service",
                );
                finishCompilerOperation(operation, "failed", {
                  failedPhase: "phrases-version-pin",
                });
                return;
              }

              const updatedProjects = await (projectsPromise ??
                getAllProjects(user));
              this.props.functions.handleSetProjectList(updatedProjects);
              const newProj = updatedProjects.find((p) => p.name === baseName);
              if (newProj) {
                this.props.functions.handleSetActivateExperiment(newProj);
              }
              this.props.functions.handleNextStep("upload");
            }

            // Surface any non-blocking warnings (e.g. LOGGING CAUTION) so they are
            // shown on the "Experiment ready to run" page, above the green banner.
            if (this.props.functions.handleSetCompileWarnings) {
              this.props.functions.handleSetCompileWarnings(warningList);
            }

            // show success log, preceded by any non-blocking warnings
            this.props.functions.handleUpdateUser(user);
            this.setState({
              errors: [
                ...warningList,
                {
                  context: "preprocessor",
                  kind: "correct",
                  name: this.finalSuccessMessage,
                },
              ],
            });
          }
        },

        // this.props.functions.handleSetExperiment
      );
    } catch (error) {
      captureCompilerFailure(error, operation, "preprocessing", {
        resourceTypesPresent: Object.keys(resolvedResources).filter(
          (key) =>
            Array.isArray(resolvedResources[key]) &&
            resolvedResources[key].length > 0,
        ),
      });
      finishCompilerOperation(operation, "failed", {
        failedPhase: "preprocessing",
      });
      closePlaceholder();
      throw error;
    }

    // this.setState({
    //   errors: [...errors],
    // });
  }

  /**
   * Studio preview. `user` is the compiled experiment's user (from the
   * preprocess callback); the files a compile would commit — the compiler's
   * generated files, the table and block CSVs, and the requested resources
   * from EasyEyesResources — are staged for the preview service worker, the
   * runtime's glossary/phrases pins for the preview path are set to the
   * current versions (as a compile pins them for its project), and the
   * placeholder tab is sent to the preview. Nothing is uploaded.
   */
  async openPreview(user, operation, preview) {
    try {
      manuallySetSwalTitle("Preparing preview ...");
      const [generated, uploaded, resources] = await Promise.all([
        gatherGeneratedFileActions(user),
        gatherUserUploadedFileActions(userRepoFiles),
        gatherRequestedResourceActions(
          user,
          this.props.isCompiledFromArchiveBool,
          this.props.archivedZip,
        ),
        pinGlossaryVersion(
          PREVIEW_PIN.username,
          PREVIEW_PIN.experimentName,
        ).catch((error) => {
          // As for a compile: the runtime falls back to its bundled glossary.
          console.warn("Failed to pin glossary version for preview:", error);
          captureCompilerFailure(
            error,
            operation,
            "glossary-version-pin",
            { preview: true },
            "external-service",
          );
        }),
        // Required: the runtime refuses to start without a phrases pin.
        pinPhrasesVersion(PREVIEW_PIN.username, PREVIEW_PIN.experimentName),
      ]);
      const actions = [...generated, ...uploaded, ...resources];
      const url = await stagePreview(actions);
      recordCompilerPhase(operation, "preview-staged", {
        fileCount: actions.length,
      });
      Swal.close();
      showPreview(url, preview.placeholder);
      // The preview belongs to the Studio: leave the Compiler tab's Table
      // step exactly as it was before (no table name, no messages), as
      // reset() leaves it. Warnings were the Studio's to show; nothing about
      // the preview appears on the compiler page.
      this.setState({ showDropZone: true, tableName: null, errors: [] });
      finishCompilerOperation(operation, "completed", { preview: true });
    } catch (error) {
      preview.placeholder?.close?.();
      captureCompilerFailure(
        error,
        operation,
        "preview",
        {},
        "external-service",
      );
      finishCompilerOperation(operation, "failed", { failedPhase: "preview" });
      this.setState({ showDropZone: true });
      Swal.fire({
        icon: "error",
        title: "Preview failed",
        text: error?.message ?? String(error),
        confirmButtonColor: "#666",
      });
    } finally {
      // A compile's timeline continues into upload and activation; a preview
      // is over here.
      endCompileTiming();
      endCompile();
    }
  }

  async reset() {
    await this.props.functions.handleReturnToStep("table");
    this.setState({
      tableName: null,
      errors: [],
    });
  }

  render() {
    const resourceButtons = [];
    for (const fileType in this.props.resources) {
      // Skip folders, impulseResponses, and frequencyResponses as they'll be combined into a single "sound" button
      if (
        fileType !== "folders" &&
        fileType !== "impulseResponses" &&
        fileType !== "frequencyResponses" &&
        fileType !== "targetSoundLists"
      ) {
        resourceButtons.push(
          <ResourceButton
            key={`resource-button-${fileType}`}
            name={fileType}
            resourceList={this.props.resources[fileType]}
            isLoading={!this.props.resourcesLoaded}
          />,
        );
      }
    }

    // Add the combined sound button if any of the sound-related resources exist
    if (
      this.props.resources.folders ||
      this.props.resources.impulseResponses ||
      this.props.resources.frequencyResponses ||
      this.props.resources.targetSoundLists
    ) {
      resourceButtons.push(
        <ResourceButton
          key="resource-button-sound"
          name="sound"
          resourceList={this.props.resources.folders || []}
          secondaryResourceList={this.props.resources.impulseResponses || []}
          tertiaryResourceList={this.props.resources.frequencyResponses || []}
          targetSoundListList={this.props.resources.targetSoundLists || []}
          isLoading={!this.props.resourcesLoaded}
        />,
      );
    }

    return (
      <div className="table" ref={this.ref}>
        <div className="green-status-banner">
          To retrieve an already-compiled study:
          <ul>
            <li>Click SELECT COMPILED STUDY.</li>
          </ul>
          To compile a new study spreadsheet:
          <ul>
            <li>
              Click SELECT FILE to upload any required resources: fonts, sounds,
              images, forms, … .
            </li>
            <li>
              Then click SELECT FILE again to select and compile the
              spreadsheet.
            </li>
          </ul>
          To compile a source.zip archive (containing both the spreadsheet and
          its resources):
          <ul>
            <li>Click SELECT FILE.</li>
          </ul>
          To download your study as a raw.source.zip archive, without compiling
          it, e.g. to share it or report a bug:
          <ul>
            <li>
              Click SELECT FILE TO DOWNLOAD RAW SOURCE to select your
              spreadsheet.
            </li>
          </ul>
          Resources uploaded individually are stored in your Pavlovia account
          for future use. Resources in a source.zip are not.
          <FreshnessStatus
            onPublicationDate={this.props.functions.updateLatestPublicationDate}
          />
        </div>
        <div style={{ marginTop: "8px", marginBottom: "10px" }}>
          <span
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "0.3rem",
            }}
          >
            <Dropdown
              selected={this.props.activeExperiment}
              setSelectedProject={
                this.props.functions.handleSetActivateExperiment
              }
              projectList={this.props.user.projectList}
              newExperimentProjectName={this.props.projectName}
              style={{
                padding: "0.6rem 1rem",
                backgroundColor: "#999",
                fontSize: "1.2rem",
                fontWeight: "500",
              }}
              user={this.props.user}
              isFromStartTable={true}
            />
          </span>
        </div>
        <div className="file-zone">
          <Dropzone onDrop={this.onDrop}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps({ className: "dropzone" })}
                ref={this.dropZoneRef}
                style={{
                  visibility: this.state.showDropZone ? "visible" : "hidden",
                }}
              >
                <input {...getInputProps()} />
                <p className="dropzone-sub-text">Select file</p>
              </div>
            )}
          </Dropzone>

          <Dropzone onDrop={this.onDropForExport}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps({ className: "dropzone dropzone-export" })}
                style={{
                  visibility: this.state.showDropZone ? "visible" : "hidden",
                }}
              >
                <input {...getInputProps()} />
                <p className="dropzone-sub-text">
                  Select file to download raw source
                </p>
              </div>
            )}
          </Dropzone>

          <div className="resource-buttons">{resourceButtons}</div>
        </div>

        {this.state.tableName ? (
          <p
            className={`dropzone-around-text emphasize${
              this.state.errors.filter(
                (err) => err.context === "preprocessor" && err.kind === "error",
              ).length
                ? " has-error"
                : ""
            }`}
          >
            {this.state.tableName}
          </p>
        ) : null}

        {this.state.errors.length !== 0 && (
          <div className="errors">
            {this.state.errors.map((error, index) => (
              <div
                className={`error-item error-${error.kind}`}
                key={`error-${index}`}
              >
                <div className="error-flex">
                  <p>
                    <span className={`error-name error-name-${error.kind}`}>
                      {/* Compiler and export errors share this display, so the
                          red sentence states which one it is. */}
                      {error.kind === "error"
                        ? `${
                            error.context === "export"
                              ? "Download source"
                              : "Compiler"
                          } error: ${error.name}`
                        : error.name}
                    </span>
                  </p>
                  <i
                    className="bi bi-x error-close"
                    onClick={() => {
                      const newErrors = this.state.errors.filter(
                        (err, i) => i !== index,
                      );
                      const newName = newErrors.length ? this.state.name : null;
                      this.setState({
                        errors: newErrors,
                        tableName: newName,
                      });
                    }}
                  ></i>
                </div>

                {error.message && (
                  <p
                    className="error-message"
                    dangerouslySetInnerHTML={{
                      __html: linkGlossaryParameters(error.message),
                    }}
                  ></p>
                )}
                {error.hint && (
                  <p className="error-hint">
                    <span className="error-hint-prefix">HINT: </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: linkGlossaryParameters(error.hint),
                      }}
                    ></span>
                  </p>
                )}
                {error.parameters && error.parameters.length ? (
                  <ParameterList parameters={error.parameters} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
