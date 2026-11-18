import React from "react";
import { render } from "@testing-library/react";
import Media from "../Media";
import { makeAlert } from "../../threshold/preprocess/alerts";
import { alertValue } from "../../threshold/preprocess/alertHtml";

it("renders Media outcomes with AlertCard and escapes filenames", () => {
  const media = new Media({});
  media.state.alerts = [
    makeAlert({
      context: "media",
      name: "Upload failed",
      message: `Failed to upload ${alertValue(
        "<img src=x onerror=alert(1)>",
      )}.`,
    }),
  ];
  const { container } = render(media.render());
  const card = container.querySelector(".alert-card-error");
  expect(card).not.toBeNull();
  expect(card).toHaveAttribute("role", "alert");
  expect(card).toHaveTextContent(
    "Failed to upload <img src=x onerror=alert(1)>.",
  );
  expect(card.querySelector("img")).toBeNull();
  expect(card.querySelector("h2")).toHaveTextContent("Upload failed");
});
