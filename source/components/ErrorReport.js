import Swal from "sweetalert2";
import "../css/ErrorReport.css";

const generateErrorDataframe = async (dataframes) => {
  let processedDataframes = [];
  let maxTrials = 0;
  for (let i = 0; i < dataframes.length; i++) {
    let df = dataframes[i];
    // add columns if they don't exist
    if (!df.listColumns().includes("participant")) {
      df = df.withColumn("participant", () => "");
      df = df.withColumn("error", () => "invalid file");
    }
    if (!df.listColumns().includes("ProlificParticipantID")) {
      df = df.withColumn("ProlificParticipantID", () => "");
    }
    if (!df.listColumns().includes("hardwareConcurrency")) {
      df = df.withColumn("hardwareConcurrency", () => NaN);
    }
    if (!df.listColumns().includes("error")) {
      df = df.withColumn("error", () => "");
    }
    if (!df.listColumns().includes("conditionName")) {
      df = df.withColumn("conditionName", () => "");
    }
    if (!df.listColumns().includes("block_condition")) {
      df = df.withColumn("block_condition", () => "");
    }
    if (!df.listColumns().includes("block")) {
      df = df.withColumn("block", () => NaN);
    }
    if (!df.listColumns().includes("targetTask")) {
      df = df.withColumn("targetTask", () => "");
    }
    if (!df.listColumns().includes("targetKind")) {
      df = df.withColumn("targetKind", () => "");
    }
    if (!df.listColumns().includes("deviceLanguage")) {
      df = df.withColumn("deviceLanguage", () => "");
    }
    if (!df.listColumns().includes("screenHeightPx")) {
      df = df.withColumn("screenHeightPx", () => NaN);
    }
    if (!df.listColumns().includes("screenWidthPx")) {
      df = df.withColumn("screenWidthPx", () => NaN);
    }
    if (!df.listColumns().includes("deviceBrowser")) {
      df = df.withColumn("deviceBrowser", () => "");
    }
    if (!df.listColumns().includes("deviceBrowserVersion")) {
      df = df.withColumn("deviceBrowserVersion", () => "NA.NA");
    }
    const browser =
      df.select("deviceBrowser").toArray()[0][0] +
      " " +
      df.select("deviceBrowserVersion").toArray()[0][0].split(".")[0];
    const resolution =
      df.select("screenWidthPx").toArray()[0][0].toString() +
      "x" +
      df.select("screenHeightPx").toArray()[0][0].toString();
    df = df
      .withColumn(
        "screenWidthPx",
        () => df.select("screenWidthPx").toArray()[0][0]
      )
      .withColumn(
        "screenHeightPx",
        () => df.select("screenHeightPx").toArray()[0][0]
      )
      .withColumn("browser", () => browser)
      .withColumn("resolution", () => resolution)
      .rename("hardwareConcurrency", "cores")
      .rename("ProlificParticipantID", "Prolific ID")
      .rename("participant", "Pavlovia ID");
    maxTrials = Math.max(maxTrials, df.count());
    processedDataframes.push(
      df.select(
        "error",
        "Prolific ID",
        "Pavlovia ID",
        "deviceType",
        "cores",
        "browser",
        "resolution",
        "deviceSystem",
        "block",
        "block_condition",
        "conditionName",
        "targetTask",
        "targetKind"
      )
    );
  }
  let error = processedDataframes[0];
  for (let i = 1; i < processedDataframes.length; i++) {
    error = error.union(processedDataframes[i]);
  }
  error = error
    .filter((row) => row.get("error") !== "")
    .withColumn("ok", (row) => false);
  for (let i = 0; i < processedDataframes.length; i++) {
    let df = processedDataframes[i];
    if (df.filter((row) => row.get("error") !== "").count() == 0) {
      let ok = df.head(1).withColumn("ok", (row) => true);
      ok = ok
        .withColumn("block", () => "")
        .withColumn("block_condition", () => "")
        .withColumn("conditionName", () => "")
        .withColumn("targetTask", () => "")
        .withColumn("targetKind", () => "");
      error = error.union(ok);
    }
  }

  return error
    .select(
      "ok",
      "error",
      "Prolific ID",
      "Pavlovia ID",
      "deviceType",
      "cores",
      "browser",
      "resolution",
      "deviceSystem",
      "block",
      "block_condition",
      "conditionName",
      "targetTask",
      "targetKind"
    )
    .sortBy("ok");
};

export const displayErrorReportPopup = async (dataframes, project) => {
  dataframes = await generateErrorDataframe(dataframes);
  const headers = dataframes.listColumns();
  const dataArray = [headers, ...dataframes.toArray()];
  function createTableFromArray(arr) {
    const table = document.createElement("table");
    table.classList.add("table", "table-bordered", "table-hover");

    // Create table header
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    arr[0].forEach((header) => {
      const th = document.createElement("th");
      const filterInput = document.createElement("input");
      filterInput.type = "text";
      filterInput.placeholder = `Filter ${header}`;
      filterInput.addEventListener("input", () => {
        const filterText = filterInput.value.trim().toLowerCase();
        const columnIndex = Array.from(th.parentNode.children).indexOf(th);
        const rows = tbody.children;
        Array.from(rows).forEach((row) => {
          const cellText = row.children[columnIndex].textContent
            .trim()
            .toLowerCase();
          if (cellText.includes(filterText)) {
            row.style.display = "";
          } else {
            row.style.display = "none";
          }
        });
      });
      th.appendChild(filterInput);
      th.textContent = header;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");
    arr.slice(1).forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        if (typeof cell === "boolean") {
          td.textContent = cell ? "✅" : "❌";
        } else {
          td.textContent = cell;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  Swal.fire({
    title: `Experiment: ${project.name}`,
    html: createTableFromArray(dataArray),
    showCloseButton: true,
    showCancelButton: false,
    focusConfirm: false,
    confirmButtonText: "Ok",
    confirmButtonAriaLabel: "Ok",
    cancelButtonText: "Cancel",
    cancelButtonAriaLabel: "Cancel",
    customClass: "swalFullPage",
  });
};
