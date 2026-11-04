import { z } from "zod";
import {
  customThemeSchema,
  styleImportSchema,
  paletteSchema,
} from "../vendor/formlane/src/theme";
import {
  blockSchema,
  createProject,
  type PageId,
} from "../vendor/formlane/src/model";
import { parseStyle, type Style } from "../vendor/styler/shared/style";
import { parseSettings, type Settings } from "../vendor/border/shared/border";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const image = z
  .string()
  .max(4000000)
  .refine(
    (v) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Use an embedded PNG, JPEG or WebP image.",
  );
const style = z.unknown().transform((v, ctx): Style => {
  try {
    return parseStyle(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid style" });
    return z.NEVER;
  }
});
const border = z.object({
  target: id,
  source: image,
  settings: z.unknown().transform((v, ctx): Settings => {
    try {
      return parseSettings(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid border" });
      return z.NEVER;
    }
  }),
});
export const themeSchema = z.object({
  preset: z.enum(["grove", "atelier", "tide", "mono"]),
  font: z.enum(["serif", "sans"]),
  radius: z.number().int().min(0).max(24),
  custom: customThemeSchema.optional(),
  palette: paletteSchema.optional(),
});
export type Theme = z.infer<typeof themeSchema>;
export const pageSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum([
    "webshop",
    "kanban",
    "table",
    "blog",
    "social",
    "dashboard",
    "form",
    "html",
  ]),
  blocks: z.array(blockSchema).max(24),
  html: z.string().max(500000),
  css: z.string().max(200000),
  styles: z.array(z.object({ target: id, style })).max(100),
  borders: z.array(border).max(50),
  reference: image.optional(),
  importedStyle: styleImportSchema.optional(),
  builderTheme: themeSchema.optional(),
});
export const workspaceSchema = z
  .object({
    format: z.literal("frontender"),
    version: z.literal(1),
    name: z.string().trim().min(1).max(80),
    activePage: id,
    pages: z.array(pageSchema).min(1).max(40),
    savedStyles: z.array(style).max(50).optional(),
    brandTheme: themeSchema.optional(),
  })
  .superRefine((w, ctx) => {
    if (
      new Set(w.savedStyles?.map((s) => s.id)).size !==
      (w.savedStyles?.length ?? 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate saved style identifiers.",
      });
    if (
      new Set(w.pages.map((p) => p.id)).size !== w.pages.length ||
      !w.pages.some((p) => p.id === w.activePage)
    )
      ctx.addIssue({ code: "custom", message: "Invalid page identifiers." });
    for (const p of w.pages)
      if (new Set(p.blocks.map((b) => b.id)).size !== p.blocks.length)
        ctx.addIssue({ code: "custom", message: "Duplicate blocks." });
  });
export type Page = z.infer<typeof pageSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export const names = {
  webshop: "Webshop",
  kanban: "Kanban board",
  table: "Data table",
  blog: "Blog",
  social: "Social feed",
  dashboard: "Dashboard",
  form: "Contact form",
  html: "HTML / CSS",
};
export const newId = () => crypto.randomUUID();
export function createPage(kind: Page["kind"], theme?: Theme): Page {
  return {
    id: newId(),
    name: names[kind],
    kind,
    blocks:
      kind === "html" || kind === "form"
        ? []
        : createProject().pages[kind as PageId],
    html:
      kind === "form"
        ? '<section><span class="eyebrow">LET’S TALK</span><h1>A good idea starts with a conversation.</h1><p>Tell us what you have in mind.</p><form><label>Your name<input name="name" required autocomplete="name"></label><label>Email address<input type="email" name="email" required autocomplete="email"></label><label>Your message<textarea name="message" required rows="5"></textarea></label><button type="submit">Send message ↗</button><output aria-live="polite"></output></form><p class="form-note">Demo form: messages stay on this page and are not sent.</p></section>'
        : kind === "html"
          ? '<section><span class="eyebrow">A FRESH START</span><h1>Make something yours.</h1><p>Bring your HTML and CSS, or start with this little idea.</p><button type="button">Hello, possibility</button></section>'
          : "",
    css: "",
    styles: [],
    borders: [],
    ...(theme ? { builderTheme: structuredClone(theme) } : {}),
  };
}
export function createWorkspace(): Workspace {
  const page = createPage("webshop");
  return {
    format: "frontender",
    version: 1,
    name: "A little possibility",
    activePage: page.id,
    pages: [page],
  };
}
export function parseWorkspace(text: string): Workspace {
  if (text.length > 16000000)
    throw new Error("Project is too large (16 MB maximum).");
  return workspaceSchema.parse(JSON.parse(text));
}
export function mergeWorkspace(
  current: Workspace,
  incoming: Workspace,
): Workspace {
  if (current.pages.length + incoming.pages.length > 40)
    throw new Error("A workspace can contain up to 40 pages.");
  if (
    (current.savedStyles?.length ?? 0) + (incoming.savedStyles?.length ?? 0) >
    50
  )
    throw new Error(
      "A workspace can contain up to 50 saved styles. Remove unused saved styles before adding this project.",
    );
  const ids = new Map(incoming.pages.map((p) => [p.id, newId()]));
  const used = new Set(current.pages.map((p) => p.name));
  const pages = incoming.pages.map((p) => {
    let name = p.name;
    let n = 2;
    while (used.has(name)) name = `${p.name.slice(0, 65)} (${n++})`;
    used.add(name);
    let html = p.html;
    for (const [from, to] of ids)
      html = html
        .replaceAll(`page-${from}.html`, `page-${to}.html`)
        .replaceAll(`#page-${from}`, `#page-${to}`);
    return { ...p, id: ids.get(p.id)!, name, html };
  });
  return workspaceSchema.parse({
    ...current,
    pages: [...current.pages, ...pages],
    ...(current.savedStyles || incoming.savedStyles
      ? {
          savedStyles: [
            ...(current.savedStyles ?? []),
            ...(incoming.savedStyles ?? []).map((style) => ({
              ...style,
              id: current.savedStyles?.some((s) => s.id === style.id)
                ? `Saved_${newId()}`
                : style.id,
            })),
          ],
        }
      : {}),
  });
}
export type History = {
  past: Workspace[];
  present: Workspace;
  future: Workspace[];
};
export function history(
  state: History,
  action:
    { type: "set" | "replace"; value: Workspace } | { type: "undo" | "redo" },
): History {
  if (action.type === "replace")
    return { past: [], present: action.value, future: [] };
  if (action.type === "set")
    return {
      past: [...state.past, state.present].slice(-40),
      present: action.value,
      future: [],
    };
  if (action.type === "undo" && state.past.length)
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  if (action.type === "redo" && state.future.length)
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  return state;
}
export const STORAGE_KEY = "frontender.workspace.v1";
