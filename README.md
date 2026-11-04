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
- Section duplication and pointer/keyboard drag handles. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y undo/redo workspace changes outside text fields; text fields retain native editing shortcuts.
- Styler's presets, initial Rosewater design, local Joker/Harlequin and four AI expressions. Whole-page or selected-component scope. Declaration editing and generation locks. Explicit preview, apply/discard, undo/redo.
- A persistent CSS inspector with computed browser values, bounded declaration addition/edit/reset/delete, Lock and generation-only Unset. Independent Inspire/Clear controls. Up to 50 named saved styles travel with the workspace JSON and survive reload and additive import.
- Shared Brand controls: four curated themes, editable palette, heading font and corners. Preview before applying to the current page or all existing and future pages. Content, component styles and borders are retained.
- The copied Border Image editor: samples, upload, crop, slice/width/outset/repeat controls and AI assistance. Its explicit handoff embeds the rasterized source in the workspace, then requires Apply.
- Border drafts stay available when switching tools. Load an applied border back into the editor, including after reopening a project. Handoffs preserve original dimensions and transparency; images exceeding the embedded-source limit are rejected with a visible error.
- Website and Markdown imports: review detected colors and source evidence, preview a website style on the current page, then apply or discard. Review and select webpage/Markdown text and tables before adding them to a visual block page. Existing content remains intact; imports are undoable.
- One locally autosaved workspace. Download/reopen `.frontender.json` files. Import by replacing with confirmation or adding pages without removing current work.
- Screenshot references alongside each page. Standalone HTML/CSS/JavaScript website ZIP export with linked pages and demo forms.
- Reviewed Formlane AI content proposals and the existing voice conversation UI. Voice offers guidance; it does not inspect or modify the workspace.

## Editing and export boundaries

HTML/CSS can be pasted through **Code**. Saving HTML for a block page explicitly converts it to an HTML page; Undo restores the visual block model. Imported scripts and embedded frames are removed. Styles may be applied to whole pages or selected components. Screenshots are visual references, not automatic screenshot-to-code inputs.

Standalone export includes a page snapshot, embedded CSS and border images, navigation, and local demo interactions. It is a prototype: forms do not send messages, shops do not process payments, and no backend or AI keys are included. External image URLs in imported HTML still require a connection. Reopen the JSON project to continue editing in Frontender; the website ZIP is for viewing/hosting the result.

The active workspace uses browser localStorage, with a visible error if its quota is exceeded. Screenshot uploads are limited to 2.5 MB; project import is limited to 16 MB and 40 pages. Download project files for durable backups. This MVP has no accounts, cloud sync, automatic project-version merging or React-project export.

Use **Import → Import website / Markdown** for public HTTPS website styles/content or locally parsed Markdown. Imported styles affect the current page, replacing its page-wide Styler layer while keeping component layers and borders. Optional brand renaming changes the workspace name. Content imports append selected sections to visual block pages (24 sections maximum); HTML/contact-form pages can still review and download Markdown. Applied imported palettes and source evidence travel in project JSON. Border drafts last for the current session; only applied borders are autosaved. Embedded border images use full-resolution PNG, limited to 4,000,000 data-URL characters.

In Styler, edits and locks stage a preview; **Apply to design** commits it. **Unset** only excludes a declaration from future generation, while **Delete** removes it from the current style. The inspector stays available after Apply. Computed values come from representative elements in the selected scope; unsupported browser values remain visible but cannot be locked until entered in a supported format. **Save style** saves the current bounded declaration style, including locks, without applying it. Saved styles are part of this workspace, not a separate project library. Inspiration, generation constraints and unapplied previews are session-only. Generation remains manual.

**Brand** previews a shared name and theme. Applying to all pages sets the theme for new pages too. It replaces page-wide Styler layers on the chosen pages; component layers, borders, custom CSS and content remain. A content-only AI proposal preserves manually edited brand colors.

## Checks

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge and a dedicated local server on port 5181. They cover preview/apply/undo, editing and reload, scoped styles, border handoff, HTML isolation, project round-trips, downloads and responsive layout. Provider requests are tested separately from offline/browser behavior; a passing local build is not proof of live AI or microphone functionality.

The production frontend builds to `dist/`. Frontender is deployed at [szlaci3-frontender.netlify.app](https://szlaci3-frontender.netlify.app/) (reported by the owner on 3 November 2026). `netlify.toml` builds the frontend and packages the website style/content import functions. The other AI/voice routes still have local development adapters; this change does not add their production deployment. See [architecture](docs/architecture.md) and [verification](docs/verification.md) for verified behavior and remaining scope.
