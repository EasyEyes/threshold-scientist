import React, { Component } from "react";
import Swal from "sweetalert2";

import "./css/components.scss";

export default class Question extends Component {
  render() {
    return (
      <div
        className="icon-holder"
        onClick={
          this.props.title
            ? () => {
                Swal.fire({
                  icon: undefined,
                  title: this.props.title,
                  html: this.props.text,
                  confirmButtonColor: "#019267",
                  customClass: {
                    htmlContainer: "popup-text-container",
                  },
                });
              }
            : null
        }
      >
        <i className="bi bi-question-circle icon-i"></i>
      </div>
    );
  }
}
