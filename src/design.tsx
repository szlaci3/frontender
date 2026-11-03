import { renderToStaticMarkup } from "react-dom/server";
import DOMPurify from "dompurify";
import { zipSync, strToU8 } from "fflate";
import { BlockContent } from "../vendor/formlane/src/components/Blocks";
import { themePresets, type PageId } from "../vendor/formlane/src/model";
import type { Style, SelectorId } from "../vendor/styler/shared/style";
import { css as borderCSS } from "../vendor/border/shared/border";
import type { Page, Workspace } from "./workspace";
import formCSS from "../vendor/formlane/src/styles.css?inline";
import templateCSS from "../vendor/formlane/src/templates.css?inline";
import { interactionRuntime } from "./export-runtime";

export const baseCSS =
  formCSS.replace(/@font-face\s*\{[^}]*\}/g, "") +
  "\n" +
  templateCSS +
  `
*{box-sizing:border-box}body{margin:0;background:#f5f5ed;color:#30382d;font-family:Arial,sans-serif}.fe-page{--brand-accent:#536b48;--brand-surface:#f5f5ed;--brand-ink:#30382d;--brand-soft:#e6ebde;--brand-font:Georgia,serif;--brand-radius:12px;background:var(--brand-surface);color:var(--brand-ink);min-height:100%;padding:28px}.fe-page h1{font:48px/1.1 Georgia,serif;max-width:720px}.fe-page p{line-height:1.7}.fe-page form{display:grid;gap:18px;max-width:540px;margin:30px 0}.fe-page label{display:grid;gap:8px}.fe-page input,.fe-page textarea,.fe-page select{font:inherit;padding:13px;border:1px solid #b8c5b3;border-radius:6px;background:#fff;width:100%;color:#30382d}.fe-page button{cursor:pointer}.fe-page form button{padding:14px;background:#354e40;color:white;border:0;border-radius:6px}.fe-page .form-note{font-size:12px}.fe-nav{display:flex;align-items:center;flex-wrap:wrap;gap:18px;padding:20px 28px;border-bottom:1px solid #ccd3c7;background:#fafbf6;color:#30382d}.fe-nav a{color:inherit;text-decoration:none;font-size:13px}.fe-nav strong{margin-right:auto;font:24px Georgia,serif}.fe-block{position:relative}.fe-block + .fe-block{margin-top:24px}.fe-block[data-selected=true]{outline:2px solid #53795c;outline-offset:4px}.fe-page .hero-section{min-height:330px}.fe-page section{max-width:100%}img{max-width:100%}table{max-width:100%}.fe-page .table-scroll{overflow:auto} @media(max-width:600px){.fe-page{padding:18px}.fe-page h1{font-size:34px}.hero-section{display:block}.product-grid{grid-template-columns:1fr}.fe-nav{padding:14px}}
`;
const htmlBaseCSS = `*{box-sizing:border-box}body{margin:0;background:#f5f5ed;color:#30382d;font:16px/1.6 Arial,sans-serif}.fe-page{padding:32px;min-height:100vh}h1{font:48px/1.1 Georgia,serif;max-width:720px}p{line-height:1.7}form{display:grid;gap:18px;max-width:540px;margin:30px 0}label{display:grid;gap:8px}input,textarea,select{font:inherit;padding:12px;border:1px solid #b8c5b3;border-radius:6px;background:#fff;color:#30382d;width:100%}button{font:inherit;cursor:pointer;padding:12px 18px;background:#354e40;color:#fff;border:0;border-radius:6px}.eyebrow{font-size:11px;letter-spacing:1.4px}.form-note{font-size:12px}img{max-width:100%}.fe-nav{display:flex;align-items:center;flex-wrap:wrap;gap:18px;padding:20px 28px;border-bottom:1px solid #ccd3c7;background:#fafbf6;color:#30382d}.fe-nav a{color:inherit;text-decoration:none;font-size:13px}.fe-nav strong{margin-right:auto;font:24px Georgia,serif}@media(max-width:600px){.fe-page{padding:18px}h1{font-size:34px}}`;
const roles: Record<SelectorId, string> = {
  page: "",
  heading: "h1, .hero-title",
  accent: "h1 em, h2 em",
  copy: "p, .hero-description",
  button: "button, .prototype-cta",
  card: "article, .kanban-card, .kanban-column, .text-section, .table-section",
  input: "input, textarea, select",
  eyebrow: ".eyebrow",
  details: "small, label, figcaption, .product-category, .collection-detail",
  switch: "input:checked",
  subheading: "h2:not(.hero-title), h3",
  image: "img, .product-picture",
};
export function styleCSS(style: Style, target = "page") {
  const root = target === "page" ? ".fe-page" : `[data-fe-id="${target}"]`;
  return style.rules
    .map((rule) => {
      const selectors = roles[rule.selectorId];
      const selector = !selectors
        ? root
        : selectors
            .split(", ")
            .flatMap((s) => [`${root} :is(${s})`, `${root}:is(${s})`])
            .join(",");
      return `${selector}{${rule.declarations.map((d) => `${d.property}:${d.value} !important`).join(";")}}`;
    })
    .join("\n");
}
export function pageCSS(page: Page) {
  const theme = page.builderTheme
    ? (page.builderTheme.custom ?? themePresets[page.builderTheme.preset])
    : null;
  const themeCSS = theme
    ? `.fe-page{--brand-accent:${theme.accent};--brand-surface:${theme.surface};--brand-ink:${theme.ink};--brand-soft:${theme.soft};--brand-font:${page.builderTheme!.font === "serif" ? "Georgia,serif" : "Arial,sans-serif"};--brand-radius:${page.builderTheme!.radius}px}.fe-page h1{font-family:var(--brand-font)}`
    : "";
  return (
    themeCSS +
    (page.builderTheme?.custom
      ? `.fe-page{background:var(--brand-surface);color:var(--brand-ink)}.fe-page h1,.fe-page h2,.fe-page h3{font-family:var(--brand-font)}.fe-page button,.fe-page .prototype-cta{background:var(--brand-accent);color:#fff;border-radius:var(--brand-radius)}`
      : "") +
    "\n" +
    page.css +
    "\n" +
    page.styles.map((s) => styleCSS(s.style, s.target)).join("\n") +
    "\n" +
    page.borders
      .map((b) =>
        borderCSS(b.settings, b.source)
          .replaceAll(";\n", " !important;\n")
          .replace(
            ".framed-box",
            b.target === "page" ? ".fe-page" : `[data-fe-id="${b.target}"]`,
          ),
      )
      .join("\n")
  );
}
export function sanitizeHTML(input: string) {
  const clean = DOMPurify.sanitize(input, {
    FORBID_TAGS: [
      "style",
      "script",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base",
    ],
    FORBID_ATTR: ["srcdoc", "formaction", "action", "target"],
    ADD_ATTR: ["data-fe-id"],
    ALLOW_DATA_ATTR: true,
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  let i = 0;
  doc.body.querySelectorAll("*").forEach((el) => {
    el.setAttribute("data-fe-id", `element-${i++}`);
  });
  return doc.body.innerHTML;
}
export function pageMarkup(page: Page) {
  if (page.kind === "html" || page.kind === "form")
    return sanitizeHTML(page.html);
  return page.blocks
    .map(
      (block) =>
        `<div class="fe-block canvas-block" data-block-type="${block.type}" data-text-appearance="${block.type === "text" ? (block.appearance ?? "plain") : ""}" data-fe-id="${block.id}">${renderToStaticMarkup(<BlockContent block={block} update={() => {}} preview template={page.kind as PageId} />)}</div>`,
    )
    .join("\n");
}
export const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const safeStyle = (css: string) => css.replace(/<\/style/gi, "<\\/style");
export function documentHTML(
  workspace: Workspace,
  page: Page,
  {
    editing = false,
    previewCSS = "",
    selected = "",
    exported = false,
  }: {
    editing?: boolean;
    previewCSS?: string;
    selected?: string;
    exported?: boolean;
  } = {},
) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const navigation = workspace.pages
    .map(
      (p) =>
        `<a href="page-${p.id}.html" data-page="${p.id}" ${p.id === page.id ? 'aria-current="page"' : ""}>${escapeHTML(p.name)}</a>`,
    )
    .join("");
  const runtime =
    (editing ? "" : interactionRuntime) +
    `document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let o=f.querySelector('output');if(!o){o=document.createElement('output');f.append(o)}o.textContent='Demo complete. Your message has not been sent.'}));` +
    (!exported
      ? `document.querySelectorAll('[data-page]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();parent.postMessage({type:'frontender:navigate',page:a.dataset.page},'*')}));`
      : "") +
    (editing
      ? `document.querySelector('.fe-page').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const el=e.target.closest('[data-fe-id]');if(el)parent.postMessage({type:'frontender:select',id:el.dataset.feId,label:el.tagName.toLowerCase()+' · '+el.textContent.trim().slice(0,45)},'*')},true);`
      : "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; script-src 'nonce-${nonce}'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>${escapeHTML(page.name)} — ${escapeHTML(workspace.name)}</title><style>${safeStyle((page.kind === "html" || page.kind === "form" ? htmlBaseCSS : baseCSS) + "\n" + pageCSS(page) + "\n" + previewCSS + (selected ? `\n[data-fe-id="${selected}"]{outline:2px solid #c16d3e;outline-offset:3px}` : ""))}</style></head><body><nav class="fe-nav"><strong>${escapeHTML(workspace.name)}</strong>${navigation}</nav><main class="fe-page prototype-canvas ${page.kind === "dashboard" ? "dashboard-grid" : ""}" data-template="${page.kind}">${pageMarkup(page)}</main><script nonce="${nonce}">${runtime}</script></body></html>`;
}
export function exportWebsite(workspace: Workspace) {
  const files: Record<string, Uint8Array> = {};
  for (const page of workspace.pages)
    files[`page-${page.id}.html`] = strToU8(
      documentHTML(workspace, page, { exported: true }),
    );
  files["index.html"] = strToU8(
    documentHTML(workspace, workspace.pages[0], { exported: true }),
  );
  files["README.txt"] = strToU8(
    "Frontender standalone website\nOpen index.html. All pages include their CSS and navigation. Forms are local demonstrations and do not submit data. Editable builder controls and AI are not part of the exported website. Imported scripts are removed. External image URLs require an internet connection.",
  );
  return zipSync(files, { level: 6 });
}
export function download(
  data: BlobPart,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
