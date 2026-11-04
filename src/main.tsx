import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SnapshotViewer } from "./SnapshotView";
import "./app.css";
import "./imports.css";
import "../vendor/formlane/src/voice.css";
import "../vendor/formlane/src/assistant.css";
const root = createRoot(document.getElementById("root")!);
function render() {
  const hash = location.hash;
  root.render(
    hash.startsWith("#snapshot=") ? (
      <SnapshotViewer key={hash} hash={hash} />
    ) : (
      <App />
    ),
  );
}
window.addEventListener("hashchange", render);
render();
