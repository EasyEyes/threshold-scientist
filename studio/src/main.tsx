import { createRoot } from "react-dom/client";
import "./glossary"; // must initialize the glossary registry before anything validates
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
