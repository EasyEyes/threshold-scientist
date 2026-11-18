import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { AlertPanel } from "../studio/components/AlertPanel";
import { ResourcePanel } from "../studio/components/ResourcePanel";

const alert = {
  context: "preprocessor",
  kind: "warning",
  name: "Logging caution",
  message: "Logging is enabled.",
  hint: "Disable unnecessary logging.",
  parameters: ["_logTrialsBool"],
};

const resourceProps = {
  needed: [],
  compilerErrors: [alert],
  onJump: jest.fn(),
  phrase: null,
  files: [],
  userResources: null,
  resourcesLoaded: true,
  signedIn: true,
  onAddFiles: jest.fn(),
  onRemoveFile: jest.fn(),
  onBrowseExisting: jest.fn(),
};

describe("Studio alerts", () => {
  it("uses the shared success alert when no problems are found", () => {
    const { container } = render(<AlertPanel alerts={[]} onJump={jest.fn()} />);
    const item = container.querySelector(".alert-card-correct");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("role", "status");
    expect(item).toHaveTextContent("No problems");
    expect(container.querySelector(".all-clear")).toBeNull();
  });

  it("shares parameter jumping with AlertCard", () => {
    const onJump = jest.fn();
    const { container, getByRole } = render(
      <AlertPanel alerts={[alert]} onJump={onJump} />,
    );
    const item = container.querySelector("li.alert-card-warning");
    expect(item).not.toBeNull();
    fireEvent.click(item.querySelector("button.alert-name"));
    expect(onJump).toHaveBeenCalledWith("_logTrialsBool");
    fireEvent.click(getByRole("button", { name: "_logTrialsBool" }));
    expect(onJump).toHaveBeenCalledTimes(2);
  });

  it("ResourcePanel uses the same alert card", () => {
    const { container } = render(<ResourcePanel {...resourceProps} />);
    expect(container.querySelector("li.alert-card-warning")).not.toBeNull();
    expect(container.querySelector(".error-card")).toBeNull();
  });
});
