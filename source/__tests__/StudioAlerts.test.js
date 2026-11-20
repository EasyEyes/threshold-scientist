import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { AlertPanel } from "../studio/components/AlertPanel";
import { ResourcePanel } from "../studio/components/ResourcePanel";
import { userResourceStatus } from "../studio/resources";
import {
  readyResourceListings,
  settledResourceCatalog,
} from "../../threshold/preprocess/resourceCatalog";

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
  resourceCatalog: settledResourceCatalog(readyResourceListings()),
  signedIn: true,
  onAddFiles: jest.fn(),
  onRemoveFile: jest.fn(),
  onBrowseExisting: jest.fn(),
};

const catalogWithFailedFonts = () => {
  const listings = readyResourceListings();
  listings.fonts = { kind: "failed", error: new Error("403") };
  return settledResourceCatalog(listings);
};

describe("Studio resource status", () => {
  it("uses one local/remote/missing/unverified rule", () => {
    const needed = {
      kind: "font",
      filename: "Sloan.woff2",
      params: ["font"],
    };
    const ready = settledResourceCatalog(
      readyResourceListings({ fonts: ["Sloan.woff2"] }),
    );
    expect(userResourceStatus(needed, ready)).toBe("remote");
    expect(
      userResourceStatus({ ...needed, filename: "Other.woff2" }, ready),
    ).toBe("missing");
    expect(userResourceStatus(needed, ready, ["Sloan.woff2"])).toBe("local");

    const failed = catalogWithFailedFonts();
    expect(userResourceStatus(needed, failed)).toBe("unverified");
    expect(userResourceStatus(needed, failed, ["Sloan.woff2"])).toBe("local");
  });
});

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

  it("marks failed resource listings unverified and offers retry", () => {
    const onRetryResources = jest.fn();
    const { container, getByRole } = render(
      <ResourcePanel
        {...resourceProps}
        needed={[{ kind: "font", filename: "Sloan.woff2", params: ["font"] }]}
        compilerErrors={[]}
        resourceCatalog={catalogWithFailedFonts()}
        onRetryResources={onRetryResources}
      />,
    );

    expect(container.querySelector("li.unverified")).not.toBeNull();
    expect(container.querySelector("li.missing")).toBeNull();
    fireEvent.click(getByRole("button", { name: "Retry" }));
    expect(onRetryResources).toHaveBeenCalledTimes(1);
  });
});
