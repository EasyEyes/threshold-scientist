import React, { Fragment } from "react";
import { glossaryParameterUrl } from "../../threshold/parameters/glossaryLink";

/** One parameter name, linked to its glossary entry when known. Rendered as
 * React children so unrecognized names can never inject HTML. */
const parameterLink = (name) => {
  const href = glossaryParameterUrl(name);
  return href ? (
    <a
      className="error-parameter-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {name}
    </a>
  ) : (
    name
  );
};

/**
 * The first line of each diagnostic: involved parameters, deduplicated with
 * order preserved and linked to the glossary. The fixed PARAMETER: label
 * matches the HINT: label for every diagnostic kind.
 */
export default function ParameterList({ parameters }) {
  const names = [...new Set(parameters)];
  return (
    <div className="error-relevant-parameters">
      <span className="error-relevant-parameters-prefix">{"PARAMETER: "}</span>
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 ? ", " : null}
          {parameterLink(name)}
        </Fragment>
      ))}
    </div>
  );
}
