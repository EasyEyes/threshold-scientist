import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import CompilerDiagnostic from "../components/CompilerDiagnostic";

const warning = {
  context: "preprocessor",
  kind: "warning",
  name: "Warning: 2 missing phrases",
  message: "Review the keys.",
  hint: "Remove stale references.",
  parameters: [],
};

describe("CompilerDiagnostic", () => {
  it("owns exactly one warning symbol and the standard warning structure", () => {
    const { container } = render(<CompilerDiagnostic diagnostic={warning} />);
    const item = container.querySelector(".compiler-diagnostic-warning");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("role", "region");
    expect(item.querySelector("h2")).not.toBeNull();
    expect(item.querySelector(".error-name").textContent).toBe(
      "⚠️ Warning: 2 missing phrases",
    );
    expect(item.querySelector(".error-message").textContent).toBe(
      "Review the keys.",
    );
    expect(item.querySelector(".error-hint").textContent).toBe(
      "HINT: Remove stale references.",
    );
    expect(item.querySelector(".compile-warning-item")).toBeNull();
  });

  it("does not duplicate a legacy producer's warning symbol", () => {
    const { container } = render(
      <CompilerDiagnostic
        diagnostic={{ ...warning, name: "⚠️ Warning: legacy name" }}
      />,
    );
    expect(container.querySelector(".error-name").textContent).toBe(
      "⚠️ Warning: legacy name",
    );
  });

  it("shows the diagnostic's own name; no generic error prefix", () => {
    const { container } = render(
      <>
        <CompilerDiagnostic
          diagnostic={{ kind: "error", context: "preprocessor", name: "Bad" }}
        />
        <CompilerDiagnostic
          diagnostic={{ kind: "error", context: "export", name: "Bad export" }}
        />
        <CompilerDiagnostic diagnostic={{ kind: "correct", name: "Ready" }} />
      </>,
    );
    expect(container.querySelectorAll("[role='alert']")).toHaveLength(2);
    expect(container.querySelector("[role='status']")).not.toBeNull();
    expect(
      [...container.querySelectorAll(".error-name")].map((e) => e.textContent),
    ).toEqual(["Bad", "Bad export", "Ready"]);
  });

  it("supports Studio's clickable list-item and Table's dismiss action", () => {
    const onJump = jest.fn();
    const onClose = jest.fn();
    const { container } = render(
      <ul>
        <CompilerDiagnostic
          as="li"
          headingLevel={3}
          diagnostic={{ ...warning, parameters: ["font"] }}
          onClick={() => onJump("font")}
          title="Jump to font"
        />
      </ul>,
    );
    const item = container.querySelector("li.compiler-diagnostic-warning");
    expect(item).not.toBeNull();
    const jump = item.querySelector("button.error-name");
    expect(jump).not.toBeNull();
    expect(item.querySelector("h3")).not.toBeNull();
    jump.focus();
    expect(jump).toHaveFocus();
    fireEvent.click(jump);
    expect(onJump).toHaveBeenCalledWith("font");

    const dismissible = render(
      <CompilerDiagnostic diagnostic={warning} onClose={onClose} />,
    );
    const dismiss = dismissible.getByRole("button", {
      name: "Dismiss warning message",
    });
    expect(dismiss.tagName).toBe("BUTTON");
    fireEvent.click(dismiss);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

it("retains production hint labels and value markup without adding an error prefix", () => {
  const { container } = render(
    <CompilerDiagnostic
      diagnostic={{
        ...warning,
        kind: "error",
        name: "Font missing",
        message: 'Missing <code class="error-value">example.woff</code>.',
        hint: "Upload the file.",
      }}
    />,
  );
  expect(container.querySelector(".error-name")).toHaveTextContent(
    "Font missing",
  );
  expect(container.querySelector(".error-name")).not.toHaveTextContent(
    "Compiler error:",
  );
  expect(
    container.querySelector(".error-message code.error-value"),
  ).toHaveTextContent("example.woff");
  expect(container.querySelector(".error-hint")).toHaveTextContent(
    "HINT: Upload the file.",
  );
});

it.each(["error", "warning", "correct"])(
  "renders %s fields in parameter, diagnostic, hint order",
  (kind) => {
    initGlossary({ glossary: { font: {}, readingCorpus: {} } });
    const { container } = render(
      <CompilerDiagnostic
        diagnostic={{
          ...warning,
          kind,
          parameters: ["font", "readingCorpus", "font"],
        }}
      />,
    );
    const fields = [
      ...container.querySelector(".compiler-diagnostic").children,
    ];
    expect(fields.map((field) => field.className)).toEqual([
      "error-relevant-parameters",
      "error-flex",
      "error-message",
      "error-hint",
    ]);
    expect(fields[0].textContent).toBe("font, readingCorpus");
    expect(fields[0].querySelectorAll("a")).toHaveLength(2);
    expect(fields[3]).toHaveTextContent("HINT: Remove stale references.");
  },
);

it("omits absent parameter and hint fields without empty labels", () => {
  const { container } = render(
    <CompilerDiagnostic diagnostic={{ kind: "correct", name: "Ready" }} />,
  );
  expect(container.querySelector(".error-relevant-parameters")).toBeNull();
  expect(container.querySelector(".error-hint")).toBeNull();
  expect(container.querySelector(".error-name")).toHaveTextContent("Ready");
});
