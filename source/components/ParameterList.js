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
 * The "PARAMETER(S): …" line in each compiler error and warning: every
 * involved parameter, deduplicated with order preserved, each linking to its
 * glossary entry when known. Rendered as the last line of the error box;
 * the prefix is styled like the HINT prefix (bold, all caps, context color).
 */
export default function ParameterList({ parameters }) {
  const names = [...new Set(parameters)];
  return (
    <div className="error-relevant-parameters">
      <span className="error-relevant-parameters-prefix">
        {names.length > 1 ? "PARAMETERS: " : "PARAMETER: "}
      </span>
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 ? ", " : null}
          {parameterLink(name)}
        </Fragment>
      ))}
    </div>
  );
}
