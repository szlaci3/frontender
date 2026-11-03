# Frontender

Read README.md, docs/architecture.md and docs/verification.md before substantial changes. This is a combination project; all changes belong in Frontender. The original sibling Colombia, Styler and BorderImage repositories must remain unchanged.

The shared design session is intentionally non-sequential. Preserve one active workspace, linked pages, optional Border Image, explicit style preview/apply and undo. Replacement import requires a warning; additive import must preserve existing pages. Do not introduce a project library, accounts, automatic provider calls or deployment as a side effect of routine work.

Reusable source is copied into vendor/. Prefer the Frontender adapters for integration; edits to copied modules are allowed. Keep imported HTML/CSS in the sandbox and credentials on the server. Do not expose GEMINI_API_KEY through Vite browser variables.

Checks: npm test, npm run build, npm run test:e2e (installed Edge, test port 5181). npm run dev serves the local workspace at 127.0.0.1:5180. tests/live-styler.mjs makes a real provider request and is deliberately excluded from automatic tests. Clearly distinguish local, mocked, live-provider, microphone and deployed verification.
