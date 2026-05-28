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
  getProjectByNameInProjectList,
} from "../threshold/preprocess/gitlabUtils";
import { getTextFileDataFromGitLab } from "../threshold/preprocess/fileUtils";

import "./css/Table.scss";
import { Dropdown } from "./components/Dropdown";
import { pinGlossaryVersion } from "./components/glossaryApi";

export default class Table extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tableName: null,
      errors: [],
      showDropZone: true,
    };

    this.onDrop = this.onDrop.bind(this);

    this.ref = createRef();
    this.dropZoneRef = createRef();

    this.finalSuccessMessage =
      "Compiled successfully. Compile a new experiment, anytime, by submitting it above.";
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

  async handleTable(file) {
    const { user } = this.props;

    let resolvedResources;

    // Wait for resources to be loaded if they aren't already
    if (!this.props.resourcesLoaded) {
      Swal.fire({
        title: "Listing resources...",
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

    resolvedResources = this.props.resources;

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

    // Fetch corpus text file content for compile-time length validation
    let textContents = {};
    try {
      const projectList = await this.props.user.projectList;
      const resourcesRepo = getProjectByNameInProjectList(
        projectList,
        resourcesRepoName,
      );
      if (resourcesRepo && resolvedResources.texts?.length > 0) {
        const repoID = parseInt(resourcesRepo.id);
        const accessToken = this.props.user.accessToken;
        const entries = await Promise.all(
          resolvedResources.texts.map(async (filename) => {
            try {
              const content = await getTextFileDataFromGitLab(
                repoID,
                `texts/${filename}`,
                accessToken,
              );
              return [filename, content];
            } catch (e) {
              // File might not exist or be unreadable; skip silently
              return null;
            }
          }),
        );
        textContents = Object.fromEntries(entries.filter(Boolean));
      }
    } catch (e) {
      // Non-fatal: corpus length check will be silently skipped
    }
    resolvedResources.textContents = textContents;

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
        userRepoFiles.requestedImpulseResponses = requestedImpulseResponseList;
        userRepoFiles.requestedFrequencyResponses =
          requestedFrequencyResponseList;
        userRepoFiles.requestedTargetSoundLists = requestedTargetSoundListList;
        userRepoFiles.blockFiles = fileList;

        if (errorList.length) {
          // sort errorList according to parameter name
          errorList.sort((errA, errB) => {
            if (errA.parameters < errB.parameters) return -1;
            else return 1;
          });

          // show errors
          this.setState({
            errors: [...errorList],
            showDropZone: true,
          });

          Swal.close();

          return;
        } else {
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
              .catch((error) =>
                console.warn("Failed to pin glossary version:", error),
              );

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

          // show success log
          this.props.functions.handleUpdateUser(user);
          this.setState({
            errors: [
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
          Welcome to the EasyEyes Compiler.
          <br />
          To retrieve an already-compiled experiment:
          <ul>
            <li>Click SELECT COMPILED EXPERIMENT</li>
          </ul>
          To compile a new experiment spreadsheet:
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
          To compile an export.zip archive containing both the spreadsheet and
          its resources:
          <ul>
            <li>Click SELECT FILE.</li>
          </ul>
          Resources uploaded individually are stored in your Pavlovia account
          for future use. Resources in an export.zip are not.
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
                      {error.name}
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
