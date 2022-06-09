import React, { Component } from "react";
import "regenerator-runtime";

import { getUserInfo, redirectToOauth2 } from "./components/user";

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
      this.setState({
        login: "loading",
      });
      const [user, resources] = await getUserInfo();
      this.props.functions.handleLogin(user, resources);
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
          <>
            <p className="emphasize">
              Connect your Pavlovia account to upload files.
            </p>
            <button
              className="button-green connect-to-pav"
              onClick={this.login}
            >
              Connect
            </button>
          </>
        );
        break;
      case "loading": // fetching user info
        node = <p className="emphasize">Connecting to Pavlovia ...</p>;
        break;
      default:
        break;
    }

    if (isCompletedStep) {
      let mostRecentProject = null;
      if (user.projectList.length) mostRecentProject = user.projectList[0];

      node = (
        <>
          <div className="success-message">
            <p className="bold success">
              Connected to Pavlovia. Ready to compile your experiment.
            </p>{" "}
            <p className="account-info">
              <span className="pavlovia-account-name">
                {user.name} ({user.username})
              </span>
              <span className="pavlovia-account">Pavlovia account</span>{" "}
            </p>
          </div>
          <div className="link-set">
            <div className="link-set-buttons">
              {mostRecentProject !== null && (
                <button
                  className="button-small button-black"
                  onClick={() => {
                    window.open(
                      `https://pavlovia.org/${mostRecentProject.path_with_namespace}`,
                      "_blank"
                    );
                  }}
                >
                  View last project ({mostRecentProject.name})
                </button>
              )}

              <button
                className="button-grey button-small"
                onClick={() => {
                  window.open(`https://pavlovia.org/dashboard?tab=1`, "_blank");
                }}
              >
                Pavlovia dashboard
              </button>

              <button
                className="button-grey button-small"
                onClick={() => {
                  window.open(
                    `https://gitlab.pavlovia.org/dashboard/projects`,
                    "_blank"
                  );
                }}
              >
                GitLab projects
              </button>
            </div>
          </div>
        </>
      );
    }

    return <div className="login">{node}</div>;
  }
}
