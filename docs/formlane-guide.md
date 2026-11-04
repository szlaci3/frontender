# Frontender product guide

Frontender is a local-first design workspace with three tabs: Formlane, Styler and Border Image. Users may begin anywhere. One workspace contains up to 40 linked pages. There is no project library, account, cloud sync or compulsory sequence.

## Create and edit

Use Add a page or Browse templates for Webshop, Kanban board, Data table, Blog, Social feed, Dashboard, Contact form or HTML/CSS. The first six use Formlane visual blocks: click text to edit, add sections, move or remove selected sections, edit products, table rows and Kanban cards. Contact forms and general HTML pages use the Code editor. Saving HTML on a visual block page converts it; Undo restores the prior version. Preview lets users try page navigation and local demo forms. Forms do not send data.

## Styles

Open Styler at any time. Choose Whole page or Selected component. To select a component, click it in the preview while not in Preview mode. Choose a preset or Generate variations. Every variation is a preview until Apply to design. Discard cancels it; Undo and Redo are available. Generated styles include local Joker and Harlequin plus four AI expressions. There is no automatic generation or automatic application. Declaration editing validates a bounded CSS vocabulary. Lock declarations to preserve them in future generated variations.

The CSS inspector remains available after applying a style. It shows computed values from representative elements in the current scope. Edit a value or add a supported declaration with the plus button; edits lock the value and stage a preview. Reset restores the declaration's starting value, and Delete removes it from the current style. Lock preserves the value across style choices and future generations. Unset only tells future generations to omit the declaration; it does not remove it from the current preview. Unsupported computed values are displayed but cannot be locked as-is. Page/target changes clear the session constraints.

Each style has an Inspire button independent of selecting it for preview. Clear inspiration removes it. Generate variations explicitly captures the chosen inspiration and current constraints. Save style records the current bounded declaration style with its locks under a name, without applying it. Up to 50 saved styles persist inside the workspace and exported JSON; additive project import merges them. Delete saved style is undoable. Saved styles are not full-page snapshots. Unapplied previews, inspiration and generation constraints are session-only.

## Shared brand and editing shortcuts

Brand opens four themes (Grove, Atelier, Tide, Mono), palette colors, serif/sans headings, corner radius, and a shared brand name. Choose the current page or all existing and future pages, then Preview brand. Apply to design commits the choice in one undoable change; Discard cancels. Page-wide Styler layers on those pages are replaced while component layers, borders, custom CSS and content remain. New pages inherit the shared theme after an all-pages apply. Content-only AI proposals preserve manually edited palettes.

Visual block toolbars have duplication and drag handles. Drag with a pointer, or focus a handle and use Space to pick up, arrow keys to move and Space to drop (Escape cancels). Move buttons remain available. Duplicate sections receive new IDs, including products/board items, and retain scoped styles and borders. Outside text fields, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Text editing keeps native undo behavior.

## Optional borders

Border Image is an optional tool users open deliberately. It supports samples, PNG/JPEG/WebP uploads, crop, slice, width, outset, repeat and AI help. Choose a target in Styler first, then open Border Image. Preview border in workspace transfers the border to the current target as a preview. Apply to design commits it. A rasterized image is embedded in the project and exported website.

Switching tools retains the current border editor session, including its draft and conversation. Load applied border explicitly opens the selected target's saved image/settings, replacing the editor draft; it also works after reopening a project. Only applied borders survive reload. Workspace handoffs retain original dimensions and transparency using PNG; images above 4,000,000 data-URL characters must be cropped or replaced with a smaller image. No silent image resizing is performed.

## Import and save

The workspace autosaves in this browser. Storage errors are visible; Save project downloads a JSON backup. Import a Frontender project to either add pages with unique names and IDs or replace the current workspace after confirmation. Export current work first before replacement. A screenshot can be attached as a visual reference; it is not automatically turned into code. Bring HTML/CSS adds a blank page; use Code to paste source. Imported scripts are removed.

Import → Import website / Markdown opens Visual style and Page content. Visual style reads a public HTTPS website, shows detected colors and source evidence, and lets the user adjust the palette, headings and corners. Preview on current page stages the style; Apply to design commits it, Discard cancels, and Undo restores the previous design. This replaces the current page's page-wide Styler layer but keeps component layers and borders. Optional brand renaming changes the workspace name. Other pages remain unchanged.

Page content reads a public URL or accepts Paste Markdown. Markdown parsing stays in the browser and makes no API or referenced-image requests. Search, filter and select text/table sections, inspect their previews, then add them to the current visual block page. Imports append content without removing existing sections, up to 24 total, in one undoable change. HTML/contact-form pages cannot receive visual blocks; choose a visual template first. Copy/download Markdown also works without adding content. Applied website palettes and their source evidence are included in saved project files.

## Export

Export website downloads a ZIP of standalone linked HTML pages with CSS and local demo JavaScript. Open index.html. This is a prototype, without checkout, form delivery, accounts or provider keys. Use the Frontender JSON project file, not the website ZIP, to restore editable work.

## AI and voice

Explore with AI on visual block pages shares the current page or selected section plus prompt with the configured Google provider. Proposed edits require review and explicit application. Styler generates validated styles. Border Image offers image-specific assistance. Errors are shown and retry is manual. Provider availability depends on server configuration.
Talk starts the existing Gemini voice interface after explicit user action and microphone permission. The voice assistant is a guide only: it cannot see the current workspace or make edits. It should explain Frontender controls and never claim it changed the page. No AI generation runs automatically at startup. Browser-local project files and screenshots are not automatically sent to a provider.
