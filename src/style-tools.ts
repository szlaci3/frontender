import {
  declarationId,
  parseStyle,
  properties,
  type Property,
  type SelectorId,
  type Style,
} from "../vendor/styler/shared/style";
import {
  constrainStyle,
  parseSnapshot,
  type Snapshot,
} from "../vendor/styler/shared/constraints";

export const emptyStyle = parseStyle({
  schemaVersion: 1,
  id: "CustomDraft",
  name: "Custom style",
  provenance: "seed",
  rules: [],
});
export const declarationValue = (
  style: Style,
  selector: SelectorId,
  property: Property,
) =>
  style.rules
    .find((rule) => rule.selectorId === selector)
    ?.declarations.find((d) => d.property === property)?.value;

export function editDeclaration(
  style: Style,
  selector: SelectorId,
  property: Property,
  value?: string,
): Style {
  const rules = style.rules.map((rule) => ({
    ...rule,
    declarations: [...rule.declarations],
  }));
  let rule = rules.find((rule) => rule.selectorId === selector);
  if (!rule) {
    rule = { selectorId: selector, declarations: [] };
    rules.push(rule);
  }
  rule.declarations = rule.declarations.filter((d) => d.property !== property);
  if (value !== undefined)
    rule.declarations.push({
      id: declarationId(selector, property),
      property,
      value,
    });
  return parseStyle({
    ...style,
    rules: rules.filter((rule) => rule.declarations.length),
  });
}

export function setLock(
  snapshot: Snapshot,
  selector: SelectorId,
  property: Property,
  value: string,
): Snapshot {
  return parseSnapshot([
    ...snapshot.filter(
      (c) => c.selectorId !== selector || c.property !== property,
    ),
    { selectorId: selector, property, state: "locked", value },
  ]);
}
// As in Styler, Unset is a generation instruction. It does not remove a
// declaration from the current preview; Delete is the explicit editing action.
export const visibleStyle = (style: Style, constraints: Snapshot) =>
  constrainStyle(
    style,
    constraints.filter((c) => c.state === "locked"),
  );

export function normalizeValue(
  property: Property,
  raw: string,
  fontSize = "16px",
): string | undefined {
  let value = raw.replace(/rgba?\(([^)]+)\)/g, (_, channels: string) => {
    const parts = channels.split(",").map(Number);
    return (
      "#" +
      parts
        .slice(0, 3)
        .map((n) => Math.round(n).toString(16).padStart(2, "0"))
        .join("") +
      (parts.length === 4
        ? Math.round(parts[3] * 255)
            .toString(16)
            .padStart(2, "0")
        : "")
    );
  });
  if (property === "font-family") value = value.replaceAll('"', "'");
  if (property === "line-height" && value.endsWith("px"))
    value = String(
      Math.round((parseFloat(value) / parseFloat(fontSize)) * 100) / 100,
    );
  if (property === "box-shadow" && value !== "none") {
    const parts = value.split(" ");
    if (parts[0]?.startsWith("#"))
      value = [...parts.slice(1), parts[0]].join(" ");
  }
  if (/^-?\d+\.\d+px$/.test(value))
    value = `${Math.round(parseFloat(value) * 100) / 100}px`;
  return value.length <= 160 && properties[property](value) ? value : undefined;
}

export function savedStyle(style: Style, name: string): Style {
  return parseStyle({
    ...style,
    id: `Saved_${crypto.randomUUID()}`,
    name: name.trim(),
    provenance: "preset",
  });
}
