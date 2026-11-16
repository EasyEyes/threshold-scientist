import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { ErrorPanel } from "../studio/components/ErrorPanel";
import { ResourcePanel } from "../studio/components/ResourcePanel";

const diagnostic = {
  context: "preprocessor",
  kind: "warning",
  name: "Logging caution",
  message: "Logging is enabled.",
  hint: "Disable unnecessary logging.",
  parameters: ["_logTrialsBool"],
};

const resourceProps = {
  needed: [],
  compilerErrors: [diagnostic],
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

describe("Studio compiler warnings", () => {
  it("ErrorPanel uses the shared warning and preserves parameter jumping", () => {
    const onJump = jest.fn();
    const { container } = render(
      <ErrorPanel errors={[diagnostic]} onJump={onJump} />,
    );
    const item = container.querySelector("li.compiler-diagnostic-warning");
    expect(item).not.toBeNull();
    expect(item.querySelector(".error-name").textContent).toBe(
      "⚠️ Logging caution",
    );
    expect(item.querySelector(".error-hint").textContent).toContain(
      "Disable unnecessary logging.",
    );
    fireEvent.click(item);
    expect(onJump).toHaveBeenCalledWith("_logTrialsBool");
    const jump = item.querySelector("button.error-name");
    expect(jump).not.toBeNull();
    jump.focus();
    expect(jump).toHaveFocus();
    fireEvent.click(jump);
    expect(onJump).toHaveBeenCalledTimes(2);
  });

  it("ResourcePanel uses the same warning instead of its own orange card", () => {
    const { container } = render(<ResourcePanel {...resourceProps} />);
    const item = container.querySelector("li.compiler-diagnostic-warning");
    expect(item).not.toBeNull();
    expect(item.querySelector(".error-name").textContent).toBe(
      "⚠️ Logging caution",
    );
    expect(container.querySelector(".error-card")).toBeNull();
  });
});
