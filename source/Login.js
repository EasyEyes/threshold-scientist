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
            <button className="button-green" onClick={this.login}>
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
      node = (
        <p>
          <span className="bold success">
            Connected to Pavlovia. Ready to compile your experiment.
          </span>{" "}
          <span className="emphasize">Pavlovia account</span> {user.name} (
          {user.username})
        </p>
      );
    }

    return <div className="login">{node}</div>;
  }
}
