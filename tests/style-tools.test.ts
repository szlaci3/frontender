import { describe, it, expect } from "vitest";
import {
  editDeclaration,
  emptyStyle,
  visibleStyle,
  setLock,
  savedStyle,
  normalizeValue,
} from "../src/style-tools";
import { constrainStyle } from "../vendor/styler/shared/constraints";
import {
  createWorkspace,
  createPage,
  mergeWorkspace,
  parseWorkspace,
} from "../src/workspace";
import { duplicateBlock, removeBlock, moveBlock } from "../src/blocks";
import { applyBrand } from "../src/brand";
import { presets } from "../vendor/styler/src/styles/presets";

describe("style editing and portable presets", () => {
  it("locks edits without mutating presets, and keeps Unset limited to generation", () => {
    const edited = editDeclaration(presets[0], "page", "color", "#123456");
    const locks = setLock([], "page", "color", "#654321");
    expect(
      visibleStyle(edited, locks).rules.find((r) => r.selectorId === "page")
        ?.declarations,
    ).toContainEqual({ id: "page:color", property: "color", value: "#654321" });
    const unset = [
      { selectorId: "page", property: "color", state: "unset" },
    ] as const;
    expect(visibleStyle(edited, unset)).toEqual(edited);
    expect(
      constrainStyle(edited, unset)
        .rules.find((r) => r.selectorId === "page")
        ?.declarations.some((d) => d.property === "color"),
    ).toBe(false);
    expect(
      editDeclaration(edited, "page", "color")
        .rules.find((r) => r.selectorId === "page")
        ?.declarations.some((d) => d.property === "color"),
    ).toBe(false);
    expect(() =>
      editDeclaration(edited, "page", "color", "url(https://example.com)"),
    ).toThrow();
  });
  it("normalizes bounded browser values without accepting unsupported CSS", () => {
    expect(normalizeValue("color", "rgb(12, 34, 56)")).toBe("#0c2238");
    expect(normalizeValue("line-height", "24px", "16px")).toBe("1.5");
    expect(normalizeValue("padding-top", "1000px")).toBeUndefined();
  });
  it("round-trips and merges saved styles without identifier collisions or losing existing styles", () => {
    const w = createWorkspace();
    w.savedStyles = [
      savedStyle(
        editDeclaration(emptyStyle, "page", "color", "#123456"),
        "My style",
      ),
    ];
    expect(parseWorkspace(JSON.stringify(w))).toEqual(w);
    const merged = mergeWorkspace(w, w);
    expect(merged.savedStyles).toHaveLength(2);
    expect(merged.savedStyles![0]).toEqual(w.savedStyles[0]);
    expect(merged.savedStyles![1].id).not.toBe(w.savedStyles[0].id);
    expect(() =>
      parseWorkspace(
        JSON.stringify({
          ...w,
          savedStyles: [w.savedStyles![0], w.savedStyles![0]],
        }),
      ),
    ).toThrow();
    expect(() => savedStyle(emptyStyle, "<script>bad</script>")).toThrow();
  });
});
describe("shared brand and structural editing", () => {
  it("changes chosen pages, keeps component layers, and gives new pages the shared theme", () => {
    const w = createWorkspace();
    w.pages.push(createPage("html"));
    w.pages[0].styles = [
      { target: "page", style: presets[0] },
      { target: w.pages[0].blocks[0].id, style: presets[1] },
    ];
    const draft = {
      name: "North",
      theme: { preset: "tide", font: "sans", radius: 18 } as const,
      allPages: false,
    };
    const one = applyBrand(w, draft);
    expect(one.pages[1]).toEqual(w.pages[1]);
    expect(one.pages[0].styles).toEqual([w.pages[0].styles[1]]);
    const all = applyBrand(w, { ...draft, allPages: true });
    expect(all.pages.every((p) => p.builderTheme?.preset === "tide")).toBe(
      true,
    );
    expect(createPage("blog", all.brandTheme).builderTheme).toEqual(
      draft.theme,
    );
    expect(parseWorkspace(JSON.stringify(all)).brandTheme).toEqual(draft.theme);
    expect(w.pages[0].styles).toHaveLength(2);
  });
  it("duplicates nested board IDs and scoped styles, moves safely, and removes scoped layers", () => {
    const page = createPage("kanban");
    const board = page.blocks.find((b) => b.type === "board")!;
    page.styles = [{ target: board.id, style: presets[0] }];
    const next = duplicateBlock(page, board.id);
    const copy =
      next.blocks[next.blocks.findIndex((b) => b.id === board.id) + 1];
    expect(copy.id).not.toBe(board.id);
    if (copy.type !== "board" || board.type !== "board")
      throw Error("Expected boards");
    expect(copy.columns[0].id).not.toBe(board.columns[0].id);
    expect(copy.columns[0].cards[0].id).not.toBe(board.columns[0].cards[0].id);
    expect(next.styles.at(-1)?.target).toBe(copy.id);
    expect(moveBlock(next, "missing", 0)).toBe(next);
    expect(moveBlock(next, copy.id, 0).blocks[0].id).toBe(copy.id);
    expect(removeBlock(next, copy.id).styles).toEqual(page.styles);
  });
});
