import React, { useState, type CSSProperties } from "react";

import {
  css,
  declarations,
  initial,
  modes,
  parseResult,
  type Settings,
  type Quad,
  type Suggestion,
  type AIResult,
} from "../shared/border.ts";
import { aiImage, cropImage, download, upload, type Source } from "./images.ts";

const samples = [
  { id: "tile", name: "Terracotta", description: "A little Mediterranean." },
  { id: "stamp", name: "Postage", description: "Something worth sending." },
  { id: "line", name: "Botanical", description: "Quiet, considered lines." },
];
const sides = ["Top", "Right", "Bottom", "Left"];
function Box({
  settings,
  source,
  children,
  style = {},
}: {
  settings: Settings;
  source: Source;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="framed-box"
      style={{
        ...declarations(settings),
        borderImageSource: `url("${source.url}")`,
        borderWidth: settings.border,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Code({ settings, source }: { settings: Settings; source: Source }) {
  const [short, setShort] = useState(false),
    [copied, setCopied] = useState(false);
  const text = css(settings, source.name, short);
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <div className="tabs small">
          <button aria-pressed={!short} onClick={() => setShort(false)}>
            Longhand
          </button>
          <button aria-pressed={short} onClick={() => setShort(true)}>
            Shorthand
          </button>
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              download(
                URL.createObjectURL(new Blob([text], { type: "text/css" })),
                "border.css",
              );
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy CSS ↗"}
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}
function QuadControl({
  name,
  help,
  values,
  unit,
  units,
  max,
  onChange,
  onUnit,
}: {
  name: string;
  help: string;
  values: Quad;
  unit: string;
  units: string[];
  max: number;
  onChange: (q: Quad) => void;
  onUnit: (s: string) => void;
}) {
  const [linked, setLinked] = useState(true);
  const edit = (i: number, n: number) => {
    const bounded = Math.min(max, Math.max(0, Number.isFinite(n) ? n : 0));
    onChange(
      linked
        ? [bounded, bounded, bounded, bounded]
        : (values.map((v, j) => (i === j ? bounded : v)) as Quad),
    );
  };
  return (
    <section className="control-group">
      <div className="control-title">
        <h3>{name}</h3>
        <select
          aria-label={`${name} unit`}
          value={unit}
          onChange={(e) => onUnit(e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u === "" ? "number" : u}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">{help}</p>
      <div className="quad-head">
        <span>TOP · RIGHT · BOTTOM · LEFT</span>
        <button
          className={linked ? "linked" : ""}
          aria-pressed={linked}
          onClick={() => setLinked(!linked)}
          title="Link all four sides"
        >
          {linked ? "⌁ Linked" : "⌁ Unlinked"}
        </button>
      </div>
      <div className="quad-inputs">
        {values.map((v, i) => (
          <label key={i}>
            <span className="sr-only">
              {name} {sides[i]}
            </span>
            <input
              aria-label={`${name} ${sides[i]}`}
              type="number"
              min="0"
              max={max}
              step="1"
              disabled={unit === "auto"}
              value={v}
              onChange={(e) => edit(i, e.target.valueAsNumber)}
            />
          </label>
        ))}
      </div>
      <input
        aria-label={`${name} all sides slider`}
        type="range"
        min="0"
        max={max}
        value={Math.min(values[0], max)}
        disabled={unit === "auto"}
        onChange={(e) => edit(0, +e.target.value)}
      />
    </section>
  );
}
export function BorderLab({
  onApply,
  initialBorder,
}: {
  onApply: (settings: Settings, source: Source) => Promise<void>;
  initialBorder?: { settings: Settings; source: Source };
}) {
  const [settings, setSettings] = useState<Settings>(() =>
    structuredClone(initialBorder?.settings ?? initial),
  );
  const [source, setSource] = useState<Source>(
    initialBorder?.source ?? {
      url: "/samples/tile.svg",
      name: "tile.svg",
      width: 160,
      height: 160,
    },
  );
  const [tab, setTab] = useState("explore"),
    [shape, setShape] = useState("wide"),
    [background, setBackground] = useState("paper"),
    [label, setLabel] = useState("Shapes define things. The best shapes define the best things. What is your favorite shape?");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [suggestions, setSuggestions] = useState<{
      items: Suggestion[];
      source: Source;
    } | null>(null),
    [aiAdvice, setAIAdvice] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
      [],
    ),
    [question, setQuestion] = useState("");
  const [sketch, setSketch] = useState<Source | null>(null),
    [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [cropPlan, setCropPlan] = useState<{
      suggestions: Suggestion[];
      advice: string;
    } | null>(null),
    [showGuides, setShowGuides] = useState(true);
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  async function readFile(file: File | undefined, isSketch = false) {
    if (!file) return;
    setError("");
    try {
      const next = await upload(file);
      if (isSketch) {
        setSketch(next);
        setCrop({ x: 0, y: 0, width: 100, height: 100 });
        setCropPlan(null);
      } else {
        setSource(next);
        setSuggestions(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function request(action: string, image: Source): Promise<AIResult> {
    const response = await fetch("/api/border/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        image: await aiImage(image),
        settings,
        question,
        history: messages,
        view: {
          shape,
          background,
          label,
          sourceWidth: image.width,
          sourceHeight: image.height,
        },
      }),
      signal: AbortSignal.timeout(195_000),
    });
    const decode = async (reply: Response) => {
      if (reply.status === 429)
        throw new Error("Too many AI requests. Wait a minute and try again.");
      try {
        return await reply.json();
      } catch {
        throw new Error(
          "The AI service returned an unreadable response. Retry manually.",
        );
      }
    };
    let result = await decode(response);
    if (!response.ok) throw new Error(result.error ?? "AI request failed.");
    if (response.status === 202) {
      const deadline = Date.now() + 185_000;
      let complete = false;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await fetch(
          `/api/border/generation-status?job=${encodeURIComponent(result.jobId)}`,
          { cache: "no-store", signal: AbortSignal.timeout(15_000) },
        );
        const body = await decode(status);
        if (!status.ok) throw new Error(body.error ?? "AI request failed.");
        if (status.status !== 202) {
          result = body;
          complete = true;
          break;
        }
      }
      if (!complete) throw new Error("AI request timed out. Retry manually.");
    }
    return parseResult(result, action);
  }
  async function run(action: string) {
    if (busy) return;
    const snapshot = action === "analyze" ? sketch : source;
    if (!snapshot) return;
    setBusy(action);
    setError("");
    try {
      const r = await request(action, snapshot);
      if (action === "chat") {
        setMessages((m) => [
          ...m,
          { role: "user", text: question },
          { role: "assistant", text: r.advice },
        ]);
        setQuestion("");
      } else if (action === "analyze") {
        setCrop(r.crop!);
        setCropPlan({ suggestions: r.suggestions!, advice: r.advice });
      } else {
        setSuggestions({ items: r.suggestions!, source: snapshot });
        setAIAdvice(r.advice);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete AI request.",
      );
    } finally {
      setBusy("");
    }
  }
  async function applyCrop() {
    if (!sketch) return;
    try {
      const next = await cropImage(sketch, crop);
      setSource(next);
      if (cropPlan) {
        setSuggestions({ items: cropPlan.suggestions, source: next });
        setAIAdvice(cropPlan.advice);
        setSettings(cropPlan.suggestions[0].settings);
      } else {
        setSuggestions(null);
      }
      setTab("explore");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const guides = settings.slice.map((n, i) =>
    settings.sliceUnit === "%"
      ? n
      : (n / (i % 2 ? source.width : source.height)) * 100,
  );
  const sourcePreview = (
    <div className="source-image">
      <img src={source.url} alt="Current border source" />
      {showGuides && (
        <div
          className="slice-guides"
          style={{
            top: `${guides[0]}%`,
            right: `${guides[1]}%`,
            bottom: `${guides[2]}%`,
            left: `${guides[3]}%`,
          }}
        />
      )}
    </div>
  );
  return (
    <>
      <header>
        <button
          onClick={() => {
            void onApply(settings, source).catch((e) => setError(e.message));
          }}
        >
          Preview border in workspace ↗
        </button>
        <a className="brand" href="#" aria-label="Border Image Lab home">
          <span className="brand-icon">▧</span> border
          <span className="brand-light">/</span>image{" "}
          <span className="lab">LAB</span>
        </a>
        <nav aria-label="Main navigation">
          {["explore", "learn", "from sketch"].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t === "from sketch"
                ? "From a sketch ↗"
                : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <a
          className="reference"
          href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-image"
          target="_blank"
          rel="noreferrer"
        >
          CSS reference ↗
        </a>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              <span /> A SMALL LAB FOR THE EDGES
            </div>
            <h1>
              Make room for
              <br />a little <em>detail.</em>
            </h1>
            <p>
              One image. Nine pieces. Endless possibilities.
              <br />
              Explore CSS border-image, one slider at a time.
            </p>
          </div>
          <div className="intro-note">
            <span className="note-star">✳</span>
            <p>
              The border is
              <br />
              part of the story.
            </p>
            <span>LET’S GIVE IT SOME CHARACTER.</span>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {tab === "explore" && (
          <>
            <div className="workspace">
              <aside className="panel controls">
                <div className="panel-heading">
                  <span className="step">01</span>
                  <h2>The ingredients</h2>
                  <button
                    className="quiet"
                    onClick={() => setSettings(structuredClone(initial))}
                  >
                    Reset
                  </button>
                </div>
                <section className="source-section">
                  <div className="source-meta">
                    <h3>border-image-source</h3>
                    <span>
                      {source.width} × {source.height}
                    </span>
                  </div>
                  <div className="source-row">
                    {sourcePreview}
                    <div>
                      <strong>{source.name}</strong>
                      <p className="hint">
                        A frame, a pattern,
                        <br />a happy accident.
                      </p>
                      <label className="upload-button">
                        ↑ Upload image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            void readFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="sample-list">
                    {samples.map((s) => (
                      <button
                        disabled={!!busy}
                        title={s.description}
                        key={s.id}
                        aria-pressed={source.name === `${s.id}.svg`}
                        onClick={() => {
                          setSource({
                            url: `/samples/${s.id}.svg`,
                            name: `${s.id}.svg`,
                            width: 160,
                            height: 160,
                          });
                          setSuggestions(null);
                        }}
                      >
                        <img src={`/samples/${s.id}.svg`} alt="" />
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={showGuides}
                      onChange={(e) => setShowGuides(e.target.checked)}
                    />{" "}
                    Show slice guides
                  </label>
                </section>
                <QuadControl
                  name="border-image-slice"
                  help="Where to cut the source into nine pieces."
                  values={settings.slice}
                  unit={settings.sliceUnit}
                  units={["%", ""]}
                  max={
                    settings.sliceUnit === "%"
                      ? 100
                      : Math.max(source.width, source.height)
                  }
                  onChange={(q) => patch({ slice: q })}
                  onUnit={(u) => {
                    const converted = settings.slice.map((n, i) =>
                      u === "%"
                        ? Math.min(
                            100,
                            Math.round(
                              (n / (i % 2 ? source.width : source.height)) *
                                100,
                            ),
                          )
                        : Math.round(
                            (n / 100) * (i % 2 ? source.width : source.height),
                          ),
                    ) as Quad;
                    patch({
                      sliceUnit: u as Settings["sliceUnit"],
                      slice: converted,
                    });
                  }}
                />
                <label className="check fill-check">
                  <input
                    type="checkbox"
                    checked={settings.fill}
                    onChange={(e) => patch({ fill: e.target.checked })}
                  />{" "}
                  Fill the center <code>fill</code>
                </label>
                <QuadControl
                  name="border-image-width"
                  help="How wide to paint each border edge."
                  values={settings.width}
                  unit={settings.widthUnit}
                  units={["px", "%", "", "auto"]}
                  max={200}
                  onChange={(q) => patch({ width: q })}
                  onUnit={(u) =>
                    patch({ widthUnit: u as Settings["widthUnit"] })
                  }
                />
                <QuadControl
                  name="border-image-outset"
                  help="How far the artwork extends beyond the box."
                  values={settings.outset}
                  unit={settings.outsetUnit}
                  units={["px", ""]}
                  max={100}
                  onChange={(q) => patch({ outset: q })}
                  onUnit={(u) =>
                    patch({ outsetUnit: u as Settings["outsetUnit"] })
                  }
                />
                <section className="control-group">
                  <h3>border-image-repeat</h3>
                  <p className="hint">What happens between the corners.</p>
                  {["Horizontal", "Vertical"].map((axis, i) => (
                    <div className="repeat-axis" key={axis}>
                      <span>{axis}</span>
                      <div className="segmented">
                        {modes.map((m) => (
                          <button
                            key={m}
                            aria-label={`${axis} ${m}`}
                            aria-pressed={settings.repeat[i] === m}
                            onClick={() =>
                              patch({
                                repeat: settings.repeat.map((v, j) =>
                                  i === j ? m : v,
                                ) as Settings["repeat"],
                              })
                            }
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
                <section className="control-group border-control">
                  <label htmlFor="border-size">
                    Layout border-width <span>{settings.border}px</span>
                  </label>
                  <input
                    id="border-size"
                    type="range"
                    min="1"
                    max="100"
                    value={settings.border}
                    onChange={(e) => patch({ border: +e.target.value })}
                  />
                  <p className="hint">
                    Reserves space and supplies the unitless multiplier.
                  </p>
                </section>
              </aside>
              <div className="output-column">
                <section className="panel preview-panel">
                  <div className="panel-heading">
                    <span className="step">02</span>
                    <h2>See it take shape</h2>
                    <span className="live">
                      <i /> LIVE PREVIEW
                    </span>
                  </div>
                  <div className="preview-toolbar">
                    <div className="tabs">
                      {["wide", "square", "tall"].map((s) => (
                        <button
                          aria-pressed={shape === s}
                          key={s}
                          onClick={() => setShape(s)}
                        >
                          {s === "wide" ? "▭" : s === "square" ? "□" : "▯"} {s}
                        </button>
                      ))}
                    </div>
                    <div className="swatches">
                      {["paper", "ink", "grid"].map((s) => (
                        <button
                          key={s}
                          className={s}
                          aria-label={`${s} background`}
                          aria-pressed={background === s}
                          onClick={() => setBackground(s)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={`preview-stage ${background}`}>
                    <Box
                      settings={settings}
                      source={source}
                      style={{
                        width:
                          shape === "wide"
                            ? "min(100%, 470px)"
                            : shape === "square"
                              ? 290
                              : 230,
                        minHeight:
                          shape === "tall"
                            ? 330
                            : shape === "square"
                              ? 290
                              : 235,
                      }}
                    >
                      <span className="preview-kicker">
                        A LITTLE SOMETHING EXTRA
                      </span>
                      <h2>{label}</h2>
                      <span className="preview-flower">✳</span>
                      <p>It’s all in the edges.</p>
                    </Box>
                    <span className="stage-caption">
                      YOUR IMAGE, DOING A DIFFERENT KIND OF WORK.
                    </span>
                  </div>
                  <div className="preview-footer">
                    <span>
                      Try resizing. The corners stay, the edges adapt.
                    </span>
                    <label>
                      Preview text{" "}
                      <input
                        aria-label="Preview text"
                        maxLength={120}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </label>
                  </div>
                </section>
                <section className="panel css-panel">
                  <div className="panel-heading">
                    <span className="step">03</span>
                    <h2>Take the CSS with you</h2>
                    <button
                      className="quiet"
                      onClick={() => download(source.url, source.name)}
                    >
                      ↓ Source image
                    </button>
                  </div>
                  <Code settings={settings} source={source} />
                  <p className="export-note">
                    Keep the image alongside your stylesheet, or update its URL.
                    Border radius does not clip a border image.
                  </p>
                </section>
                <div className="little-lesson">
                  <span>↳</span>
                  <p>
                    <strong>Think of it like a picture frame.</strong>
                    <br />
                    Four corners stay intact. Four edges repeat or stretch. The
                    center is yours to fill.
                  </p>
                  <button onClick={() => setTab("learn")}>
                    How it works ↗
                  </button>
                </div>
              </div>
            </div>
            <section className="ai-section">
              <div className="ai-heading">
                <div>
                  <div className="eyebrow">A SECOND PAIR OF EYES</div>
                  <h2>A few other ways to frame it.</h2>
                  <p>
                    Let Antigravity explore three combinations with your image.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void run("suggest")}
                >
                  {busy === "suggest"
                    ? "✧ Exploring…"
                    : "✧ Suggest 3 combinations"}
                </button>
              </div>
              <p className="privacy-note">
                On request, your image and current settings are sent to AI. No
                request runs automatically.
              </p>
              {aiAdvice && <p className="ai-advice">{aiAdvice}</p>}
              {suggestions ? (
                <div className="suggestion-grid">
                  {suggestions.items.map((s, i) => (
                    <article className="panel suggestion" key={i}>
                      <div className="suggestion-preview">
                        <Box settings={s.settings} source={suggestions.source}>
                          <span>0{i + 1}</span>
                          <h3>{s.name}</h3>
                        </Box>
                      </div>
                      <div className="suggestion-info">
                        <h3>{s.name}</h3>
                        <p>{s.reason}</p>
                        <button
                          className="outline"
                          onClick={() => {
                            setSource(suggestions.source);
                            setSettings(structuredClone(s.settings));
                            window.scrollTo({ top: 260, behavior: "smooth" });
                          }}
                        >
                          Use this combination ↗
                        </button>
                      </div>
                      <Code settings={s.settings} source={suggestions.source} />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ai-empty">
                  <span>✧</span>
                  <p>
                    Three possibilities, waiting in the wings.
                    <br />
                    <small>
                      Start with a sample or bring an image of your own.
                    </small>
                  </p>
                </div>
              )}
            </section>
          </>
        )}
        {tab === "learn" && (
          <section className="learn">
            <div className="section-intro">
              <div className="eyebrow">THE NINE-SLICE IDEA</div>
              <h2>
                A whole new way
                <br />
                to see the edges.
              </h2>
              <p>
                CSS cuts a source into nine regions and paints them around a
                box. Change a control in Explore to see the browser do the work.
              </p>
            </div>
            <div className="learn-grid">
              <div className="nine-diagram">
                {[
                  "Corner",
                  "Top edge",
                  "Corner",
                  "Left edge",
                  "Center",
                  "Right edge",
                  "Corner",
                  "Bottom edge",
                  "Corner",
                ].map((s, i) => (
                  <div className={`piece piece-${i}`} key={i}>
                    <span>0{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
              <div>
                <h3>Start with the source, then make the cuts.</h3>
                <p>
                  Slice offsets go inward from the top, right, bottom and left.
                  Percentages are relative to the source image. A unitless slice
                  is measured in source pixels for raster images, or source
                  coordinates for SVG.
                </p>
                <p>
                  The four corner pieces keep their shapes. The edges stretch or
                  tile. The center is discarded unless you enable{" "}
                  <code>fill</code>.
                </p>
                <button className="primary" onClick={() => setTab("explore")}>
                  Try it in the lab ↗
                </button>
              </div>
            </div>
            <div className="lesson-grid">
              {[
                [
                  "01",
                  "border-image-source",
                  "The image itself.",
                  "Use a URL, a gradient, or none in CSS. This lab uses your image. Frame-like images with clear corners usually give the most predictable results.",
                ],
                [
                  "02",
                  "border-image-slice",
                  "Cut the image, not the box.",
                  "One to four numbers or percentages. Four values follow top → right → bottom → left. Opposing cuts that meet or overlap can make an edge or center disappear.",
                ],
                [
                  "03",
                  "border-image-width",
                  "Decide how much to paint.",
                  "px gives a fixed width. A number multiplies border-width. A percentage uses the border image area’s width for left/right and height for top/bottom. auto uses the intrinsic slice size.",
                ],
                [
                  "04",
                  "border-image-outset",
                  "Let the artwork wander.",
                  "Positive px or unitless multiples of border-width push the image outside its border box. This does not reserve extra layout space; leave enough room to avoid overlap.",
                ],
                [
                  "05",
                  "border-image-repeat",
                  "Give the edges a rhythm.",
                  "stretch fits one piece. repeat tiles and may clip the end tiles. round resizes tiles to fit a whole number. space adds gaps between whole tiles. Two values control horizontal and vertical edges.",
                ],
                [
                  "06",
                  "border-image",
                  "Wrap it in shorthand.",
                  "source slice / width / outset repeat. The fill keyword belongs to slice. Keep border-style and border-width set, and avoid a later border shorthand that resets your border image.",
                ],
              ].map(([n, title, sub, text]) => (
                <article className="panel lesson" key={n}>
                  <span className="step">{n}</span>
                  <h3>{title}</h3>
                  <h4>{sub}</h4>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <p className="learning-footnote">
              A border image is decoration. Keep meaningful text in HTML. Learn
              more in the{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-image"
                target="_blank"
                rel="noreferrer"
              >
                MDN border-image reference ↗
              </a>
              .
            </p>
          </section>
        )}
        {tab === "from sketch" && (
          <section className="sketch-section">
            <div className="section-intro">
              <div className="eyebrow">FROM INSPIRATION TO IMPLEMENTATION</div>
              <h2>
                Found a frame?
                <br />
                <em>Make it yours.</em>
              </h2>
              <p>
                Upload a box or website sketch. Crop its frame manually, or ask
                AI to find a starting point. AI estimates need a visual check;
                complex layouts may need more than border-image.
              </p>
            </div>
            <div className="sketch-grid">
              <div className="panel sketch-panel">
                <div className="panel-heading">
                  <h2>Your reference</h2>
                  <label className="upload-button">
                    ↑ Upload sketch
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        void readFile(e.target.files?.[0], true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {sketch ? (
                  <div className="crop-stage">
                    <img src={sketch.url} alt="Full sketch to crop" />
                    <div
                      className="crop-rectangle"
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.width}%`,
                        height: `${crop.height}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="sketch-empty">
                    <span>▧</span>
                    <h3>The whole picture starts here.</h3>
                    <p>PNG, JPG or WebP · up to 12 MB</p>
                  </div>
                )}
              </div>
              <div className="panel crop-controls">
                <div className="panel-heading">
                  <span className="step">↳</span>
                  <h2>Find the edges</h2>
                </div>
                <p className="hint">
                  Crop percentages refer to the full image. Include all four
                  corners and edges of the frame.
                </p>
                {(["x", "y", "width", "height"] as const).map((k) => (
                  <label className="crop-field" key={k}>
                    {k === "x"
                      ? "Left"
                      : k === "y"
                        ? "Top"
                        : k[0].toUpperCase() + k.slice(1)}{" "}
                    <span>{crop[k]}%</span>
                    <input
                      aria-label={`Crop ${k}`}
                      type="range"
                      min={k === "width" || k === "height" ? 1 : 0}
                      max={
                        k === "width"
                          ? 100 - crop.x
                          : k === "height"
                            ? 100 - crop.y
                            : 99
                      }
                      value={crop[k]}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setCrop((c) => ({
                          ...c,
                          [k]: v,
                          ...(k === "x"
                            ? { width: Math.min(c.width, 100 - v) }
                            : k === "y"
                              ? { height: Math.min(c.height, 100 - v) }
                              : {}),
                        }));
                        setCropPlan(null);
                      }}
                    />
                  </label>
                ))}
                <button
                  className="primary"
                  disabled={!sketch || !!busy}
                  onClick={() => void run("analyze")}
                >
                  {busy === "analyze"
                    ? "✧ Studying the frame…"
                    : "✧ Find frame & suggest CSS"}
                </button>
                <button
                  className="outline"
                  disabled={!sketch || !!busy}
                  onClick={() => void applyCrop()}
                >
                  Crop & open in Explore ↗
                </button>
                <p className="privacy-note">
                  AI receives this sketch and current controls only when
                  requested. The actual crop is made locally in your browser.
                </p>
                {cropPlan && (
                  <div className="crop-advice">
                    <strong>Proposed crop ready</strong>
                    <p>{cropPlan.advice}</p>
                    <p>
                      Review the highlighted rectangle. Open it in Explore to
                      compare three proposed combinations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        <section className="adviser panel">
          <div className="adviser-intro">
            <span className="note-star">✧</span>
            <h2>
              A little advice
              <br />
              for your edges.
            </h2>
            <p>
              Ask about the current image, settings, or preview. Your adviser
              gets the source image, CSS values, preview shape, background and
              text with each message.
            </p>
            <span className="context-tag">
              ● Current workbench context attached
            </span>
          </div>
          <div className="chat">
            <div className="messages" aria-live="polite">
              {messages.length ? (
                messages.map((m, i) => (
                  <div className={`message ${m.role}`} key={i}>
                    <strong>{m.role === "user" ? "You" : "Antigravity"}</strong>
                    <p>{m.text}</p>
                  </div>
                ))
              ) : (
                <div className="chat-welcome">
                  <span>WHERE SHALL WE START?</span>
                  <p>
                    “Why are my corners getting cut off?”
                    <br />
                    “How do I make the edges repeat evenly?”
                  </p>
                </div>
              )}
              {busy === "chat" && (
                <p role="status">Thinking about your frame…</p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) void run("chat");
              }}
            >
              <input
                aria-label="Ask the adviser"
                placeholder="Ask about your border image…"
                value={question}
                maxLength={2000}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button className="primary" disabled={!!busy || !question.trim()}>
                Ask ↗
              </button>
            </form>
            <p className="privacy-note">
              Messages and images are sent to AI on request. Chat resets on
              reload. Hosted AI jobs expire after 24 hours and are cleared
              hourly.
            </p>
          </div>
        </section>
        <footer>
          <a className="brand" href="#">
            ▧ border/image <span className="lab">LAB</span>
          </a>
          <span>Made for curious minds and interesting edges.</span>
          <span>LEARN. EXPLORE. MAKE.</span>
        </footer>
      </main>
    </>
  );
}
