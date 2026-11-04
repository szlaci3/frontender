import { newId, type Page } from "./workspace";

export function moveBlock(page: Page, id: string, to: number): Page {
  const from = page.blocks.findIndex((b) => b.id === id);
  if (from < 0 || to < 0 || to >= page.blocks.length || from === to)
    return page;
  const blocks = [...page.blocks];
  const [block] = blocks.splice(from, 1);
  blocks.splice(to, 0, block);
  return { ...page, blocks };
}
export function duplicateBlock(page: Page, id: string): Page {
  const index = page.blocks.findIndex((b) => b.id === id);
  if (index < 0 || page.blocks.length >= 24) return page;
  const block = structuredClone(page.blocks[index]);
  block.id = newId();
  if (block.type === "products")
    block.items.forEach((item) => (item.id = newId()));
  if (block.type === "board")
    block.columns.forEach((column) => {
      column.id = newId();
      column.cards.forEach((card) => (card.id = newId()));
    });
  const blocks = [...page.blocks];
  blocks.splice(index + 1, 0, block);
  return {
    ...page,
    blocks,
    styles: [
      ...page.styles,
      ...page.styles
        .filter((s) => s.target === id)
        .map((s) => ({ ...s, target: block.id })),
    ],
    borders: [
      ...page.borders,
      ...page.borders
        .filter((b) => b.target === id)
        .map((b) => ({ ...b, target: block.id })),
    ],
  };
}
export function removeBlock(page: Page, id: string): Page {
  if (page.blocks.length <= 1) return page;
  return {
    ...page,
    blocks: page.blocks.filter((b) => b.id !== id),
    styles: page.styles.filter((s) => s.target !== id),
    borders: page.borders.filter((b) => b.target !== id),
  };
}
