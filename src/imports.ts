import type { ContentSection } from "../vendor/formlane/src/content";
import {
  styleImportSchema,
  type StyleImport,
} from "../vendor/formlane/src/theme";
import { newId, pageSchema, type Page } from "./workspace";

export function appendContent(page: Page, sections: ContentSection[]): Page {
  if (page.kind === "html" || page.kind === "form")
    throw new Error("Choose a visual block page to add editable sections.");
  if (!sections.length || page.blocks.length + sections.length > 24)
    throw new Error("Choose sections that fit the page’s 24-section limit.");
  return pageSchema.parse({
    ...page,
    blocks: [
      ...page.blocks,
      ...sections.map((section) => ({
        ...structuredClone(section),
        id: newId(),
      })),
    ],
  });
}

export function withImportedStyle(page: Page, input: StyleImport): Page {
  const result = styleImportSchema.parse(input);
  return {
    ...page,
    builderTheme: {
      preset: page.builderTheme?.preset ?? "grove",
      font: result.font,
      radius: result.radius,
      custom: { ...result.palette, source: result.source },
    },
    importedStyle: result,
    styles: page.styles.filter((layer) => layer.target !== "page"),
  };
}
