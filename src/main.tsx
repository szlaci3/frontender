import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./app.css";
import "../vendor/formlane/src/voice.css";
import "../vendor/formlane/src/assistant.css";
createRoot(document.getElementById("root")!).render(<App />);
