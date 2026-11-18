import React, { Fragment } from "react";
import { glossaryParameterUrl } from "../../threshold/parameters/glossaryLink";

/** Parameter names are React children, never injected HTML. */
const parameterControl = (name, onParameter) => {
  if (onParameter)
    return (
      <button
        type="button"
        className="alert-parameter-link alert-parameter-action"
        onClick={(event) => {
          event.stopPropagation();
          onParameter(name);
        }}
        title={`Show ${name} in the grid`}
      >
        {name}
      </button>
    );
  const href = glossaryParameterUrl(name);
  return href ? (
    <a
      className="alert-parameter-link"
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

/** Every involved parameter, deduplicated with order preserved. */
export default function ParameterList({ parameters, onParameter }) {
  const names = [...new Set(parameters)];
  return (
    <div className="alert-parameters">
      <span className="alert-parameters-prefix">
        {names.length > 1 ? "PARAMETERS " : "PARAMETER "}
      </span>
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 ? ", " : null}
          {parameterControl(name, onParameter)}
        </Fragment>
      ))}
    </div>
  );
}
