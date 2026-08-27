import React, { Component, createRef } from "react";
import Dropzone from "react-dropzone";
import Swal from "sweetalert2";

import { handleDrop } from "./components/dropzone";
import ResourceButton from "./ResourceButton";
import { preprocessExperimentFile } from "../threshold/preprocess/main";
import {
  userRepoFiles,
  resourcesRepoName,
} from "../threshold/preprocess/constants";
import {
  getAllProjects,
  copyUser,
  setRepoName,
  manuallySetSwalTitle,
  fetchPhraseFileFromResources,
} from "../threshold/preprocess/gitlabUtils";
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

  async handleTable(file) {
    const operation = startCompilerOperation("experiment-compilation", {
      source: this.props.isCompiledFromArchiveBool ? "archive" : "spreadsheet",
      fileExtension: file.name.split(".").pop()?.toLowerCase(),
      fileSize: file.size,
    });
    recordCompilerPhase(operation, "input-accepted");
    // The glossary is fetched lazily on first compile (no longer at app launch).
    // handleDrop has already opened a "Compiling ..." dialog before calling us;
    // we relabel that same dialog for each phase instead of firing/closing our
    // own, so the modal stays open continuously — closing it would leave a blank
    // screen through the rest of the compile.
    const prefetchPromise = getGlossaryPrefetch();
    if (prefetchPromise !== null) {
      manuallySetSwalTitle("Loading glossary …");
      Swal.showLoading(null);
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
      Swal.showLoading(null);
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
        Swal.close();
        console.error("Failed to refresh glossary:", err);
        return;
      }
    }
    // Restore the compiling status before handing off to the resource/compile
    // flow, which manages its own status dialog.
    manuallySetSwalTitle("Compiling ...");

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
      return;
    }

    let resolvedResources;

    // Wait for resources to be loaded if they aren't already
    if (!this.props.resourcesLoaded) {
      Swal.fire({
        title: "Listing resources ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading(null);
        },
      });

      await new Promise((resolve) => {
        const checkResourcesLoaded = () => {
          if (this.props.resourcesLoaded) {
            // Swal.close(); // Leave open actually, we want to seamlessly transition to the compiling Swal
            manuallySetSwalTitle("Compiling ...");
            resolve();
          } else {
            setTimeout(checkResourcesLoaded, 10);
          }
        };
        checkResourcesLoaded();
      });
    }

    // Ensure project list is resolved before proceeding if user object exists and projectList is a promise
    if (
      this.props.user &&
      this.props.user.projectList &&
      typeof this.props.user.projectList.then === "function"
    ) {
      await this.props.user.projectList;
    }

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

      // Fetch corpus text file content for compile-time length validation
      let textContents = {};
      try {
        const resourcesRepo = await searchProjectByName(
          this.props.user,
          resourcesRepoName,
        );
        if (resourcesRepo && resolvedResources.texts?.length > 0) {
          const repoID = parseInt(resourcesRepo.id);
          const { clientId, redirectUri } = getAuthConfig();
          const gitlabOAuthClient = GitLabOAuthClient.loadFromStorage(
            clientId,
            redirectUri,
          );
          if (!gitlabOAuthClient) throw new Error("AUTH_TOKEN_INVALID");
          const entries = await Promise.all(
            resolvedResources.texts.map(async (filename) => {
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
          textContents = Object.fromEntries(entries.filter(Boolean));
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
      resolvedResources.textContents = textContents;
      resolvedResources.phrases = userRepoFiles.phrases;
      // Let the compiler fetch a previously-uploaded phrase file from the
      // scientist's `phrases/` folder when it was not dropped this session.
      resolvedResources.fetchPhraseFromRepo = (name) =>
        fetchPhraseFileFromResources(this.props.user, name);
    }

    recordCompilerPhase(operation, "preprocessing-started");
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

            // sort according to parameter name
            blockingErrors.sort((errA, errB) => {
              if (errA.parameters < errB.parameters) return -1;
              else return 1;
            });

            // show errors
            this.setState({
              errors: [...blockingErrors],
              showDropZone: true,
            });

            Swal.close();

            return;
          } else {
            recordCompilerPhase(operation, "preprocessing-completed", {
              warningCount: warningList.length,
            });
            // only accept the filename as official when there are no errors
            this.props.functions.handleSetFilename(file.name);

            if (user.id != undefined) {
              // user logged in
              const resolvedProjectName = await setRepoName(
                user,
                file.name.split(".")[0],
              );
              this.props.functions.handleSetProjectName(resolvedProjectName);
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

              const projectsPromise = getAllProjects(user);
              const updatedProjects = await projectsPromise;
              this.props.functions.handleSetProjectList(updatedProjects);
              const baseName = file.name.split(".")[0];
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
      throw error;
    }

    // this.setState({
    //   errors: [...errors],
    // });
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
                    {error.parameters && error.parameters.length ? (
                      <>
                        <span className="error-parameter">
                          {error.parameters.join(" ")}
                        </span>
                        <br />
                      </>
                    ) : null}
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
                      __html: error.message,
                    }}
                  ></p>
                )}
                {error.hint && (
                  <p className="error-hint">
                    <span className="error-hint-prefix">HINT: </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: error.hint,
                      }}
                    ></span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
