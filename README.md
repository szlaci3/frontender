# Frontender

A local-first shared workspace combining Formlane, Styler and Border Image. Start in any tool, create multiple linked pages, bring HTML/CSS, and preview styles before applying them. All implementation changes live in this folder; the original projects remain unchanged.

## Run locally

Requires Node 24.10 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5180. The existing root `.env` is used only by the server. `GEMINI_API_KEY` enables the copied provider integrations; `FORMLANE_ASSISTANT_ENABLED` and `FORMLANE_VOICE_ENABLED` default to `true` locally and may be disabled explicitly. No paid generation is triggered on startup. Secrets are never exposed through Vite browser environment variables.

## Included

- Formlane's editable webshop, Kanban, data table, blog, social feed and dashboard blocks, plus HTML-based contact forms and blank HTML/CSS pages.
- Multiple named pages with shared navigation. Add/remove/reorder blocks; edit text, products, tables and Kanban cards using the original components.
- Styler's presets, initial Rosewater design, local Joker/Harlequin and four AI expressions. Whole-page or selected-component scope. Declaration editing and generation locks. Explicit preview, apply/discard, undo/redo.
- The copied Border Image editor: samples, upload, crop, slice/width/outset/repeat controls and AI assistance. Its explicit handoff embeds the rasterized source in the workspace, then requires Apply.
- One locally autosaved workspace. Download/reopen `.frontender.json` files. Import by replacing with confirmation or adding pages without removing current work.
- Screenshot references alongside each page. Standalone HTML/CSS/JavaScript website ZIP export with linked pages and demo forms.
- Reviewed Formlane AI content proposals and the existing voice conversation UI. Voice offers guidance; it does not inspect or modify the workspace.

## Editing and export boundaries

HTML/CSS can be pasted through **Code**. Saving HTML for a block page explicitly converts it to an HTML page; Undo restores the visual block model. Imported scripts and embedded frames are removed. Styles may be applied to whole pages or selected components. Screenshots are visual references, not automatic screenshot-to-code inputs.

Standalone export includes a page snapshot, embedded CSS and border images, navigation, and local demo interactions. It is a prototype: forms do not send messages, shops do not process payments, and no backend or AI keys are included. External image URLs in imported HTML still require a connection. Reopen the JSON project to continue editing in Frontender; the website ZIP is for viewing/hosting the result.

The active workspace uses browser localStorage, with a visible error if its quota is exceeded. Screenshot uploads are limited to 2.5 MB; project import is limited to 16 MB and 40 pages. Download project files for durable backups. This MVP has no accounts, cloud sync, automatic project-version merging or React-project export.

## Checks

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge and a dedicated local server on port 5181. They cover preview/apply/undo, editing and reload, scoped styles, border handoff, HTML isolation, project round-trips, downloads and responsive layout. Provider requests are tested separately from offline/browser behavior; a passing local build is not proof of live AI or microphone functionality.

The production frontend builds to `dist/`. This repository has not been deployed; its API adapters currently run with the local development server. A production host needs matching server routes. See [architecture](docs/architecture.md) and [verification](docs/verification.md).
