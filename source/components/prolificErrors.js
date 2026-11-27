// Prolific validation details can be nested under filter indexes and arrays.
// Keep the returned explanation readable without rendering API text as HTML.
const alerts = (value, path = []) => {
  if (typeof value === "string") {
    const field = path
      .filter((key) => !/^\d+$/.test(key) && key !== "non_field_errors")
      .join(".");
    return [field ? `${field}: ${value}` : value];
  }
  if (Array.isArray(value)) return value.flatMap((item) => alerts(item, path));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      alerts(item, [...path, key]),
    );
  }
  return [];
};

// Prolific's status for a response: the one inside its error, else the HTTP one.
const errorStatus = (result, httpStatus) =>
  (result?.error ?? result)?.status ?? httpStatus;

// Prolific answers 404 both when the project does not exist and when the
// account is not one of its members, so the message has to cover both.
export const isProjectAccessError = (result, httpStatus, projectId) =>
  Number(errorStatus(result, httpStatus)) === 404 && Boolean(projectId);

// The line that gives the project id. The popup shows it in a box of its own.
const projectIdLine = (projectId) => `_prolific1ProjectID: ${projectId}`;

const projectAccessMessage = (projectId, accountEmail) =>
  [
    "Prolific couldn't create your study. Either your account isn't a member of the selected project, or the project ID is wrong.",
    projectIdLine(projectId),
    `Check the ID in your spreadsheet. If it is correct, ask the project owner to add your Prolific account${
      accountEmail ? ` (${accountEmail})` : ""
    } to the project. Once you have access, try creating the study again.`,
  ].join("\n");

// accountEmail is the email of the scientist's Prolific account, when known.
export const prolificStudyCreationError = (
  result,
  httpStatus,
  projectId,
  accountEmail,
) => {
  const error = result?.error ?? result;
  const status = errorStatus(result, httpStatus);
  const details = alerts(
    error?.detail ??
      error?.message ??
      (typeof error === "string" ? error : null),
  );
  // Some validation responses have field errors at the top level.
  if (!details.length && error && typeof error === "object" && !result?.id) {
    const {
      status,
      title,
      error_code,
      additional_information,
      interactive,
      ...fields
    } = error;
    details.push(...alerts(fields));
  }
  const explanation = [
    ...new Set(
      [error?.title, ...details].filter(
        (message) => typeof message === "string" && message,
      ),
    ),
  ].join("\n");
  const parameters = [];
  if (/custom_blocklist|_prolific3CustomBlockList/i.test(explanation))
    parameters.push("_prolific3CustomBlockList");
  if (/custom_allowlist|_prolific3CustomAllowList/i.test(explanation))
    parameters.push("_prolific3CustomAllowList");
  if (
    error?.detail?.project ||
    error?.project ||
    /_prolific1ProjectID/.test(explanation)
  )
    parameters.push("_prolific1ProjectID");

  if (
    isProjectAccessError(result, httpStatus, projectId) &&
    !parameters.includes("_prolific1ProjectID")
  )
    return Object.assign(
      new Error(projectAccessMessage(projectId, accountEmail)),
      { idLine: projectIdLine(projectId) },
    );

  let message = parameters.length
    ? `Prolific rejected ${parameters.join(" and ")} in your spreadsheet.`
    : "Prolific could not create the study.";
  if (explanation) {
    message += `\n\nProlific${
      status ? ` (HTTP ${status})` : ""
    }:\n${explanation}`;
  } else {
    message += `\n\nThe response${
      status ? ` (HTTP ${status})` : ""
    } did not confirm a valid unpublished study. Check your Prolific project before retrying.`;
  }
  return new Error(message);
};
