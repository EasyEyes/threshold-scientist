import React from "react";
import { createRoot } from "react-dom/client";
import { initSentry } from "./sentry";
initSentry();

import App from "./App.js";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
