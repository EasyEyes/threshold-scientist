import React from "react";
import { createRoot } from "react-dom/client";
import { initSentry } from "./sentry";
initSentry();

import App from "./App.js";
import { fetchGlossary } from "./glossaryFetch";

const glossaryError = await fetchGlossary().then(() => null).catch((e) => e);

const root = createRoot(document.getElementById("root"));
root.render(<App initialGlossaryError={glossaryError} />);
