import React, { Component } from "react";
import "regenerator-runtime";

import { downloadDataFolder } from "../threshold/preprocess/gitlabUtils";
import { getUserInfo, redirectToOauth2 } from "../threshold/preprocess/user";
import { tempAccessToken } from "../threshold/preprocess/global";

import "./css/Login.scss";

export default class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      login: null,
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

      const [user, resources, prolificToken] = await getUserInfo(accessToken);

      this.props.functions.handleLogin(
        user,
        resources,
        accessToken,
        prolificToken
      );
    }
  }

  login() {
    redirectToOauth2();
  }

  render() {
    const { isCompletedStep, user } = this.props;

    let node;
    switch (this.state.login) {
      case null: // no login
        node = (
          <div>
            <div className="green-status-banner">
              Connect to your Pavlovia account:
            </div>
            <button
              className="button-green connect-to-pav"
              onClick={this.login}
            >
              Connect to Pavlovia
            </button>
          </div>
        );
        break;
      case "loading": // fetching user info
        node = (
          <div className="green-status-banner">Connecting to Pavlovia ...</div>
        );
        break;
      default:
        break;
    }

    if (isCompletedStep) {
      let mostRecentProject = null;
      if (user.projectList.length) mostRecentProject = user.projectList[0];

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
            {mostRecentProject !== null && (
              <>
                <button
                  className="button-small button-grey"
                  style={{ ...smallButtonExtraStyle, lineHeight: "120%" }}
                  onClick={() => {
                    window.open(
                      `https://pavlovia.org/${mostRecentProject.path_with_namespace}`,
                      "_blank"
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
                window.open(`https://pavlovia.org/dashboard?tab=1`, "_blank");
              }}
            >
              View all experiments in Pavlovia
            </button>
          </div>
        </>
      );
    }

    return <div className="login">{node}</div>;
  }
}
