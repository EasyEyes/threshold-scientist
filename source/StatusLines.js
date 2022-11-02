import React, { Component, PureComponent } from "react";
import "./css/Statusbar.scss";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
    //initialise states
    console.log(this.props.user);
  }
  render() {
    return (
      <>
        <div>
          <p>Pavlovia Account :</p>
          <p>Experiment Filename :</p>
          <p>Experiment Name :</p>
          <p>Experiment Mode :</p>
          <p>Experiment URL :</p>
        </div>
      </>
    );
  }
}
