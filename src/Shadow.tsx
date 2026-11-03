import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export function Shadow({
  css,
  children,
}: {
  css: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot>();
  useLayoutEffect(() => {
    setRoot(
      host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" }),
    );
  }, []);
  return (
    <div ref={host} className="shadow-host">
      {root &&
        createPortal(
          <>
            <style>{css}</style>
            {children}
          </>,
          root,
        )}
    </div>
  );
}
