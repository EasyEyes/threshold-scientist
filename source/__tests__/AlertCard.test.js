import React from "react";
import { fireEvent, render } from "@testing-library/react";
import AlertCard from "../components/AlertCard";

const warning = {
  context: "preprocessor",
  kind: "warning",
  name: "Warning: 2 missing phrases",
  message: "Review the keys.",
  hint: "Remove stale references.",
  parameters: [],
};

describe("AlertCard", () => {
  it("owns exactly one warning symbol and the standard alert structure", () => {
    const { container } = render(<AlertCard alert={warning} />);
    const item = container.querySelector(".alert-card-warning");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("role", "region");
    expect(item.querySelector("h2")).not.toBeNull();
    expect(item.querySelector(".alert-name").textContent).toBe(
      "⚠️ Warning: 2 missing phrases",
    );
    expect(item.querySelector(".alert-message").textContent).toBe(
      "Review the keys.",
    );
    expect(item.querySelector(".alert-hint").textContent).toBe(
      "HINT: Remove stale references.",
    );
  });

  it("does not duplicate a legacy producer's warning symbol", () => {
    const { container } = render(
      <AlertCard alert={{ ...warning, name: "⚠️ Warning: legacy name" }} />,
    );
    expect(container.querySelector(".alert-name").textContent).toBe(
      "⚠️ Warning: legacy name",
    );
  });

  it("shows each alert's own name without a generic prefix", () => {
    const { container } = render(
      <>
        <AlertCard
          alert={{ kind: "error", context: "preprocessor", name: "Bad" }}
        />
        <AlertCard
          alert={{ kind: "error", context: "export", name: "Bad export" }}
        />
        <AlertCard alert={{ kind: "correct", name: "Ready" }} />
      </>,
    );
    expect(container.querySelectorAll("[role='alert']")).toHaveLength(2);
    expect(container.querySelector("[role='status']")).not.toBeNull();
    expect(
      [...container.querySelectorAll(".alert-name")].map((e) => e.textContent),
    ).toEqual(["Bad", "Bad export", "Ready"]);
  });

  it("supports dismissal", () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <AlertCard alert={warning} onClose={onClose} />,
    );
    fireEvent.click(getByRole("button", { name: "Dismiss warning message" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shares parameter actions across Studio and assistant surfaces", () => {
    const onParameter = jest.fn();
    const alert = { ...warning, parameters: ["font", "targetKind"] };
    const { container, getByRole } = render(
      <ul>
        <AlertCard
          as="li"
          headingLevel={3}
          alert={alert}
          onParameter={onParameter}
        />
      </ul>,
    );
    const item = container.querySelector("li.alert-card-warning");
    expect(item.querySelector("h3")).not.toBeNull();
    fireEvent.click(item.querySelector("button.alert-name"));
    expect(onParameter).toHaveBeenLastCalledWith("font");
    fireEvent.click(getByRole("button", { name: "targetKind" }));
    expect(onParameter).toHaveBeenLastCalledWith("targetKind");
    expect(onParameter).toHaveBeenCalledTimes(2);
  });

  it("renders rich message and hint content in valid flow containers", () => {
    const { container } = render(
      <AlertCard
        alert={{
          ...warning,
          message: "Missing files:<ul><li>font.woff</li></ul>",
          hint: "<div>Upload the files.</div>",
        }}
      />,
    );
    expect(container.querySelector(".alert-message").tagName).toBe("DIV");
    expect(container.querySelector(".alert-hint").tagName).toBe("DIV");
    expect(
      container.querySelector(".alert-hint-prefix + .alert-hint-content"),
    ).toHaveTextContent("Upload the files.");
    expect(container.querySelector("p ul, p div")).toBeNull();
  });
});

it.each(["error", "warning", "correct"])(
  "renders %s parameters first without a redundant label and hint last",
  (kind) => {
    const { container } = render(
      <AlertCard
        alert={{ ...warning, kind, parameters: ["font", "targetKind", "font"] }}
      />,
    );
    const fields = [...container.querySelector(".alert-card").children];
    expect(fields.map((field) => field.className)).toEqual([
      "alert-parameters",
      "alert-flex",
      "alert-message",
      "alert-hint",
    ]);
    expect(fields[0].textContent).toBe("font, targetKind");
    expect(fields[3].textContent).toBe("HINT: Remove stale references.");
  },
);

it("omits absent parameters and hints", () => {
  const { container } = render(
    <AlertCard alert={{ kind: "correct", name: "Ready" }} />,
  );
  expect(container.querySelector(".alert-parameters")).toBeNull();
  expect(container.querySelector(".alert-hint")).toBeNull();
});
