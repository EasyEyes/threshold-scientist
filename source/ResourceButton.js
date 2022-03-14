import React, { Component } from "react";

export default class ResourceButton extends Component {
  render() {
    return (
      <button className="button-grey button-small resource-button">
        {this.props.resourceList.length} {this.props.name}
      </button>
    );
  }
}
