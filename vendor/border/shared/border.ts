export const modes = ["stretch", "repeat", "round", "space"] as const;
export type Repeat = (typeof modes)[number];
export type Quad = [number, number, number, number];
export interface Settings {
  slice: Quad;
  sliceUnit: "%" | "";
  fill: boolean;
  width: Quad;
  widthUnit: "px" | "%" | "" | "auto";
  outset: Quad;
  outsetUnit: "px" | "";
  repeat: [Repeat, Repeat];
  border: number;
}
export const initial: Settings = {
  slice: [25, 25, 25, 25],
  sliceUnit: "%",
  fill: false,
  width: [28, 28, 28, 28],
  widthUnit: "px",
  outset: [0, 0, 0, 0],
  outsetUnit: "px",
  repeat: ["round", "round"],
  border: 28,
};
export function quad(values: Quad, unit: string) {
  return unit === "auto" ? "auto" : values.map((n) => `${n}${unit}`).join(" ");
}
export function declarations(s: Settings) {
  return {
    borderImageSlice: quad(s.slice, s.sliceUnit) + (s.fill ? " fill" : ""),
    borderImageWidth: quad(s.width, s.widthUnit),
    borderImageOutset: quad(s.outset, s.outsetUnit),
    borderImageRepeat: s.repeat.join(" "),
  };
}
export function css(s: Settings, filename = "border.png", shorthand = false) {
  const d = declarations(s),
    source = `url(${JSON.stringify(filename)})`;
  return (
    `.framed-box {\n  border: ${s.border}px solid transparent;\n` +
    (shorthand
      ? `  border-image: ${source} ${d.borderImageSlice} / ${d.borderImageWidth} / ${d.borderImageOutset} ${d.borderImageRepeat};\n`
      : `  border-image-source: ${source};\n  border-image-slice: ${d.borderImageSlice};\n  border-image-width: ${d.borderImageWidth};\n  border-image-outset: ${d.borderImageOutset};\n  border-image-repeat: ${d.borderImageRepeat};\n`) +
    "}"
  );
}
export function parseSettings(raw: unknown): Settings {
  const s = raw as Settings;
  if (
    !s ||
    typeof s !== "object" ||
    Object.keys(s).sort().join() !== Object.keys(initial).sort().join()
  )
    throw new Error("Invalid border settings.");
  for (const [key, max] of [
    ["slice", 40000],
    ["width", 200],
    ["outset", 100],
  ] as const) {
    if (
      !Array.isArray(s[key]) ||
      s[key].length !== 4 ||
      s[key].some(
        (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max,
      )
    )
      throw new Error("Invalid border values.");
  }
  if (
    !["%", ""].includes(s.sliceUnit) ||
    !["px", "%", "", "auto"].includes(s.widthUnit) ||
    !["px", ""].includes(s.outsetUnit) ||
    typeof s.fill !== "boolean" ||
    !Array.isArray(s.repeat) ||
    s.repeat.length !== 2 ||
    s.repeat.some((n) => !modes.includes(n)) ||
    !Number.isFinite(s.border) ||
    s.border < 1 ||
    s.border > 100
  )
    throw new Error("Invalid border settings.");
  if (s.sliceUnit === "%" && s.slice.some((n) => n > 100))
    throw new Error("Invalid percentage.");
  return structuredClone(s);
}
export interface Suggestion {
  name: string;
  reason: string;
  settings: Settings;
}
export interface AIResult {
  advice: string;
  suggestions?: Suggestion[];
  crop?: { x: number; y: number; width: number; height: number };
}
export function parseResult(raw: unknown, action: string): AIResult {
  const r = raw as AIResult;
  if (!r || typeof r.advice !== "string" || r.advice.length > 6000)
    throw new Error("Invalid AI response.");
  const result: AIResult = { advice: r.advice };
  if (action === "suggest" || action === "analyze") {
    if (!Array.isArray(r.suggestions) || r.suggestions.length !== 3)
      throw new Error("Expected three suggestions.");
    result.suggestions = r.suggestions.map((s) => {
      if (
        typeof s.name !== "string" ||
        s.name.length > 70 ||
        typeof s.reason !== "string" ||
        s.reason.length > 1000
      )
        throw new Error("Invalid suggestion.");
      return {
        name: s.name,
        reason: s.reason,
        settings: parseSettings(s.settings),
      };
    });
  }
  if (action === "analyze") {
    const c = r.crop;
    if (
      !c ||
      ![c.x, c.y, c.width, c.height].every(Number.isFinite) ||
      c.x < 0 ||
      c.y < 0 ||
      c.width <= 0 ||
      c.height <= 0 ||
      c.x + c.width > 100 ||
      c.y + c.height > 100
    )
      throw new Error("Invalid crop.");
    result.crop = { x: c.x, y: c.y, width: c.width, height: c.height };
  }
  return result;
}
