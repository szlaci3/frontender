import { useEffect, useMemo, useRef } from "react";
import type { Page, Workspace } from "./workspace";
import { documentHTML } from "./design";
export function Preview({
  workspace,
  page,
  select,
  onPage,
  selected = "",
  css = "",
  mobile = false,
}: {
  workspace: Workspace;
  page: Page;
  select?: (id: string, label: string) => void;
  onPage: (id: string) => void;
  selected?: string;
  css?: string;
  mobile?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(
    () =>
      documentHTML(workspace, page, {
        editing: !!select,
        previewCSS: css,
        selected,
      }),
    [workspace, page, !!select, css, selected],
  );
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        !e.data ||
        typeof e.data !== "object"
      )
        return;
      if (
        e.data.type === "frontender:select" &&
        typeof e.data.id === "string" &&
        /^[\w-]{1,80}$/.test(e.data.id)
      )
        select?.(e.data.id, String(e.data.label).slice(0, 80));
      if (
        e.data.type === "frontender:navigate" &&
        workspace.pages.some((p) => p.id === e.data.page)
      )
        onPage(e.data.page);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [select, onPage, workspace]);
  return (
    <iframe
      ref={frame}
      title="Design preview"
      className={`design-frame ${mobile ? "mobile" : ""}`}
      sandbox="allow-scripts allow-forms"
      srcDoc={doc}
    />
  );
}
