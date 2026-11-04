import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowUpRight,
  Braces,
  ChevronRight,
  Download,
  FilePlus2,
  FolderOpen,
  Frame,
  Layers,
  LayoutTemplate,
  Monitor,
  Palette,
  Plus,
  Redo2,
  Smartphone,
  Sparkles,
  Undo2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import {
  SortableBlock,
  blockNames,
} from "../vendor/formlane/src/components/Blocks";
import {
  createBlock,
  createProject,
  type BlockType,
  type PageId,
} from "../vendor/formlane/src/model";
import { Dialog } from "../vendor/formlane/src/components/Dialog";
import { Assistant } from "../vendor/formlane/src/components/Assistant";
import { WebsiteImport } from "../vendor/formlane/src/components/WebsiteImport";
import type { StyleImport } from "../vendor/formlane/src/theme";
import { VoiceChat } from "../vendor/formlane/src/components/VoiceChat";
import type { VoiceMessage } from "../vendor/formlane/src/voice-protocol";
import { presets } from "../vendor/styler/src/styles/presets";
import { useGeneration } from "../vendor/styler/src/generation/useGeneration";
import {
  type Style,
  type Property,
  type SelectorId,
} from "../vendor/styler/shared/style";
import {
  parseSnapshot,
  toggleConstraint,
  type Snapshot,
} from "../vendor/styler/shared/constraints";
import { StyleInspector } from "./StyleInspector";
import {
  emptyStyle,
  declarationValue,
  editDeclaration,
  setLock,
  visibleStyle,
  savedStyle,
} from "./style-tools";
import { BrandDialog } from "./BrandDialog";
import { applyBrand, type BrandDraft } from "./brand";
import { moveBlock, duplicateBlock, removeBlock } from "./blocks";
import { BorderLab } from "../vendor/border/src/main";
import { loadImage, type Source } from "../vendor/border/src/images";
import { embedBorderSource } from "./border-source";
import { appendContent, withImportedStyle } from "./imports";
import { css as borderCSS } from "../vendor/border/shared/border";
import borderStyles from "../vendor/border/src/style.css?inline";
import {
  createPage,
  createWorkspace,
  history,
  mergeWorkspace,
  names,
  newId,
  parseWorkspace,
  workspaceSchema,
  STORAGE_KEY,
  type Page,
  type Workspace,
} from "./workspace";
import {
  baseCSS,
  pageCSS,
  download,
  exportWebsite,
  handoutHTML,
  pageMarkup,
} from "./design";
import { Preview } from "./Preview";
import { Shadow } from "./Shadow";
import { SnapshotDialog } from "./SnapshotView";

type Tab = "build" | "style" | "border";
type Pending = {
  style?: Style;
  baseline?: Style;
  baselineConstraints?: Snapshot;
  brand?: BrandDraft;
  border?: Page["borders"][number];
  importedStyle?: { result: StyleImport; brand: string | null };
  target: string;
};
function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      workspace: raw ? parseWorkspace(raw) : createWorkspace(),
      error: "",
    };
  } catch {
    return {
      workspace: createWorkspace(),
      error:
        "The saved workspace could not be opened. Your saved data has been kept. Export it below before starting a replacement.",
    };
  }
}
export function App() {
  const [initial] = useState(readSaved);
  const [state, dispatch] = useReducer(history, {
    past: [],
    present: initial.workspace,
    future: [],
  });
  const w = state.present;
  const page = w.pages.find((p) => p.id === w.activePage)!;
  const [tab, setTab] = useState<Tab>("build");
  const [modal, setModal] = useState<
    | "new"
    | "import"
    | "website"
    | "handout"
    | "snapshot"
    | "brand"
    | "code"
    | "assistant"
    | "voice"
    | null
  >(null);
  const [status, setStatus] = useState(
    initial.error || "Saved on this browser",
  );
  const [storageBlocked, setStorageBlocked] = useState(!!initial.error);
  const [selected, setSelected] = useState("");
  const [selectionLabel, setSelectionLabel] = useState("");
  const [scope, setScope] = useState<"page" | "component">("page");
  const [pending, setPending] = useState<Pending | null>(null);
  const [mobile, setMobile] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [imported, setImported] = useState<Workspace | null>(null);
  const [importError, setImportError] = useState("");
  const [code, setCode] = useState({ html: "", css: "" });
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [constraints, setConstraints] = useState<Snapshot>([]);
  const [inspiration, setInspiration] = useState<Style | null>(null);
  const [computed, setComputed] = useState<Record<string, string>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [borderOpened, setBorderOpened] = useState(false);
  const [borderEditor, setBorderEditor] = useState<{
    revision: number;
    initial?: { settings: Page["borders"][number]["settings"]; source: Source };
  }>({ revision: 0 });
  useEffect(() => {
    if (tab === "border") setBorderOpened(true);
  }, [tab]);
  const projectFile = useRef<HTMLInputElement>(null),
    referenceFile = useRef<HTMLInputElement>(null);
  const generation = useGeneration();
  useEffect(() => {
    if (storageBlocked) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
        setStatus("Saved on this browser");
      } catch {
        setStatus(
          "Browser storage is full or unavailable. Export your project to keep your work.",
        );
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [w, storageBlocked]);
  function commit(next: Workspace) {
    if (
      !workspaceSchema.safeParse(next).success ||
      JSON.stringify(next).length > 16000000
    ) {
      setStatus(
        "This change exceeds the workspace limits. Export your work or remove unused content.",
      );
      return false;
    }
    dispatch({ type: "set", value: next });
    return true;
  }
  function patchPage(patch: Partial<Page>) {
    return commit({
      ...w,
      pages: w.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)),
    });
  }
  function clearPreview() {
    setPending(null);
    setSelected("");
    setSelectionLabel("");
    setScope("page");
    setConstraints([]);
    setComputed({});
  }
  function navigateHistory(type: "undo" | "redo") {
    clearPreview();
    dispatch({ type });
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        modal ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return;
      if (
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof HTMLElement &&
              (node.matches("input,textarea,select") || node.isContentEditable),
          )
      )
        return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      navigateHistory(key === "y" || event.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [modal]);
  function openPage(id: string) {
    clearPreview();
    commit({ ...w, activePage: id });
  }
  function addPage(kind: Page["kind"]) {
    if (w.pages.length >= 40) {
      setStatus("The workspace has reached its 40-page limit.");
      return;
    }
    const p = createPage(kind, w.brandTheme);
    clearPreview();
    commit({ ...w, pages: [...w.pages, p], activePage: p.id });
    setModal(null);
    setTab("build");
  }
  const target = scope === "component" ? selected : "page";
  const currentStyle =
    pending?.style ??
    page.styles.find((s) => s.target === target)?.style ??
    emptyStyle;
  const effectiveStyle = useMemo(
    () => visibleStyle(currentStyle, constraints),
    [currentStyle, constraints],
  );
  function stageStyle(style: Style) {
    if (!target) return;
    setPending({
      style,
      target,
      baseline: pending?.baseline ?? currentStyle,
      baselineConstraints: pending?.baselineConstraints ?? constraints,
    });
  }
  function editStyle(selector: SelectorId, property: Property, value?: string) {
    stageStyle(editDeclaration(currentStyle, selector, property, value));
    setConstraints(
      value === undefined
        ? constraints.filter(
            (c) => c.selectorId !== selector || c.property !== property,
          )
        : setLock(constraints, selector, property, value),
    );
  }
  function resetDeclaration(selector: SelectorId, property: Property) {
    stageStyle(
      editDeclaration(
        currentStyle,
        selector,
        property,
        declarationValue(pending?.baseline ?? currentStyle, selector, property),
      ),
    );
    const previous = pending?.baselineConstraints?.find(
      (c) => c.selectorId === selector && c.property === property,
    );
    setConstraints(
      parseSnapshot([
        ...constraints.filter(
          (c) => c.selectorId !== selector || c.property !== property,
        ),
        ...(previous ? [previous] : []),
      ]),
    );
  }
  function changeConstraint(
    selector: SelectorId,
    property: Property,
    state: "locked" | "unset",
    value?: string,
  ) {
    try {
      const next = toggleConstraint(
        constraints,
        selector,
        property,
        state,
        value,
      );
      if (
        state === "locked" ||
        constraints.some(
          (c) =>
            c.selectorId === selector &&
            c.property === property &&
            c.state === "locked",
        )
      )
        stageStyle(currentStyle);
      setConstraints(next);
    } catch {
      setStatus(
        "That computed value is outside Styler’s supported CSS range. Enter a supported value to lock it.",
      );
    }
  }
  function saveStyle(name: string) {
    try {
      if ((w.savedStyles?.length ?? 0) >= 50) return false;
      return commit({
        ...w,
        savedStyles: [
          ...(w.savedStyles ?? []),
          savedStyle(effectiveStyle, name),
        ],
      });
    } catch {
      return false;
    }
  }
  const borderContext = useRef("");
  borderContext.current = `${page.id}:${target}`;
  const appliedBorder = page.borders.find((border) => border.target === target);
  function choose(style: Style) {
    if (!target) {
      setStatus("Select a component in the preview first.");
      return;
    }
    setPending({
      style,
      target,
      baseline: style,
      baselineConstraints: constraints,
    });
  }
  function apply() {
    if (!pending) return;
    if (pending.brand) {
      if (commit(applyBrand(w, pending.brand))) clearPreview();
      return;
    }
    if (pending.importedStyle) {
      const { result, brand } = pending.importedStyle;
      if (
        commit({
          ...w,
          name: brand ?? w.name,
          pages: w.pages.map((p) =>
            p.id === page.id ? withImportedStyle(p, result) : p,
          ),
        })
      ) {
        setPending(null);
        setStatus("Website style applied to this page. Undo is available.");
      }
      return;
    }
    const applied = patchPage(
      pending.style
        ? {
            styles: [
              ...page.styles.filter((s) => s.target !== pending.target),
              { target: pending.target, style: effectiveStyle },
            ],
          }
        : {
            borders: [
              ...page.borders.filter((b) => b.target !== pending.target),
              pending.border!,
            ],
          },
    );
    if (applied) {
      setPending(null);
      setStatus("Applied. Undo is available.");
    }
  }
  const previewWorkspace = useMemo(
    () => (pending?.brand ? applyBrand(w, pending.brand) : w),
    [w, pending?.brand],
  );
  const previewPage = useMemo(() => {
    const base = pending?.importedStyle
      ? withImportedStyle(page, pending.importedStyle.result)
      : previewWorkspace.pages.find((p) => p.id === page.id)!;
    return pending?.style
      ? {
          ...base,
          styles: [
            ...base.styles.filter((s) => s.target !== pending.target),
            { target: pending.target, style: effectiveStyle },
          ],
        }
      : base;
  }, [page, pending, previewWorkspace, effectiveStyle]);
  const previewCSS = pending?.border
    ? borderCSS(pending.border.settings, pending.border.source)
        .replaceAll(";\n", " !important;\n")
        .replace(
          ".framed-box",
          pending.target === "page"
            ? ".fe-page"
            : `[data-fe-id="${pending.target}"]`,
        )
    : "";
  const assistantProject = useMemo(() => {
    const p = createProject();
    p.name = w.name;
    p.brand = w.name.slice(0, 40);
    if (page.builderTheme) {
      const { palette: _palette, ...theme } = page.builderTheme;
      p.theme = theme;
    }
    if (page.kind !== "html" && page.kind !== "form")
      p.pages[page.kind] = page.blocks;
    return p;
  }, [w.name, page]);
  function exportProject() {
    download(
      JSON.stringify(w, null, 2),
      `${w.name.replace(/[^\w-]/g, "-") || "frontender"}.frontender.json`,
    );
  }
  function openCode() {
    setCode({
      html: page.html || pageMarkup(page),
      css: (page.blocks.length ? baseCSS + "\n" : "") + page.css,
    });
    setModal("code");
  }
  const tabs = [
    {
      id: "build",
      title: "Formlane",
      subtitle: "Create & compose",
      icon: LayoutTemplate,
    },
    {
      id: "style",
      title: "Styler",
      subtitle: "Explore the possibilities",
      icon: Palette,
    },
    {
      id: "border",
      title: "Border Image",
      subtitle: "A little extra detail",
      icon: Frame,
    },
  ] as const;
  return (
    <div className="app">
      <header className="topbar">
        <a href="#" className="wordmark" onClick={(e) => e.preventDefault()}>
          <span className="brand-symbol">
            f<span>↗</span>
          </span>
          frontender<span className="beta">WORKSPACE</span>
        </a>
        <div className="project-title">
          <input
            aria-label="Workspace name"
            maxLength={80}
            value={w.name}
            onChange={(e) => {
              if (e.target.value.trim()) commit({ ...w, name: e.target.value });
            }}
          />
          <span className="save-dot" title={status} />
        </div>
        <div className="top-actions">
          <button onClick={() => setModal("voice")}>
            <Volume2 size={16} />
            Talk
          </button>
          <button onClick={() => setModal("brand")}>
            <Palette size={16} />
            Brand
          </button>
          <button onClick={() => setModal("import")}>
            <FolderOpen size={16} />
            Import
          </button>
          <button onClick={exportProject}>
            <Download size={16} />
            Save project
          </button>
          <button onClick={() => setModal("handout")}>
            <Download size={16} />
            PDF handout
          </button>
          <button onClick={() => setModal("snapshot")}>
            <ArrowUpRight size={16} />
            Share snapshot
          </button>
          <button
            className="primary"
            onClick={() => {
              try {
                download(
                  exportWebsite(w) as BlobPart,
                  "frontender-website.zip",
                  "application/zip",
                );
                setStatus("Website exported with all pages.");
              } catch {
                setStatus(
                  "Website export failed. Save the project and try again.",
                );
              }
            }}
          >
            <ArrowUpRight size={16} />
            Export website
          </button>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">ONE WORKSPACE. MANY POSSIBILITIES.</span>
          <h1>
            Make it <em>yours.</em>
          </h1>
          <p>Start with an idea. Find its shape. Give it a style.</p>
        </div>
        <span className="workspace-note">
          <Layers size={19} />
          <span>
            Your tools, connected.
            <br />
            <strong>Your starting point, up to you.</strong>
          </span>
        </span>
      </div>
      <nav className="tool-tabs" aria-label="Design tools">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              setTab(t.id);
              setPreviewMode(false);
            }}
          >
            <t.icon size={20} />
            <span>
              <strong>{t.title}</strong>
              <small>{t.subtitle}</small>
            </span>
            {t.id === "border" && <span className="optional">OPTIONAL</span>}
            <ChevronRight size={16} />
          </button>
        ))}
      </nav>
      <div className="workbench">
        <aside className="page-sidebar">
          <div className="panel-title">
            <span>PAGES</span>
            <button aria-label="Add page" onClick={() => setModal("new")}>
              <Plus size={17} />
            </button>
          </div>
          <div className="page-list">
            {w.pages.map((p, i) => (
              <button
                key={p.id}
                className={page.id === p.id ? "current" : ""}
                onClick={() => openPage(p.id)}
              >
                <span className="page-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{p.name}</span>
                {page.id === p.id && <span className="tiny-dot" />}
              </button>
            ))}
          </div>
          <button className="add-page" onClick={() => setModal("new")}>
            <Plus size={15} />
            Add a page
          </button>
          <div className="sidebar-bottom">
            <span className="eyebrow">A SHARED DESIGN SESSION</span>
            <p>
              Build here. Start in Styler. Bring something you already made.
            </p>
            <button
              onClick={() => {
                setModal("import");
                setImportError("");
              }}
            >
              Bring your own <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
        <main className="main-work">
          <div className="canvas-toolbar">
            <div>
              <input
                aria-label="Page name"
                value={page.name}
                maxLength={80}
                onChange={(e) => {
                  if (e.target.value.trim())
                    patchPage({ name: e.target.value });
                }}
              />
              <span className="kind-tag">{names[page.kind]}</span>
            </div>
            <div className="toolbar-actions">
              <button
                aria-label="Undo"
                disabled={!state.past.length}
                onClick={() => {
                  navigateHistory("undo");
                }}
              >
                <Undo2 size={16} />
              </button>
              <button
                aria-label="Redo"
                disabled={!state.future.length}
                onClick={() => {
                  navigateHistory("redo");
                }}
              >
                <Redo2 size={16} />
              </button>
              <span className="separator" />
              <button
                aria-label="Desktop preview"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                <Monitor size={17} />
              </button>
              <button
                aria-label="Mobile preview"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                <Smartphone size={16} />
              </button>
              <button onClick={openCode}>
                <Braces size={16} />
                Code
              </button>
              <button
                aria-pressed={previewMode}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? "Edit" : "Preview"}
              </button>
            </div>
          </div>
          {borderOpened && (
            <div className="border-workspace" hidden={tab !== "border"}>
              <div className="border-context">
                <Frame size={18} />
                <div>
                  <strong>A detail, when you need it.</strong>
                  <p>
                    Explore a border, then explicitly preview and apply it to{" "}
                    {scope === "component" && selected
                      ? selectionLabel
                      : "the current page"}
                    . Use Styler to select a component.
                  </p>
                </div>
                <button onClick={() => setTab("style")}>Choose target ↗</button>
                <button
                  disabled={!appliedBorder}
                  onClick={async () => {
                    if (!appliedBorder) return;
                    const context = borderContext.current;
                    try {
                      const image = await loadImage(appliedBorder.source);
                      if (context !== borderContext.current) return;
                      setBorderEditor((old) => ({
                        revision: old.revision + 1,
                        initial: {
                          settings: structuredClone(appliedBorder.settings),
                          source: {
                            url: appliedBorder.source,
                            name: "applied-border.png",
                            width: image.naturalWidth,
                            height: image.naturalHeight,
                          },
                        },
                      }));
                    } catch {
                      setStatus("The applied border could not be opened.");
                    }
                  }}
                >
                  Load applied border
                </button>
              </div>
              <Shadow css={borderStyles}>
                <BorderLab
                  key={borderEditor.revision}
                  initialBorder={borderEditor.initial}
                  onApply={async (settings, source) => {
                    const context = borderContext.current;
                    const image = await embedBorderSource(source);
                    if (context !== borderContext.current)
                      throw new Error(
                        "The selected page or target changed. Preview the border again.",
                      );
                    const t = target || "page";
                    setPending({
                      target: t,
                      border: { target: t, settings, source: image },
                    });
                    setTab("style");
                  }}
                />
              </Shadow>
            </div>
          )}
          {tab !== "border" && (
            <div className={`canvas-area ${mobile ? "narrow" : ""}`}>
              <div className="canvas-caption">
                <span>
                  <span className="tiny-dot" />
                  {tab === "style"
                    ? "STYLE EXPLORER"
                    : previewMode
                      ? "WEBSITE PREVIEW"
                      : "YOUR CANVAS"}
                </span>
                <span>
                  {tab === "style"
                    ? "Click a component to select it"
                    : previewMode
                      ? "Try your page navigation"
                      : "Click text to edit • changes save automatically"}
                </span>
              </div>
              {tab === "build" &&
              !previewMode &&
              page.kind !== "html" &&
              page.kind !== "form" ? (
                <div
                  className="builder-canvas"
                  style={mobile ? { maxWidth: 390 } : undefined}
                >
                  <Shadow
                    css={baseCSS + "\n" + pageCSS({ ...previewPage, css: "" })}
                  >
                    <div className="fe-nav">
                      <strong>{previewWorkspace.name}</strong>
                      {w.pages.map((p) => (
                        <a
                          key={p.id}
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openPage(p.id);
                          }}
                        >
                          {p.name}
                        </a>
                      ))}
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={({ active, over }) => {
                        if (over && active.id !== over.id)
                          patchPage(
                            moveBlock(
                              page,
                              String(active.id),
                              page.blocks.findIndex((b) => b.id === over.id),
                            ),
                          );
                      }}
                    >
                      <SortableContext
                        items={page.blocks.map((b) => b.id)}
                        strategy={
                          page.kind === "dashboard"
                            ? rectSortingStrategy
                            : verticalListSortingStrategy
                        }
                      >
                        <div
                          className={`fe-page prototype-canvas ${page.kind === "dashboard" ? "dashboard-grid" : ""}`}
                          data-template={page.kind}
                        >
                          {page.blocks.map((block, index) => (
                            <SortableBlock
                              key={block.id}
                              block={block}
                              template={page.kind as PageId}
                              preview={false}
                              selected={selected === block.id}
                              select={() => {
                                setSelected(block.id);
                                setSelectionLabel(blockNames[block.type]);
                              }}
                              index={index}
                              count={page.blocks.length}
                              move={(to) =>
                                patchPage(moveBlock(page, block.id, to))
                              }
                              duplicate={() =>
                                patchPage(duplicateBlock(page, block.id))
                              }
                              remove={() => {
                                patchPage(removeBlock(page, block.id));
                                setSelected("");
                              }}
                              update={(next) =>
                                patchPage({
                                  blocks: page.blocks.map((b) =>
                                    b.id === next.id ? next : b,
                                  ),
                                })
                              }
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </Shadow>
                </div>
              ) : (
                <Preview
                  workspace={previewWorkspace}
                  page={previewPage}
                  mobile={mobile}
                  selected={tab === "style" ? selected : ""}
                  css={previewCSS}
                  inspectionTarget={tab === "style" ? target : undefined}
                  inspect={setComputed}
                  onHistory={navigateHistory}
                  select={
                    tab === "style" && !previewMode
                      ? (id, label) => {
                          setSelected(id);
                          setSelectionLabel(label);
                          if (scope === "component") {
                            setPending(null);
                            setConstraints([]);
                            setComputed({});
                          }
                        }
                      : undefined
                  }
                  onPage={openPage}
                />
              )}
              {pending && (
                <div className="apply-bar">
                  <div>
                    <Sparkles size={18} />
                    <span>
                      <strong>
                        {pending.style?.name ??
                          (pending.importedStyle
                            ? "Imported website style"
                            : pending.brand
                              ? "Brand preview"
                              : "Border image")}
                      </strong>{" "}
                      · Preview only ·{" "}
                      {pending.brand?.allPages
                        ? "All pages and new pages"
                        : pending.target === "page"
                          ? "Whole page"
                          : "Selected component"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPending(null);
                      setConstraints(pending.baselineConstraints ?? []);
                    }}
                  >
                    Discard
                  </button>
                  <button className="primary" onClick={apply}>
                    Apply to design <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
        {tab !== "border" && (
          <aside className="inspector">
            {tab === "build" ? (
              <>
                <span className="eyebrow">MAKE ROOM FOR YOUR IDEAS</span>
                <h2>Build your page.</h2>
                <p className="muted">
                  Start from a template, then make every detail your own.
                </p>
                <button className="wide-button" onClick={() => setModal("new")}>
                  <LayoutTemplate size={17} />
                  Browse templates <ArrowUpRight size={15} />
                </button>
                <div className="inspector-divider" />
                <span className="eyebrow">ADD A SECTION</span>
                {page.kind !== "html" && page.kind !== "form" ? (
                  <>
                    <div className="block-library">
                      {(
                        Object.entries(blockNames) as [BlockType, string][]
                      ).map(([type, name]) => (
                        <button
                          key={type}
                          disabled={page.blocks.length >= 24}
                          onClick={() =>
                            patchPage({
                              blocks: [...page.blocks, createBlock(type)],
                            })
                          }
                        >
                          <Plus size={14} />
                          {name}
                        </button>
                      ))}
                    </div>
                    {page.blocks.some((b) => b.id === selected) && (
                      <div className="selection-tools">
                        <strong>Selected: {selectionLabel}</strong>
                        <div>
                          <button
                            disabled={
                              page.blocks.findIndex((b) => b.id === selected) <=
                              0
                            }
                            onClick={() => {
                              patchPage(
                                moveBlock(
                                  page,
                                  selected,
                                  page.blocks.findIndex(
                                    (b) => b.id === selected,
                                  ) - 1,
                                ),
                              );
                            }}
                          >
                            Move up
                          </button>
                          <button
                            disabled={
                              page.blocks.findIndex((b) => b.id === selected) >=
                              page.blocks.length - 1
                            }
                            onClick={() => {
                              patchPage(
                                moveBlock(
                                  page,
                                  selected,
                                  page.blocks.findIndex(
                                    (b) => b.id === selected,
                                  ) + 1,
                                ),
                              );
                            }}
                          >
                            Move down
                          </button>
                          <button
                            disabled={page.blocks.length <= 1}
                            onClick={() => {
                              patchPage(removeBlock(page, selected));
                              setSelected("");
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      className="ai-button"
                      onClick={() => setModal("assistant")}
                    >
                      <Sparkles size={16} />
                      Explore with AI
                    </button>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Edit your HTML and CSS to add content, form fields, or
                      sections.
                    </p>
                    <button className="wide-button" onClick={openCode}>
                      <Braces size={16} />
                      Edit HTML / CSS
                    </button>
                  </>
                )}
                <div className="inspector-divider" />
                <span className="eyebrow">NEXT, IF YOU LIKE</span>
                <button
                  className="style-invitation"
                  onClick={() => setTab("style")}
                >
                  <Palette size={20} />
                  <span>
                    Find its personality.
                    <small>Explore this page in Styler</small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              </>
            ) : (
              <>
                <div className="panel-title">
                  <span>STYLE THE POSSIBILITIES</span>
                  <Palette size={17} />
                </div>
                <h2>A different feeling.</h2>
                <p className="muted">
                  Try a direction. Preview it here. Apply when it feels right.
                </p>
                <label className="field-label">
                  Apply styles to
                  <select
                    aria-label="Style scope"
                    value={scope}
                    onChange={(e) => {
                      setScope(e.target.value as "page" | "component");
                      setPending(null);
                      setConstraints([]);
                      setComputed({});
                    }}
                  >
                    <option value="page">Whole page</option>
                    <option value="component">Selected component</option>
                  </select>
                </label>
                {scope === "component" && (
                  <p className="selection-note">
                    {selected
                      ? selectionLabel
                      : "Click a component in the preview to select it."}
                  </p>
                )}
                <div className="style-grid">
                  {presets.map((style) => (
                    <StyleTile
                      key={style.id}
                      style={style}
                      selected={pending?.style?.id === style.id}
                      onClick={() => choose(style)}
                      inspired={inspiration?.id === style.id}
                      onInspire={() =>
                        setInspiration(
                          inspiration?.id === style.id ? null : style,
                        )
                      }
                    />
                  ))}
                </div>
                <p className="inspiration-note" role="status">
                  {inspiration
                    ? `Inspiration: ${inspiration.name}`
                    : "No inspiration selected."}
                  {inspiration && (
                    <button onClick={() => setInspiration(null)}>
                      Clear inspiration
                    </button>
                  )}
                </p>
                {!!w.savedStyles?.length && (
                  <section aria-label="Saved styles">
                    <h3>Saved styles</h3>
                    <div className="style-grid">
                      {w.savedStyles.map((style) => (
                        <div key={style.id}>
                          <StyleTile
                            style={style}
                            selected={pending?.style?.id === style.id}
                            onClick={() => choose(style)}
                            inspired={inspiration?.id === style.id}
                            onInspire={() =>
                              setInspiration(
                                inspiration?.id === style.id ? null : style,
                              )
                            }
                          />
                          <button
                            aria-label={`Delete saved style ${style.name}`}
                            onClick={() =>
                              commit({
                                ...w,
                                savedStyles: w.savedStyles!.filter(
                                  (s) => s.id !== style.id,
                                ),
                              })
                            }
                          >
                            Delete saved style
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <button
                  className="ai-button"
                  disabled={generation.active || !target}
                  onClick={() => generation.generate(constraints, inspiration)}
                >
                  <Sparkles size={16} />
                  {generation.active
                    ? "Generating styles…"
                    : "Generate variations"}
                </button>
                <p className="fine-print">
                  Joker & Harlequin locally, plus four AI expressions. Results
                  never apply automatically.
                </p>
                <div className="generated-styles">
                  {generation.slots.map((slot) => (
                    <div key={slot.id}>
                      {slot.style ? (
                        <StyleTile
                          style={slot.style}
                          selected={pending?.style?.id === slot.id}
                          onClick={() => choose(slot.style!)}
                          inspired={inspiration?.id === slot.style.id}
                          onInspire={() =>
                            setInspiration(
                              inspiration?.id === slot.style!.id
                                ? null
                                : slot.style!,
                            )
                          }
                        />
                      ) : (
                        <div className="generation-slot">
                          {slot.expression ?? slot.localKind}
                          <p role="status">
                            {slot.status === "pending"
                              ? "Exploring…"
                              : slot.error}
                          </p>
                          {slot.status === "error" && (
                            <button
                              disabled={generation.active}
                              onClick={() => generation.retry(slot)}
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <StyleInspector
                  key={`${page.id}:${target}:${currentStyle.id}`}
                  style={effectiveStyle}
                  baseline={pending?.baseline ?? currentStyle}
                  constraints={constraints}
                  computed={computed}
                  edit={editStyle}
                  reset={resetDeclaration}
                  toggle={changeConstraint}
                  save={saveStyle}
                  disabled={
                    !target ||
                    !!pending?.brand ||
                    !!pending?.importedStyle ||
                    !!pending?.border
                  }
                />
                <button
                  className="subtle-link"
                  onClick={() => setTab("border")}
                >
                  <Frame size={15} />
                  Need a border image? <ArrowUpRight size={14} />
                </button>
              </>
            )}
            <div className="inspector-divider" />
            <span className="eyebrow">VISUAL REFERENCE</span>
            <p className="fine-print">
              Keep a screenshot alongside your design.
            </p>
            <button
              className="wide-button"
              onClick={() => referenceFile.current?.click()}
            >
              <Upload size={15} />
              {page.reference ? "Replace screenshot" : "Add screenshot"}
            </button>
            {page.reference && (
              <>
                <img
                  className="reference-image"
                  src={page.reference}
                  alt="Your design reference"
                />
                <button onClick={() => patchPage({ reference: undefined })}>
                  Remove reference
                </button>
              </>
            )}
            <div className="inspector-divider" />
            <button
              className="danger-link"
              disabled={w.pages.length === 1}
              onClick={() => {
                if (
                  confirm(`Delete “${page.name}”? You can undo this change.`)
                ) {
                  const pages = w.pages.filter((p) => p.id !== page.id);
                  commit({ ...w, pages, activePage: pages[0].id });
                  clearPreview();
                }
              }}
            >
              Delete page
            </button>
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <span role="status">{status}</span>
        <span>
          {w.pages.length} {w.pages.length === 1 ? "page" : "pages"} · Local
          workspace · No account needed
        </span>
      </footer>
      {storageBlocked && (
        <div className="recovery">
          <p>{initial.error}</p>
          <button
            onClick={() =>
              download(
                localStorage.getItem(STORAGE_KEY) || "",
                "frontender-recovery.json",
              )
            }
          >
            Download saved data
          </button>
          <button
            onClick={() => {
              if (confirm("Replace the saved data with this new workspace?"))
                setStorageBlocked(false);
            }}
          >
            Start a new workspace
          </button>
        </div>
      )}
      <input
        hidden
        ref={referenceFile}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 2500000) {
            setStatus("Choose a screenshot smaller than 2.5 MB.");
            return;
          }
          if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
            setStatus("Choose PNG, JPEG or WebP.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => patchPage({ reference: String(reader.result) });
          reader.readAsDataURL(f);
        }}
      />
      <input
        hidden
        ref={projectFile}
        type="file"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 16000000) throw new Error();
            setImported(parseWorkspace(await file.text()));
            setImportError("");
          } catch {
            setImported(null);
            setImportError(
              "This is not a valid Frontender project file (maximum 16 MB). Your current work has not changed.",
            );
          }
        }}
      />
      {modal === "new" && (
        <Dialog
          title="A new page, a new possibility."
          close={() => setModal(null)}
          wide
        >
          <p>
            Choose a starting point. Every page shares the same workspace and
            tools.
          </p>
          <div className="template-grid">
            {(Object.entries(names) as [Page["kind"], string][]).map(
              ([kind, name], i) => (
                <button key={kind} onClick={() => addPage(kind)}>
                  <span className={`template-art art-${i}`}>
                    <LayoutTemplate size={34} />
                  </span>
                  <strong>{name}</strong>
                  <span>
                    {kind === "html"
                      ? "Start fresh or paste your own"
                      : kind === "form"
                        ? "A conversation starts here"
                        : "Editable Formlane template"}{" "}
                    <ArrowUpRight size={14} />
                  </span>
                </button>
              ),
            )}
          </div>
        </Dialog>
      )}
      {modal === "import" && (
        <Dialog
          title="Bring your work into Frontender"
          close={() => {
            setModal(null);
            setImported(null);
          }}
        >
          <div className="import-options">
            <button className="wide-button" onClick={() => setModal("website")}>
              <Upload size={20} />
              <span>
                Import website / Markdown
                <small>Review website styles or add selected content</small>
              </span>
            </button>
            <button
              className="wide-button"
              onClick={() => projectFile.current?.click()}
            >
              <FolderOpen size={20} />
              <span>
                Import a Frontender project
                <small>Reopen an exported .frontender.json file</small>
              </span>
            </button>
            <button
              className="wide-button"
              onClick={() => {
                addPage("html");
                setStatus(
                  "New HTML page created. Open Code to paste your HTML and CSS.",
                );
              }}
            >
              <Braces size={20} />
              <span>
                Bring HTML / CSS
                <small>Add an editable page to this workspace</small>
              </span>
            </button>
          </div>
          {importError && <p role="alert">{importError}</p>}
          {imported && (
            <div className="import-review">
              <h3>{imported.name}</h3>
              <p>{imported.pages.length} pages ready to import.</p>
              <button
                className="primary"
                onClick={() => {
                  try {
                    commit(mergeWorkspace(w, imported));
                    setImported(null);
                    setModal(null);
                    clearPreview();
                  } catch (e) {
                    setImportError((e as Error).message);
                  }
                }}
              >
                Add to current workspace
              </button>
              <p>
                Keep existing pages. Incoming pages receive unique names and
                IDs.
              </p>
              <hr />
              <button onClick={exportProject}>Export current work first</button>
              <button
                className="danger-link"
                onClick={() => {
                  if (
                    confirm(
                      "Replace all current pages? The old workspace will disappear. Export it first if you want to keep it.",
                    )
                  ) {
                    dispatch({ type: "replace", value: imported });
                    setImported(null);
                    setModal(null);
                    clearPreview();
                    setStorageBlocked(false);
                    setBorderOpened(false);
                    setInspiration(null);
                    setBorderEditor((old) => ({ revision: old.revision + 1 }));
                    setTab("build");
                  }
                }}
              >
                Replace current workspace…
              </button>
            </div>
          )}
        </Dialog>
      )}
      {modal === "website" && (
        <div className="website-import-dialog">
          <WebsiteImport
            close={() => setModal(null)}
            destination={page.name}
            apply={(result, brand) => {
              setPending({ target: "page", importedStyle: { result, brand } });
              setScope("page");
              setConstraints([]);
              setTab("style");
              setModal(null);
            }}
            content={{
              slots:
                page.kind === "html" || page.kind === "form"
                  ? 0
                  : 24 - page.blocks.length,
              destination: page.name,
              unavailableReason:
                page.kind === "html" || page.kind === "form"
                  ? "To add editable sections, close this dialog and choose or create a visual block page. You can still copy or download Markdown here."
                  : undefined,
              apply: (sections) => {
                try {
                  const next = appendContent(page, sections);
                  if (
                    commit({
                      ...w,
                      pages: w.pages.map((p) => (p.id === page.id ? next : p)),
                    })
                  ) {
                    clearPreview();
                    setModal(null);
                    setTab("build");
                    setPreviewMode(false);
                    setStatus("Selected content added. Undo is available.");
                  }
                } catch (error) {
                  setStatus((error as Error).message);
                }
              },
            }}
          />
        </div>
      )}
      {modal === "brand" && (
        <BrandDialog
          name={w.name}
          theme={page.builderTheme ?? w.brandTheme}
          close={() => setModal(null)}
          preview={(brand) => {
            clearPreview();
            setPending({ brand, target: "page" });
            setTab("style");
            setModal(null);
          }}
        />
      )}
      {modal === "snapshot" && (
        <SnapshotDialog workspace={w} close={() => setModal(null)} />
      )}
      {modal === "handout" && (
        <Dialog title="PDF handout" close={() => setModal(null)} wide>
          <p>Print the current page with its applied design. Choose Save as PDF in the print dialog to share a file.</p>
          <iframe
            className="handout-preview"
            title="Printable design"
            sandbox="allow-scripts allow-modals"
            srcDoc={handoutHTML(w, page)}
          />
        </Dialog>
      )}
      {modal === "code" && (
        <Dialog title="HTML & CSS" close={() => setModal(null)} wide>
          <p>
            {page.blocks.length
              ? "Saving HTML converts this page to editable HTML. The visual block editor will be replaced; Undo restores it."
              : "Edit the page content and its CSS."}{" "}
            Scripts and embedded frames are removed from previews and exports.
          </p>
          <div className="code-editors">
            <label>
              HTML
              <textarea
                aria-label="HTML source"
                spellCheck={false}
                value={code.html}
                onChange={(e) => setCode({ ...code, html: e.target.value })}
              />
            </label>
            <label>
              CSS
              <textarea
                aria-label="CSS source"
                spellCheck={false}
                value={code.css}
                onChange={(e) => setCode({ ...code, css: e.target.value })}
              />
            </label>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (code.html.length > 500000 || code.css.length > 200000) {
                setStatus("Code is too large (HTML 500 KB, CSS 200 KB).");
                return;
              }
              patchPage({
                html: code.html,
                css: code.css,
                kind: page.kind === "form" ? "form" : "html",
                blocks: [],
                styles: page.styles.filter((s) => s.target === "page"),
                borders: page.borders.filter((b) => b.target === "page"),
              });
              clearPreview();
              setModal(null);
            }}
          >
            Save code
          </button>
        </Dialog>
      )}
      {modal === "assistant" &&
        page.kind !== "form" &&
        page.kind !== "html" && (
          <Assistant
            project={assistantProject}
            page={page.kind}
            selectedId={selected || null}
            title={page.name}
            close={() => setModal(null)}
            apply={(review) => {
              const themeChanged =
                JSON.stringify(review.next.theme) !==
                JSON.stringify(assistantProject.theme);
              commit({
                ...w,
                name:
                  review.next.brand !== assistantProject.brand
                    ? review.next.brand
                    : w.name,
                pages: w.pages.map((p) =>
                  p.id === page.id
                    ? {
                        ...p,
                        blocks: review.next.pages[page.kind as PageId],
                        builderTheme: themeChanged
                          ? review.next.theme
                          : p.builderTheme,
                        styles: themeChanged
                          ? p.styles.filter((s) => s.target !== "page")
                          : p.styles,
                      }
                    : p,
                ),
              });
              setModal(null);
              setStatus("AI content changes applied. Undo is available.");
            }}
          />
        )}
      {modal === "voice" && (
        <VoiceChat
          messages={messages}
          onMessage={(m) => setMessages((old) => [...old, m])}
          resetTranscript={() => setMessages([])}
          close={() => setModal(null)}
        />
      )}
    </div>
  );
}
function StyleTile({
  style,
  selected,
  onClick,
  inspired,
  onInspire,
}: {
  style: Style;
  selected: boolean;
  onClick: () => void;
  inspired?: boolean;
  onInspire: () => void;
}) {
  const color = (role: string, property: string, fallback: string) =>
    style.rules
      .find((r) => r.selectorId === role)
      ?.declarations.find((d) => d.property === property)?.value ?? fallback;
  return (
    <div className="style-choice">
      <button
        className={`style-tile ${selected ? "selected" : ""}`}
        aria-pressed={selected}
        onClick={onClick}
      >
        <span
          className="style-sample"
          style={{
            background: color("page", "background-color", "#f5f5ed"),
            color: color("page", "color", "#30382d"),
            fontFamily: color("heading", "font-family", "Georgia"),
          }}
        >
          <span>
            Aa
            <span style={{ color: color("accent", "color", "#536b48") }}>
              ↗
            </span>
          </span>
          <i
            style={{
              background: color("button", "background-color", "#536b48"),
            }}
          />
          <small>Make it yours.</small>
        </span>
        <span>
          {style.name}
          <ArrowUpRight size={12} />
        </span>
      </button>
      <button
        className="inspire-button"
        aria-label={`Inspire ${style.id}`}
        aria-pressed={!!inspired}
        onClick={onInspire}
      >
        Inspire
      </button>
    </div>
  );
}
