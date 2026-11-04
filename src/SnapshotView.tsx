import { useEffect, useState } from "react";
import { Dialog } from "../vendor/formlane/src/components/Dialog";
import { Preview } from "./Preview";
import { readSnapshot, snapshotLink } from "./snapshot";
import type { Workspace } from "./workspace";

export function SnapshotDialog({
  workspace,
  close,
}: {
  workspace: Workspace;
  close: () => void;
}) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    snapshotLink(workspace).then(
      (url) => {
        if (active) setLink(url);
      },
      (error) => {
        if (active) setMessage(error.message);
      },
    );
    return () => {
      active = false;
    };
  }, [workspace]);
  return (
    <Dialog title="Share snapshot" close={close}>
      <p>
        Anyone with this link can view the applied design and browse its pages.
        Changes you make later do not update the link.
      </p>
      {link ? (
        <>
          <label className="snapshot-link">
            Snapshot link
            <input
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button
            className="wide-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Link copied.");
              } catch {
                setMessage("Select the link above and copy it manually.");
              }
            }}
          >
            Copy link
          </button>
          <p>
            <a href={link} target="_blank" rel="noopener noreferrer">
              Open snapshot
            </a>
          </p>
        </>
      ) : (
        !message && <p role="status">Preparing link…</p>
      )}
      {message && <p role={link ? "status" : "alert"}>{message}</p>}
    </Dialog>
  );
}

export function SnapshotViewer({ hash }: { hash: string }) {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [pageId, setPageId] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    readSnapshot(hash).then(
      (design) => {
        if (active) setWorkspace(design);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [hash]);
  const page = workspace?.pages.find(
    (p) => p.id === (pageId || workspace.activePage),
  );
  return (
    <main className="snapshot-viewer">
      <header>
        <strong>{workspace?.name ?? "Frontender snapshot"}</strong>
        <span>View-only snapshot</span>
        <a href={location.pathname}>Open Frontender</a>
      </header>
      {workspace && page ? (
        <Preview
          key={page.id}
          workspace={workspace}
          page={page}
          onPage={setPageId}
        />
      ) : failed ? (
        <p role="alert">
          This snapshot link is invalid or incomplete. Ask the sender for a new
          link.
        </p>
      ) : (
        <p role="status">Opening snapshot…</p>
      )}
    </main>
  );
}
