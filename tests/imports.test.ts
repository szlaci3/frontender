import { describe, it, expect } from "vitest";
import { appendContent, withImportedStyle } from "../src/imports";
import {
  createPage,
  createWorkspace,
  parseWorkspace,
  history,
} from "../src/workspace";
import { importMarkdown } from "../vendor/formlane/src/markdown-import";
import { extractStyle } from "../vendor/formlane/server/extract-style";
import { presets } from "../vendor/styler/src/styles/presets";

describe("shared workspace imports", () => {
  it("adds selected content with fresh IDs while retaining content, styles, and undo", () => {
    const workspace = createWorkspace();
    const page = workspace.pages[0];
    page.styles = [{ target: "page", style: presets[0] }];
    const sections = importMarkdown(
      "# Notes\nSome text\n\n## Schedule\n| Who | When |\n| --- | --- |\n| Ada | Monday |",
      "",
    ).sections;
    const next = appendContent(page, sections);
    expect(next.blocks.slice(0, page.blocks.length)).toEqual(page.blocks);
    expect(next.styles).toEqual(page.styles);
    expect(next.blocks.slice(page.blocks.length).map((b) => b.id)).not.toEqual(
      sections.map((s) => s.id),
    );
    expect(page.blocks).not.toHaveLength(next.blocks.length);
    const updated = { ...workspace, pages: [next] };
    expect(parseWorkspace(JSON.stringify(updated))).toEqual(updated);
    const changed = history(
      { past: [], present: workspace, future: [] },
      { type: "set", value: updated },
    );
    expect(history(changed, { type: "undo" }).present).toEqual(workspace);
  });
  it("rejects over-capacity and HTML destinations without mutation", () => {
    const page = createPage("blog");
    const sections = importMarkdown("# Notes\nSome text", "").sections;
    page.blocks = Array.from({ length: 24 }, (_, i) => ({
      ...sections[0],
      id: `b${i}`,
    }));
    expect(() => appendContent(page, sections)).toThrow("24-section");
    expect(page.blocks).toHaveLength(24);
    expect(() => appendContent(createPage("html"), sections)).toThrow(
      "visual block",
    );
  });
  it("preserves imported palette and evidence through JSON while retaining component layers", () => {
    const page = createPage("webshop");
    page.styles = [
      { target: "page", style: presets[0] },
      { target: page.blocks[0].id, style: presets[1] },
    ];
    const result = extractStyle(
      "<title>Studio</title><style>body{background:#ffffff;color:#222222}button{background:#663399;border-radius:12px}</style><h1>Studio</h1><button>Read</button>",
      "https://example.com",
      [],
    );
    const next = withImportedStyle(page, result);
    expect(next.styles).toEqual([page.styles[1]]);
    expect(page.styles).toHaveLength(2);
    expect(next.builderTheme?.custom?.accent).toBe(result.palette.accent);
    const w = { ...createWorkspace(), pages: [next], activePage: next.id };
    expect(parseWorkspace(JSON.stringify(w)).pages[0].importedStyle).toEqual(
      result,
    );
  });
});
