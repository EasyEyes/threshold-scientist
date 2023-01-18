import React, { Component, createRef } from "react";
import Dropzone from "react-dropzone";
import { handleDrop } from "./components/dropzone";

import "./css/Table.scss";
import ResourceButton from "./ResourceButton";

import { preprocessExperimentFile } from "../threshold/preprocess/main";
import { userRepoFiles } from "./components/constants";
import { copyUser, setRepoName } from "./components/gitlabUtils";

export default class Table extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tableName: null,
      errors: [],
    };

    this.onDrop = this.onDrop.bind(this);

    this.ref = createRef();
    this.dropZoneRef = createRef();

    this.finalSuccessMessage =
      "Compiled successfully. Compile a new experiment, anytime, by submitting it above.";
  }

  // componentDidUpdate() {
  //   if (
  //     this.props.isCompletedStep &&
  //     this.state.errors.length === 1 &&
  //     this.state.errors[0].name !== this.finalSuccessMessage
  //   ) {
  //     this.setState({
  //       errors: [
  //         {
  //           context: "preprocessor",
  //           kind: "correct",
  //           name: this.finalSuccessMessage,
  //         },
  //       ],
  //     });
  //   }
  // }

  onDrop(files) {
    const { user, functions } = this.props;
    handleDrop(
      user,
      files,
      functions.handleAddResources,
      this.handleTable.bind(this)
    );
  }

  async handleTable(file) {
    this.dropZoneRef.current.classList.add("drop-disabled");
    await this.reset();
    this.dropZoneRef.current.classList.remove("drop-disabled");

    this.setState({
      tableName: file.name,
    });

    const errors = [];

    await preprocessExperimentFile(
      file,
      copyUser(this.props.user),
      errors,
      this.props.resources,
      async (
        user,
        requestedForms, // : any,
        requestedFontList, // : string[],
        requestedTextList, // : string[],
        requestedFolderList, // : string[],
        requestedCodeList, // : string[],
        fileList, // : File[],
        errorList // : any[]
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
        userRepoFiles.requestedCode = requestedCodeList;
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
          });

          return;
        } else {
          // only accept the filename as official when there are no errors
          this.props.functions.handleSetFilename(file.name);

          if (user.id != undefined) {
            // user logged in
            this.props.functions.handleSetProjectName(
              await setRepoName(user, file.name.split(".")[0])
            );
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
      }

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
      resourceButtons.push(
        <ResourceButton
          key={`resource-button-${fileType}`}
          name={fileType}
          resourceList={this.props.resources[fileType]}
        />
      );
    }

    return (
      <div className="table" ref={this.ref}>
        <p className="dropzone-around-text emphasize">
          Submit any missing fonts, consent/debrief forms, and other resources.
          Then submit the experiment spreadsheet to compile.
        </p>
        <div className="file-zone">
          <Dropzone onDrop={this.onDrop}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps({ className: "dropzone" })}
                ref={this.dropZoneRef}
              >
                <input {...getInputProps()} />
                {/* <p className="dropzone-main-text emphasize"></p> */}
                <p className="dropzone-sub-text">
                  <i
                    className="bi bi-cloud-upload-fill"
                    style={{
                      fontSize: "1.4rem",
                      verticalAlign: "bottom",
                      marginRight: "0.5rem",
                    }}
                  ></i>
                  Select file
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
                (err) => err.context === "preprocessor" && err.kind === "error"
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
                    {error.parameters ? (
                      <>
                        <span className="error-parameter">
                          {error.parameters.join("<br/>")}
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
                        (err, i) => i !== index
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
                  <p
                    className="error-hint"
                    dangerouslySetInnerHTML={{
                      __html: error.hint,
                    }}
                  ></p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
