# Frontender architecture

The owning application is `src/`. Reusable source was copied from Colombia, Styler and BorderImage into `vendor/formlane`, `vendor/styler` and `vendor/border`. These are independent copies, not symlinks or deployed-site embeds. The original repositories are not modified.

- `workspace.ts`: versioned, validated portable JSON, page creation, collision-safe merge, bounded undo/redo.
- `App.tsx`: shared shell and explicit handoffs. One active workspace; no project library or accounts.
- `design.tsx`: Formlane block rendering, semantic Styler selector adapter, sanitization, standalone ZIP export.
- `Preview.tsx`: sandboxed document preview and source-checked selection/navigation messages.
- `Shadow.tsx`: style isolation for trusted Formlane components and the optional copied Border Image editor.
- `vite.config.ts`: server-only API adapters; Styler and Border Image have separate endpoint namespaces. Existing provider implementations and validation remain in their copied modules.

Each page contains a template kind, editable blocks or HTML, custom CSS, applied style layers, embedded border sources, and an optional screenshot. Page IDs are immutable. A style targets the page or a component ID. HTML element IDs are deterministic within the parsed source; saving changed HTML clears component-specific layers because its structure may have changed. Existing page-wide styles remain.

Generated CSS never enters the outer application. User HTML is sanitized and rendered in an opaque-origin iframe. Only application-owned scripts run under a nonce-based CSP; form submissions and network API calls are blocked. The owned runtime demonstrates form submission locally. Trusted visual block editing runs in a ShadowRoot without imported custom CSS; Preview shows custom CSS and all applied effects.

Project files include content, style definitions, embedded border images and screenshots. Additive import creates new page IDs, unique names and remaps generated internal page links. It does not attempt text-level merging of two versions of a page. Replacement explicitly warns users to export existing work first. Browser storage failures are surfaced, and unreadable saved data is preserved until the user explicitly replaces it.

Extending the workspace: add a tool adapter that produces page changes or a pending preview; do not create a second persistence system. A new block type must have validation, editable rendering and standalone rendering. Imported HTML remains the general escape hatch.
