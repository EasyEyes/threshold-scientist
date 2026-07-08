import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VersionDropdown } from "../components/VersionDropdown";

const RELEASES = [
  { release: "2026-06-01", changelog: "June release" },
  { release: "2026-03-01", changelog: "March release" },
];

describe("VersionDropdown", () => {
  it("renders each release with its date and changelog", () => {
    render(
      <VersionDropdown
        releases={RELEASES}
        selected="2026-06-01"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText(/2026-06-01.*June release/)).toBeInTheDocument();
    expect(screen.getByText(/2026-03-01.*March release/)).toBeInTheDocument();
  });

  it("calls onSelect with the chosen release id", () => {
    const onSelect = jest.fn();
    render(
      <VersionDropdown
        releases={RELEASES}
        selected="2026-06-01"
        onSelect={onSelect}
      />,
    );

    fireEvent.change(screen.getByLabelText(/use easyeyes version/i), {
      target: { value: "2026-03-01" },
    });

    expect(onSelect).toHaveBeenCalledWith("2026-03-01");
  });

  it("shows the selected release as the current value", () => {
    render(
      <VersionDropdown
        releases={RELEASES}
        selected="2026-03-01"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByLabelText(/use easyeyes version/i).value).toBe(
      "2026-03-01",
    );
  });
});
