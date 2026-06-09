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
      preventAutoLogin: false, // Set to true when user signs out
    };

    this.login = this.login.bind(this);
  }

  async componentDidMount() {
    // Check for URL parameters first
    const urlParams = new URLSearchParams(window.location.search);

    // Check if user just signed out (auto_sign_in=false query parameter)
    const autoSignIn = urlParams.get("auto_sign_in");
    if (autoSignIn === "false") {
      // User just signed out - don't auto-redirect to OAuth
      // Clean up the URL by removing the query parameter
      window.history.replaceState(null, null, window.location.pathname);
      // Clean up the signing_out flag if it exists
      sessionStorage.removeItem("signing_out");
      console.log(
        "⏸️  Auto-login prevented after sign out. Waiting for manual login...",
      );
      this.setState({
        login: null,
        preventAutoLogin: true, // Set flag to prevent modal in componentDidUpdate
      });
      return; // Don't process anything else
    }

    // Check if user is in the process of signing out
    const signingOut = sessionStorage.getItem("signing_out");
    if (signingOut) {
      sessionStorage.removeItem("signing_out");
      console.log(
        "⏸️  Sign out in progress, skipping componentDidMount logic...",
      );
      return; // Don't do anything, wait for redirect with auto_sign_in=false
    }

    // Check for authorization code in URL (PKCE flow)
    const authCode = urlParams.get("code");
    const state = urlParams.get("state");

    if (authCode) {
      // We have an authorization code, exchange it for access token
      this.setState({
        login: "loading",
      });

      try {
        // Use GitLabAuth.handleCallback() to handle the entire OAuth callback flow
        const { GitLabAuth } = await import(
          "../threshold/preprocess/auth/gitlabAuth"
        );
        const { getAuthConfig } = await import(
          "../threshold/preprocess/auth/config"
        );

        const config = getAuthConfig();
        const auth = new GitLabAuth(config);

        // Handle callback: validates state (CSRF), exchanges code for tokens
        const { client, returnUrl } = await auth.handleCallback();

        // Clear URL parameters AFTER handleCallback() has read them
        // eslint-disable-next-line no-undef
        if (!process.env.debug)
          window.history.replaceState(null, null, window.location.pathname);

        const accessToken = client.getAccessToken();
        const refreshToken = client.getRefreshToken();
        const expiresAt = client.getExpiresAt();

        // Temporarily assign access token for temporaryLog
        tempAccessToken.t = accessToken;

        // Save tokens to localStorage
        client.saveTokens();

        // Initialize user with the access token
        this.initializeUserQuickly(accessToken, refreshToken, expiresAt);
      } catch (error) {
        captureError(error, "Error exchanging authorization code for token", {
          step: "tokenExchange",
        });

        // Clean up URL and redirect to fresh login
        console.error("OAuth callback failed:", error.message);

        // Clear URL parameters immediately
        window.history.replaceState(null, null, window.location.pathname);
        window.location.href = window.location.pathname;

        // Reset state to allow retry
        this.setState({
          login: null,
        });
      }
    } else {
      // No authorization code in URL
      // First, check for stored session before initiating login

      // Quick check: verify tokens exist in localStorage before attempting to load
      const hasTokensInStorage = localStorage.getItem("gitlab_oauth_tokens");

      if (hasTokensInStorage) {
        let loadingShown = false;
        const loadingTimer = setTimeout(() => {
          loadingShown = true;
          Swal.fire({
            title: "Loading ...",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading(null);
            },
          });
        }, 1000);
        const outageTimer = setTimeout(() => {
          if (loadingShown) {
            Swal.update({
              title: "Still loading",
              text: "Pavlovia may be slow or temporarily unreachable — this will resume automatically when it recovers.",
            });
            Swal.showLoading(null);
          }
        }, 12000);
        try {
          console.log("Checking stored session validity...");
          const { loadStoredSession } = await import(
            "../threshold/preprocess/user"
          );
          const storedSession = await loadStoredSession();

          if (storedSession) {
            // We have a valid stored session, use it
            console.log("Valid stored session found, logging in automatically");
            const [user, resourcesPromise, prolificTokenPromise] =
              storedSession;

            // Set access token for backward compatibility
            tempAccessToken.t = user.accessToken;

            this.setState({ login: "complete" });
            this.props.functions.handleLogin(
              user,
              resourcesPromise,
              user.accessToken,
              undefined,
            );

            // Update prolific token when ready
            prolificTokenPromise
              .then((prolificToken) => {
                if (this.props.functions.handleUpdateProlificToken) {
                  this.props.functions.handleUpdateProlificToken(prolificToken);
                }
              })
              .catch((error) => {
                captureError(error, "Error loading prolific token", {
                  step: "loadProlificToken",
                });
              });
            return;
          }
        } catch (error) {
          // Stored session invalid or error loading it
          console.log("Stored session invalid, initiating login", error);
        } finally {
          clearTimeout(loadingTimer);
          clearTimeout(outageTimer);
          if (loadingShown) Swal.close();
        }
      } else {
        console.log("No tokens in localStorage, initiating OAuth login");
      }

      // Check if user just signed out (auto_sign_in=false query parameter)
      const urlParams = new URLSearchParams(window.location.search);
      const autoSignIn = urlParams.get("auto_sign_in");

      if (autoSignIn === "false") {
        // User just signed out - don't auto-redirect to OAuth
        // Clean up the URL by removing the query parameter
        window.history.replaceState(null, null, window.location.pathname);
        console.log(
          "⏸️  Auto-login prevented after sign out. Waiting for manual login...",
        );
        this.setState({
          login: null,
          preventAutoLogin: true, // Set flag to prevent modal in componentDidUpdate
        });
      } else {
        // No stored session, initiate login automatically
        console.log("🔐 No session found, auto-redirecting to OAuth...");
        try {
          if (!this.state.login) {
            this.login();
          }
        } catch (error) {
          captureError(error, "Error logging in", { step: "initLogin" });
        }
      }
    }
  }

  async initializeUserQuickly(accessToken, refreshToken, expiresAt) {
    try {
      // Create GitLabOAuthClient and save tokens to localStorage
      const { GitLabOAuthClient } = await import(
        "../threshold/preprocess/auth/gitlabOAuthClient"
      );
      const { getAuthConfig } = await import(
        "../threshold/preprocess/auth/config"
      );

      const config = getAuthConfig();
      const oauthClient = new GitLabOAuthClient({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresAt: expiresAt,
        baseUrl: config.baseUrl,
      });

      // Save tokens to localStorage for session persistence
      oauthClient.saveTokens();

      // Create user and get basic info immediately
      const { createUser } = await import(
        "../threshold/preprocess/gitlabUtils"
      );
      const user = createUser(accessToken);
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
        undefined,
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
    // BUT don't show it if user just signed out (preventAutoLogin flag)
    if (
      !prevState.login &&
      !this.state.login &&
      !this.props.isCompletedStep &&
      !this.state.preventAutoLogin
    ) {
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
    } else if (this.state.preventAutoLogin) {
      // User just signed out - show login button
      node = (
        <div className="login-prompt">
          <p className="bold">You have been signed out from Pavlovia.</p>
          <p>Click the button below to login with your Pavlovia account.</p>
          <button
            className="button-green login-button"
            onClick={async () => {
              this.setState({ preventAutoLogin: false });
              await this.login();
            }}
          >
            Login with Pavlovia
          </button>
        </div>
      );
    }

    return <div className="login">{node}</div>;
  }
}
