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

export class ProlificProjectAccessError extends Error {
  constructor(message, projectId) {
    super(message);
    this.name = "ProlificProjectAccessError";
    this.projectId = projectId;
  }
}

const nonemptyText = (value) => (typeof value === "string" ? value.trim() : "");

export const prolificProjectAccessMessage = (projectId, account, project) => {
  const accountEmail = nonemptyText(account?.email);
  const projectTitle = nonemptyText(project?.title);
  const ownerEmail = nonemptyText(project?.ownerEmail);
  const projectLabel = projectTitle
    ? `“${projectTitle}” (${projectId})`
    : projectId;
  const accountLabel = accountEmail || "the connected Prolific account";
  const ownerLabel = ownerEmail
    ? `the project owner (${ownerEmail})`
    : "the project owner";

  return `The connected Prolific account${
    accountEmail ? ` (${accountEmail})` : ""
  } may need permission to create studies in project ${projectLabel}.\n\nCheck that _prolific1ProjectID points to the intended project. If the ID is correct, ask ${ownerLabel} to add ${accountLabel} to the project or update that account’s permissions, then try again.`;
};

export const prolificStudyCreationError = (result, httpStatus, projectId) => {
  const error = result?.error ?? result;
  const status = error?.status ?? httpStatus;
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
  if (
    projectId &&
    [403, 404].includes(Number(status)) &&
    parameters.every((parameter) => parameter === "_prolific1ProjectID")
  ) {
    return new ProlificProjectAccessError(message, projectId);
  }
  return new Error(message);
};
