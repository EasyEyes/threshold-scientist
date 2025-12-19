import React, { Component } from "react";
import "regenerator-runtime";
import Swal from "sweetalert2";

import { downloadDataFolder } from "../threshold/preprocess/gitlabUtils";
import { getUserInfo, redirectToOauth2 } from "../threshold/preprocess/user";
import { tempAccessToken } from "../threshold/preprocess/global";
import { captureError } from "./sentry";

import "./css/Login.scss";

export default class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      login: null,
      projectListLoaded: false,
      mostRecentProject: null,
    };

    this.login = this.login.bind(this);
  }

  async componentDidMount() {
    if (
      window.location.hash.length &&
      window.location.hash.includes("#access_token")
    ) {
      const accessToken = window.location.hash
        .split("&")[0]
        .split("#access_token=")[1];

      // clear address bar parameters
      // eslint-disable-next-line no-undef
      if (!process.env.debug)
        window.history.replaceState(null, null, window.location.pathname);
      this.setState({
        login: "loading",
      });

      // // temporarily assign access token here for temporaryLog
      tempAccessToken.t = accessToken;

      this.initializeUserQuickly(accessToken);
    } else {
      // No access token in URL
      try {
        if (!this.state.login) {
          this.login();
        }
      } catch (error) {
        captureError(error, "Error logging in", { step: "initLogin" });
      }
    }
  }

  async initializeUserQuickly(accessToken) {
    try {
      // Create user and get basic info immediately
      const { User } = await import("../threshold/preprocess/gitlabUtils");
      const user = new User(accessToken);
      await user.initUserDetails(); // TODO measure this is actually fast

      user.initProjectList();

      const resourcesPromise = user.projectList.then(async () => {
        const { getCommonResourcesNames } = await import(
          "../threshold/preprocess/gitlabUtils"
        );
        return getCommonResourcesNames(user);
      });
      const prolificTokenPromise = user.projectList.then(async () => {
        const { getProlificToken } = await import(
          "../threshold/preprocess/gitlabUtils"
        );
        return getProlificToken(user);
      });
      this.setState({ login: "complete" }); // Handle login immediately with user and promises
      this.props.functions.handleLogin(
        user,
        resourcesPromise,
        accessToken,
        "", // Empty prolific token initially
      );

      // Update prolific token when it's ready
      prolificTokenPromise
        .then((prolificToken) => {
          // Update prolific token in app state via a method we'll need to add
          if (this.props.functions.handleUpdateProlificToken) {
            this.props.functions.handleUpdateProlificToken(prolificToken);
          }
        })
        .catch((error) => {
          captureError(error, "Error loading prolific token:", {
            step: "loadProlificToken",
          });
        });
    } catch (error) {
      captureError(error, "Error initializing user:", {
        step: "initializeUser",
      });
      this.setState({
        login: null, // Reset to allow retry
      });
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    // Check if user changed and we need to load projectList
    if (
      this.props.user &&
      this.props.user !== prevProps.user &&
      !this.state.projectListLoaded
    ) {
      try {
        const resolvedProjectList = await this.props.user.projectList;
        const mostRecentProject =
          Array.isArray(resolvedProjectList) && resolvedProjectList.length
            ? resolvedProjectList[0]
            : null;

        this.setState({
          projectListLoaded: true,
          mostRecentProject: mostRecentProject,
        });
      } catch (error) {
        captureError(error, "Error loading project list:", {
          step: "loadProjectList",
        });
        this.setState({
          projectListLoaded: true,
          mostRecentProject: null,
        });
      }
    }

    // Show modal when redirecting to Pavlovia login
    if (!prevState.login && !this.state.login && !this.props.isCompletedStep) {
      Swal.fire({
        title: "Logging into Pavlovia ...",
        text: "Redirecting to Pavlovia login page",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading(null);
        },
      });
    }
  }

  componentWillUnmount() {
    Swal.close();
  }

  login() {
    console.log("Logging In");
    redirectToOauth2();
  }

  render() {
    const { isCompletedStep, user } = this.props;
    const { projectListLoaded, mostRecentProject } = this.state;

    let node = <div></div>;

    if (isCompletedStep) {
      const smallButtonExtraStyle = {
        whiteSpace: "nowrap",
        fontSize: "0.7rem",
        padding: "0.6rem",
        borderRadius: "0.3rem",
      };

      node = (
        <>
          <div className="success-message">
            <p className="bold success">
              Connected to Pavlovia. Ready to compile your experiment.
            </p>{" "}
            <p className="account-info">
              <span className="pavlovia-account">Account</span>{" "}
              <span className="pavlovia-account-name">
                <img
                  className="pavlovia-avatar"
                  src={user.avatar_url}
                  alt="Pavlovia Avatar"
                ></img>
                {user.name} ({user.username})
              </span>
            </p>
          </div>

          <div className="link-set-buttons-login">
            {!projectListLoaded ? (
              <p>Loading experiments...</p>
            ) : (
              <>
                {mostRecentProject !== null && (
                  <>
                    <button
                      className="button-small button-grey"
                      style={{ ...smallButtonExtraStyle, lineHeight: "120%" }}
                      onClick={() => {
                        window.open(
                          `https://pavlovia.org/${mostRecentProject.path_with_namespace}`,
                          "_blank",
                        );
                      }}
                    >
                      View last experiment
                      <br />
                      <b>{mostRecentProject.name}</b>
                    </button>

                    <button
                      className="button-small button-grey"
                      style={{ ...smallButtonExtraStyle, lineHeight: "120%" }}
                      onClick={async () => {
                        await downloadDataFolder(user, mostRecentProject);
                      }}
                    >
                      Download last experiment data
                      <br />
                      <b>{mostRecentProject.name}</b>
                    </button>
                  </>
                )}

                <button
                  className="button-grey button-small"
                  style={smallButtonExtraStyle}
                  onClick={() => {
                    window.open(
                      `https://pavlovia.org/dashboard?tab=1`,
                      "_blank",
                    );
                  }}
                >
                  View all experiments in Pavlovia
                </button>
              </>
            )}
          </div>
        </>
      );
    }

    return <div className="login">{node}</div>;
  }
}
