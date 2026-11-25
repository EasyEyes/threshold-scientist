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
    // The dialog is now a search field over the list; the words are the same.
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fonts",
        html: expect.stringContaining("No fonts found :("),
      }),
    );
  });

  it("names the sound button without the word folders", () => {
    const { getByRole } = render(
      <ResourceButton
        name="sound"
        listings={[
          { kind: "ready", names: ["speech.zip", "noise.zip"] },
          { kind: "ready", names: ["room.gainVTime.csv"] },
          { kind: "ready", names: [] },
          { kind: "ready", names: [] },
        ]}
        onRetry={jest.fn()}
      />,
    );

    const button = getByRole("button", { name: "3 sound files" });
    fireEvent.click(button);
    const { title, html } = Swal.fire.mock.calls[0][0];
    expect(title).toBe("Sound Files");
    expect(html).toContain("speech.zip");
    expect(html).toContain("room.gainVTime.csv");
    expect(html).not.toMatch(/folder/i);
  });

  it("lists the folders under Images too, and counts them", () => {
    const { getByRole } = render(
      <ResourceButton
        name="images"
        listing={{ kind: "ready", names: ["face.png"] }}
        folderListing={{ kind: "ready", names: ["faces.zip", "speech.zip"] }}
        onRetry={jest.fn()}
      />,
    );

    fireEvent.click(getByRole("button", { name: "3 images" }));
    const { title, html } = Swal.fire.mock.calls[0][0];
    expect(title).toBe("Images");
    expect(html).toContain("face.png");
    expect(html).toContain("faces.zip");
    expect(html).toContain("speech.zip");
  });

  it("says there are no images only when there are no folders either", () => {
    const { getByRole } = render(
      <ResourceButton
        name="images"
        listing={{ kind: "ready", names: [] }}
        folderListing={{ kind: "ready", names: [] }}
        onRetry={jest.fn()}
      />,
    );

    fireEvent.click(getByRole("button", { name: "0 image" }));
    expect(Swal.fire.mock.calls[0][0].html).toContain("No images found :(");
  });

  it("offers retry for images when the folders could not be loaded", () => {
    const onRetry = jest.fn();
    const { getByRole } = render(
      <ResourceButton
        name="images"
        listing={{ kind: "ready", names: ["face.png"] }}
        folderListing={{ kind: "failed", error: new Error("403") }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Retry images" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
  });
});
