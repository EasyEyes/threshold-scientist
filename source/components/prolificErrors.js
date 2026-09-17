// Prolific validation details can be nested under filter indexes and arrays.
// Keep the returned explanation readable without rendering API text as HTML.
const errorMessages = (value, path = []) => {
  if (typeof value === "string") {
    const field = path
      .filter((key) => !/^\d+$/.test(key) && key !== "non_field_errors")
      .join(".");
    return [field ? `${field}: ${value}` : value];
  }
  if (Array.isArray(value))
    return value.flatMap((item) => errorMessages(item, path));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      errorMessages(item, [...path, key]),
    );
  }
  return [];
};

export const prolificStudyCreationError = (result, httpStatus, projectId) => {
  const error = result?.error ?? result;
  const status = error?.status ?? httpStatus;
  const details = errorMessages(
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
    details.push(...errorMessages(fields));
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

  let message = parameters.length
    ? `Prolific rejected ${parameters.join(" and ")} in your spreadsheet.`
    : "Prolific could not create the study.";
  if (
    Number(status) === 404 &&
    projectId &&
    !parameters.includes("_prolific1ProjectID")
  ) {
    message +=
      " Check _prolific1ProjectID in your spreadsheet: the specified project may not exist or your connected Prolific account may not have permission to access it.";
  }
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
