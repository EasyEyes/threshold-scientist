// import React, { useEffect, useState } from "react";
// import { Button } from "react-bootstrap";
// import { Modal } from "react-bootstrap";
// import { getUserInfo } from "./components/user";
// import { getLogFile } from "../threshold/components/temporaryLogger";

// export function TemporaryLog({ style }) {
//   const [show, setShow] = useState(false);
//   const [user, setUser] = useState(null);

//   const toggleModal = () => {
//     setShow(!show);
//   };

//   useEffect(() => {
//     const getUser = async () => {
//       const accessToken = window.location.hash
//         .split("&")[0]
//         .split("#access_token=")[1];
//       const [user] = await getUserInfo(accessToken);
//       // console.log("user", user)
//       setUser(user);
//     };
//     getUser();
//   }, []);

//   return (
//     <div>
//       <button
//         id="tempLogModalButton"
//         className="button-grey button-smal"
//         style={style}
//         onClick={toggleModal}
//       >
//         temporary log
//       </button>

//       <Modal show={show} onHide={toggleModal}>
//         <Modal.Header closeButton>
//           <Modal.Title>Temporary Log</Modal.Title>
//         </Modal.Header>
//         <Modal.Body style={{ maxHeight: "80vh", overflowY: "auto" }}>
//           <div>
//             {user?.projectList.map((project) => {
//               return (
//                 <div key={project.id}>
//                   <ProjectElement project={project} />
//                 </div>
//               );
//             })}
//           </div>
//         </Modal.Body>
//       </Modal>
//     </div>
//   );
// }

// function ProjectElement({ project }) {
//   return (
//     <div style={projectElementStyle}>
//       <div style={{ flex: 1 }}>{project.name}</div>
//       <button
//         style={{ margin: "7px" }}
//         className="btn btn-success"
//         onClick={() => {
//           downloadLog(project.path_with_namespace);
//         }}
//       >
//         download log
//       </button>
//       <button style={{ margin: "7px" }} className="btn btn-danger">
//         clear log
//       </button>
//     </div>
//   );
// }

// const downloadLog = async (path) => {
//   console.log(`https://run.pavlovia.org/${path}/`);
//   const log = await getLogFile(`https://run.pavlovia.org/${path}/`);
//   // console.log("log",log)
//   if (log) {
//     alert("loading log file...");
//     const logArray = parseLogFile(log);
//     // console.log("logArray",logArray)
//     const csv = ConvertToCSV(logArray);
//     // console.log("csv",csv)
//     const blob = new Blob([csv], { type: "text/csv" });
//     const url = window.URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `${path}.csv`;
//     link.click();
//     return;
//   }
//   alert("log file not found");
// };

// const projectElementStyle = {
//   display: "flex",
//   margin: "10px",
//   alignItems: "center",
// };

// // JSON to CSV Converter
// function ConvertToCSV(objArray) {
//   var array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;
//   var str = "";
//   console.log("array", array);
//   var row = "";

//   //This loop will extract the label from 1st index of on array
//   for (var index in array[0]) {
//     //Now convert each value to string and comma-seprated
//     row += index + ",";
//   }
//   row = row.slice(0, -1);
//   //append Label row with line break
//   str += row + "\r\n";
//   for (var i = 0; i < array.length; i++) {
//     var line = "";
//     for (var index in array[i]) {
//       if (array[i][index] instanceof Object) {
//         array[i][index] = JSON.stringify(array[i][index]);
//         array[i][index] = array[i][index].replace(/,/g, "\r\n");
//       }
//       if (line != "") line += ",";

//       line += array[i][index];
//     }

//     str += line + "\r\n";
//   }

//   return str;
// }

// const parseLogFile = (log) => {
//   const EasyEyesIds = Object.keys(log);
//   const logArray = [];
//   EasyEyesIds.forEach((id) => {
//     const logEntry = log[id];
//     logEntry.EasyEyesId = id;
//     logArray.push(logEntry);
//   });
//   return logArray;
// };
