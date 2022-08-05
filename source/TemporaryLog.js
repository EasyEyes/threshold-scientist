import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";

import { getUserInfo } from "./components/user";
import { getLogFile } from "../threshold/components/temporaryLogger";

import "./css/TemporaryLog.scss";

export const tempAccessToken = { t: undefined };

export function TemporaryLog({ style }) {
  const [show, setShow] = useState(false);
  const [user, setUser] = useState(null);

  const toggleModal = () => {
    setShow(!show);
  };

  useEffect(() => {
    const getUser = async () => {
      if (tempAccessToken.t) {
        const [user] = await getUserInfo(tempAccessToken.t);
        // console.log("user", user)
        setUser(user);
      }
    };
    getUser();
  }, [tempAccessToken.t]);

  return (
    <>
      <button
        id="temp-log-modal-button"
        className="button-grey button-small"
        style={style}
        onClick={toggleModal}
      >
        Temporary Log
      </button>

      <Modal className="log-modal" show={show} onHide={toggleModal}>
        <Modal.Header closeButton>
          <Modal.Title>Temporary Log</Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            borderRadius: "0.7rem",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          {user?.projectList.map((project) => {
            return <ProjectElement key={project.id} project={project} />;
          })}
        </Modal.Body>
      </Modal>
    </>
  );
}

function ProjectElement({ project }) {
  return (
    <div className="project-element">
      <p className="project-name">{project.name}</p>
      <div>
        <button
          className="btn temp-log-button temp-log-button-download"
          onClick={() => {
            downloadLog(project.path_with_namespace);
          }}
        >
          Download
        </button>
        <button className="btn temp-log-button temp-log-button-clear">
          Clear
        </button>
      </div>
    </div>
  );
}

const downloadLog = async (path) => {
  console.log(`https://run.pavlovia.org/${path}/`);
  const log = await getLogFile(`https://run.pavlovia.org/${path}/`);
  // console.log("log",log)
  if (log) {
    // alert("loading log file...");
    const logArray = parseLogFile(log);
    // console.log("logArray",logArray)
    const csv = ConvertToCSV(logArray);
    // console.log("csv",csv)
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${path}.csv`;
    link.click();
    return;
  }
  alert("log file not found");
};

// JSON to CSV Converter
function ConvertToCSV(objArray) {
  var array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;
  var str = "";
  // console.log("array", array);
  var row = "";

  //This loop will extract the label from 1st index of on array
  for (var index in array[0]) {
    //Now convert each value to string and comma-separated
    row += index + ",";
  }
  row = row.slice(0, -1);
  //append Label row with line break
  str += row + "\r\n";
  for (var i = 0; i < array.length; i++) {
    var line = "";
    for (const index in array[i]) {
      if (array[i][index] instanceof Object) {
        array[i][index] = JSON.stringify(array[i][index]);
        array[i][index] = array[i][index].replace(/,/g, ".");
      }
      // else line += ",";
      // if (line != "")

      line += array[i][index] + ",";
    }

    str += line + "\r\n";
  }

  return str;
}

const parseLogFile = (log) => {
  const EasyEyesIds = Object.keys(log);
  const logArray = [];
  EasyEyesIds.forEach((id) => {
    const logEntry = log[id];
    // logEntry.EasyEyesId = id;
    logArray.push(logEntry);
  });
  return logArray;
};
