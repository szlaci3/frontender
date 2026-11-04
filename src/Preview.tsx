import { useEffect, useMemo, useRef } from "react";
import type { Page, Workspace } from "./workspace";
import { documentHTML } from "./design";
import { selectors, properties } from "../vendor/styler/shared/style";
export function Preview({
  workspace,
  page,
  select,
  onPage,
  selected = "",
  css = "",
  mobile = false,
  inspectionTarget,
  inspect,
  onHistory,
}: {
  workspace: Workspace;
  page: Page;
  select?: (id: string, label: string) => void;
  onPage: (id: string) => void;
  selected?: string;
  css?: string;
  mobile?: boolean;
  inspectionTarget?: string;
  inspect?: (values: Record<string, string>) => void;
  onHistory?: (action: "undo" | "redo") => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const inspectionToken = useMemo(
    () => crypto.randomUUID(),
    [workspace, page, css, selected, inspectionTarget],
  );
  const doc = useMemo(
    () =>
      documentHTML(workspace, page, {
        editing: !!select,
        previewCSS: css,
        selected,
        inspection: inspectionTarget
          ? { token: inspectionToken, target: inspectionTarget }
          : undefined,
      }),
    [
      workspace,
      page,
      !!select,
      css,
      selected,
      inspectionToken,
      inspectionTarget,
    ],
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
        e.data.type === "frontender:history" &&
        (e.data.action === "undo" || e.data.action === "redo")
      )
        onHistory?.(e.data.action);
      if (
        e.data.type === "frontender:inspection" &&
        e.data.token === inspectionToken &&
        e.data.values &&
        typeof e.data.values === "object" &&
        !Array.isArray(e.data.values)
      ) {
        const values: Record<string, string> = {};
        for (const selector of Object.keys(selectors))
          for (const property of Object.keys(properties)) {
            const key = `${selector}:${property}`;
            const value = e.data.values[key];
            if (typeof value === "string" && value.length <= 200)
              values[key] = value;
          }
        inspect?.(values);
      }
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
  }, [select, onPage, workspace, inspectionToken, inspect, onHistory]);
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
