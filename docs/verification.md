# Verification — 2 November 2026

## Passed locally

- `npm run build`: TypeScript and Vite production build.
- `npm test`: 6 workspace tests. Template/project round-trip, malformed data rejection, merge collision handling and navigation remapping, size/page limits, immutable undo/redo, replacement clearing prior history.
- `npm run test:e2e`: 9 Microsoft Edge tests. Editable content and autosave/reload; preview/apply/undo/redo; form validation and demo submission; safe HTML and custom CSS; JSON export/additive import; component styling; optional border handoff; mobile overflow; all templates; reviewed AI example; standalone ZIP navigation, Kanban moves and table sorting; mocked AI successes/failures with no automatic application; replacement confirmation/cancellation; server API validation and voice availability.
- Desktop and 390 px mobile screenshots inspected. Test screenshots are written to `test-results/`.
- `node tests/verify-build.mjs`: 8 production files scanned, no root server credential found in the frontend build.
- `git diff --check`: no whitespace errors in tracked changes (new source remains uncommitted).

## Live provider check

`node tests/live-styler.mjs` sent one valid Professional request through Frontender's local `/api/styler/generate` route using the existing server-side key. Result: HTTP 200, provenance `antigravity`, 12 validated selector groups, 22,735 ms. An earlier probe with an unsupported request ID was rejected locally with 400 before contacting the provider; the smoke script now uses the API's required ID format.

This verifies one real Styler request, not sustained availability, concurrency, quotas or every AI expression. The smoke check is explicit opt-in and is not part of the normal test suite.

## Not verified

- Real microphone input, voice playback, long voice sessions or live voice-token creation.
- Live Formlane AI content generation and Border Image AI requests. Their copied interfaces/routes are retained; Formlane proposal review is exercised with its built-in example, and Styler UI generation with mocked responses.
- Hosted deployment. This build is local; production server routes must be configured before deployment.

The original Colombia, Styler and BorderImage projects were only read/copied. No implementation writes, commits, pushes or deployments were made to them.
