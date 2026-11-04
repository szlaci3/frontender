import { themeSchema, type Theme, type Workspace } from "./workspace";

export type BrandDraft = { name: string; theme: Theme; allPages: boolean };
export function applyBrand(workspace: Workspace, draft: BrandDraft): Workspace {
  const theme = themeSchema.parse(draft.theme);
  return {
    ...workspace,
    name: draft.name.trim(),
    ...(draft.allPages ? { brandTheme: theme } : {}),
    pages: workspace.pages.map((page) =>
      draft.allPages || page.id === workspace.activePage
        ? {
            ...page,
            builderTheme: structuredClone(theme),
            importedStyle: undefined,
            styles: page.styles.filter((s) => s.target !== "page"),
          }
        : page,
    ),
  };
}
