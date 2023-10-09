import React, { Component } from "react";
import Swal from "sweetalert2";

import "./css/components.scss";

export class Question extends Component {
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

export class Compatibility extends Component {
  render() {
    return (
      <>
        <table
          style={{
            width: "100%",
            textAlign: "center",
          }}
        >
          <thead>
            <tr>
              <th rowSpan="2"></th>
              <th colSpan="2" className="browser">
                Chrome
              </th>
              <th colSpan="2" className="browser">
                Safari
              </th>
              <th colSpan="2" className="browser">
                Firefox
              </th>
              <th colSpan="2" className="browser">
                Edge
              </th>
              <th colSpan="2" className="browser">
                Opera
              </th>
            </tr>
            <tr>
              <th>
                <i className="bi bi-display"></i>
              </th>
              <th>
                <i className="bi bi-phone"></i>
              </th>
              <th>
                <i className="bi bi-display"></i>
              </th>
              <th>
                <i className="bi bi-phone"></i>
              </th>
              <th>
                <i className="bi bi-display"></i>
              </th>
              <th>
                <i className="bi bi-phone"></i>
              </th>
              <th>
                <i className="bi bi-display"></i>
              </th>
              <th>
                <i className="bi bi-phone"></i>
              </th>
              <th>
                <i className="bi bi-display"></i>
              </th>
              <th>
                <i className="bi bi-phone"></i>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="left-td">Compile page</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
            </tr>
            <tr>
              <td className="left-td">Participant page</td>
              <td>✅</td>
              <td>❌</td>
              <td>✅</td>
              <td>❌</td>
              <td>✅</td>
              <td>❌</td>
              <td>❌</td>
              <td>❌</td>
              <td>✅</td>
              <td>❌</td>
            </tr>
          </tbody>
        </table>
        <p
          style={{
            fontSize: "1rem",
          }}
        >
          Please report any exception to denis.pelli AT nyu.edu.
        </p>
      </>
    );
  }
}
