import React from "react";
import { fireEvent, render } from "@testing-library/react";
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
      "HINT Remove stale references.",
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
