// Explicit opt-in smoke check: one provider request, never part of npm test.
import { parseStyle } from "../vendor/styler/shared/style.ts";
const start = Date.now();
const response = await fetch("http://127.0.0.1:5180/api/styler/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "G900001",
    snapshot: [],
    expression: "Professional",
  }),
  signal: AbortSignal.timeout(105000),
});
const result = await response.json();
if (!response.ok) {
  console.log(
    JSON.stringify({
      ok: false,
      status: response.status,
      error: result.error,
      elapsedMs: Date.now() - start,
    }),
  );
  process.exitCode = 1;
} else {
  const style = parseStyle(result.style);
  console.log(
    JSON.stringify({
      ok: true,
      status: response.status,
      id: style.id,
      provenance: style.provenance,
      rules: style.rules.length,
      elapsedMs: Date.now() - start,
    }),
  );
}
