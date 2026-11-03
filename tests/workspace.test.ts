import { describe, it, expect } from "vitest";
import {
  createPage,
  createWorkspace,
  mergeWorkspace,
  parseWorkspace,
  history,
  workspaceSchema,
} from "../src/workspace";
import { presets } from "../vendor/styler/src/styles/presets";
describe("portable workspace", () => {
  it("replacement clears the previous workspace history", () => {
    const old = createWorkspace(),
      next = createWorkspace();
    const result = history(
      { past: [old], present: old, future: [old] },
      { type: "replace", value: next },
    );
    expect(result).toEqual({ past: [], present: next, future: [] });
  });
  it("round-trips all seven templates and HTML, styles and embedded references", () => {
    const w = createWorkspace();
    w.pages = [
      "webshop",
      "kanban",
      "table",
      "blog",
      "social",
      "dashboard",
      "form",
      "html",
    ].map((k) => createPage(k as any));
    w.activePage = w.pages[0].id;
    w.pages[0].styles = [{ target: "page", style: presets[0] }];
    w.pages[0].reference = "data:image/png;base64,YQ==";
    expect(parseWorkspace(JSON.stringify(w))).toEqual(w);
  });
  it("adds pages without replacing or mutating current work and rewrites internal links", () => {
    const w = createWorkspace();
    const other = structuredClone(w);
    other.pages[0].html = `<a href="page-${other.pages[0].id}.html">Next</a>`;
    const merged = mergeWorkspace(w, other);
    expect(merged.pages).toHaveLength(2);
    expect(merged.pages[0]).toEqual(w.pages[0]);
    expect(merged.pages[1].name).toBe("Webshop (2)");
    expect(merged.pages[1].id).not.toBe(w.pages[0].id);
    expect(merged.pages[1].html).toContain(`page-${merged.pages[1].id}.html`);
    expect(w.pages).toHaveLength(1);
  });
  it("rejects invalid IDs, unknown versions, duplicate pages and malicious references", () => {
    const w = createWorkspace();
    expect(() => parseWorkspace("{")).toThrow();
    expect(() => workspaceSchema.parse({ ...w, version: 2 })).toThrow();
    expect(() =>
      workspaceSchema.parse({ ...w, activePage: "missing" }),
    ).toThrow();
    expect(() =>
      workspaceSchema.parse({ ...w, pages: [w.pages[0], w.pages[0]] }),
    ).toThrow();
    expect(() =>
      workspaceSchema.parse({
        ...w,
        pages: [{ ...w.pages[0], reference: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });
  it("rejects oversized files and merges without partial modification", () => {
    expect(() => parseWorkspace(" ".repeat(16000001))).toThrow();
    const w = createWorkspace();
    for (let i = 1; i < 40; i++) w.pages.push(createPage("form"));
    expect(() => mergeWorkspace(w, createWorkspace())).toThrow();
    expect(w.pages).toHaveLength(40);
  });
  it("undoes and redoes styles, page changes and imports as immutable snapshots", () => {
    const w = createWorkspace();
    let s = { past: [], present: w, future: [] } as Parameters<
      typeof history
    >[0];
    const next = {
      ...w,
      pages: [
        { ...w.pages[0], styles: [{ target: "page", style: presets[1] }] },
      ],
    };
    s = history(s, { type: "set", value: next });
    expect(history(s, { type: "undo" }).present).toEqual(w);
    s = history(history(s, { type: "undo" }), { type: "redo" });
    expect(s.present).toEqual(next);
    expect(w.pages[0].styles).toEqual([]);
  });
});
