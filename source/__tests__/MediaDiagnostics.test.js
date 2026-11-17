import React from "react";
import { render, screen } from "@testing-library/react";
import Media from "../Media";

it("renders Media upload errors using the shared card and treats messages as text", () => {
  const media = new Media({});
  media.state.errors = ["Failed to upload <img src=x onerror=alert(1)>"];
  const { container } = render(media.render());
  const card = container.querySelector(".compiler-diagnostic-error");
  expect(card).not.toBeNull();
  expect(card).toHaveAttribute("role", "alert");
  expect(card).toHaveTextContent(
    "Failed to upload <img src=x onerror=alert(1)>",
  );
  expect(card.querySelector("img")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Media error: Upload failed" }),
  ).toBeInTheDocument();
});
