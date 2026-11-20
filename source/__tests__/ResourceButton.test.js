import React from "react";
import { fireEvent, render } from "@testing-library/react";
import ResourceButton from "../ResourceButton";
import Swal from "sweetalert2";

jest.mock("sweetalert2", () => ({ fire: jest.fn() }));

describe("ResourceButton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers retry for a failed listing instead of claiming zero files", () => {
    const onRetry = jest.fn();
    const { getByRole, queryByText } = render(
      <ResourceButton
        name="fonts"
        listing={{ kind: "failed", error: new Error("403") }}
        onRetry={onRetry}
      />,
    );

    const button = getByRole("button", { name: "Retry fonts" });
    expect(queryByText(/0 font/)).toBeNull();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("offers retry for the combined sound button when any of its listings failed", () => {
    const onRetry = jest.fn();
    const { getByRole } = render(
      <ResourceButton
        name="sound"
        listings={[
          { kind: "failed", error: new Error("403") },
          { kind: "ready", names: ["ir.gainVTime.csv"] },
          { kind: "ready", names: [] },
          { kind: "ready", names: [] },
        ]}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Retry sound" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("keeps a ready empty listing distinct and shows the ordinary empty dialog", () => {
    const { getByRole } = render(
      <ResourceButton
        name="fonts"
        listing={{ kind: "ready", names: [] }}
        onRetry={jest.fn()}
      />,
    );

    fireEvent.click(getByRole("button", { name: "0 font" }));
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ html: "No fonts found :(" }),
    );
  });
});
