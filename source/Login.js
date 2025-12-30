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
    // Check for authorization code in URL (PKCE flow)
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");

    if (authCode) {
      // We have an authorization code, exchange it for access token
      this.setState({
        login: "loading",
      });

      // Clear URL parameters
      // eslint-disable-next-line no-undef
      if (!process.env.debug)
        window.history.replaceState(null, null, window.location.pathname);

      try {
        // Import PKCE utilities
        const { retrieveCodeVerifier, exchangeCodeForToken } = await import(
          "../threshold/preprocess/pkceUtils"
        );

        // Retrieve the code verifier we stored before redirecting
        const codeVerifier = retrieveCodeVerifier();
        if (!codeVerifier) {
          throw new Error("Code verifier not found in session storage");
        }

        // Determine the redirect URI based on environment
        // eslint-disable-next-line no-undef
        const redirectUri = process.env.debug
          ? "http://localhost:5500/redirect"
          : "https://easyeyes.app/redirect";

        // Exchange authorization code for access token
        const tokenResponse = await exchangeCodeForToken(
          authCode,
          codeVerifier,
          redirectUri,
          "63785db109412d3b2a6179ada78be8a3411936184b467f678c8251fda96d8c14",
        );

        const accessToken = tokenResponse.access_token;

        // Temporarily assign access token for temporaryLog
        tempAccessToken.t = accessToken;

        // Initialize user with the access token
        this.initializeUserQuickly(accessToken);
      } catch (error) {
        captureError(error, "Error exchanging authorization code for token", {
          step: "tokenExchange",
        });
        this.setState({
          login: null, // Reset to allow retry
        });
      }
    } else {
      // No authorization code in URL, initiate login
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

  async login() {
    console.log("Logging In");
    await redirectToOauth2();
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
                          `https://gitlab.pavlovia.org/${mostRecentProject.path_with_namespace}?access_token=${user.accessToken}`,
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
                      `https://gitlab.pavlovia.org/dashboard?tab=1&access_token=${user.accessToken}`,
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
