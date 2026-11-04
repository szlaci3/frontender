import { useState } from "react";
import {
  AddDeclaration,
  EditableValue,
} from "../vendor/styler/src/components/CssEditing";
import { makeInspectionGroups } from "../vendor/styler/src/preview/inspection";
import {
  type Property,
  type SelectorId,
  type Style,
} from "../vendor/styler/shared/style";
import type { Snapshot } from "../vendor/styler/shared/constraints";
import { declarationValue, normalizeValue } from "./style-tools";

export function StyleInspector({
  style,
  baseline,
  constraints,
  computed,
  edit,
  reset,
  toggle,
  save,
  disabled,
}: {
  style: Style;
  baseline: Style;
  constraints: Snapshot;
  computed: Record<string, string>;
  edit: (selector: SelectorId, property: Property, value?: string) => void;
  reset: (selector: SelectorId, property: Property) => void;
  toggle: (
    selector: SelectorId,
    property: Property,
    state: "locked" | "unset",
    value?: string,
  ) => void;
  save: (name: string) => boolean;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const groups = makeInspectionGroups([style, baseline]);
  for (const c of constraints) {
    const group = groups.find((g) => g.selectorId === c.selectorId)!;
    if (!group.properties.includes(c.property))
      group.properties.push(c.property);
  }
  return (
    <section className="style-inspector" aria-label="CSS inspector">
      <h3>CSS inspector</h3>
      <p className="fine-print">
        Edits preview immediately and lock the value for generation. Apply
        commits the preview. Unset omits a declaration from future generations;
        Delete removes it from this style.
      </p>
      <fieldset disabled={disabled}>
        {groups.map((group) => (
          <details key={group.selectorId} open={group.selectorId === "page"}>
            <summary>{group.selectorId}</summary>
            {group.properties.map((property) => {
              const key = `${group.selectorId}:${property}`;
              const own = declarationValue(style, group.selectorId, property);
              const raw = computed[key];
              const normalized = raw
                ? normalizeValue(
                    property,
                    raw,
                    computed[`${group.selectorId}:font-size`],
                  )
                : undefined;
              const value = own ?? normalized ?? "";
              const constraint = constraints.find(
                (c) =>
                  c.selectorId === group.selectorId && c.property === property,
              );
              const changed =
                own !== declarationValue(baseline, group.selectorId, property);
              return (
                <div className="declaration-row" key={key}>
                  <span>{property}</span>
                  <EditableValue
                    selector={group.selectorId}
                    property={property}
                    value={value}
                    edited={changed}
                    onEdit={edit}
                  />
                  <small
                    aria-label={`Computed ${group.selectorId} ${property}`}
                  >
                    Computed: {raw || "No matching element"}
                  </small>
                  <div className="declaration-actions">
                    <button
                      aria-label={`Lock ${group.selectorId} ${property}`}
                      aria-pressed={constraint?.state === "locked"}
                      disabled={!value}
                      onClick={() =>
                        toggle(group.selectorId, property, "locked", value)
                      }
                    >
                      Lock
                    </button>
                    <button
                      aria-label={`Unset ${group.selectorId} ${property}`}
                      aria-pressed={constraint?.state === "unset"}
                      onClick={() =>
                        toggle(group.selectorId, property, "unset")
                      }
                    >
                      Unset
                    </button>
                    <button
                      aria-label={`Reset ${group.selectorId} ${property}`}
                      disabled={!changed && !constraint}
                      onClick={() => reset(group.selectorId, property)}
                    >
                      Reset
                    </button>
                    <button
                      aria-label={`Delete ${group.selectorId} ${property}`}
                      disabled={own === undefined}
                      onClick={() => edit(group.selectorId, property)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            <AddDeclaration
              selector={group.selectorId}
              existing={group.properties}
              onAdd={edit}
            />
          </details>
        ))}
        <form
          className="save-style"
          onSubmit={(event) => {
            event.preventDefault();
            if (save(name)) {
              setMessage("Style saved in this workspace.");
              setName("");
            } else
              setMessage(
                "Use a name of up to 64 letters, numbers, spaces, dots, apostrophes or hyphens. Maximum 50 saved styles.",
              );
          }}
        >
          <label>
            Preset name
            <input
              aria-label="Preset name"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button
            disabled={!style.rules.some((r) => r.declarations.length)}
            type="submit"
          >
            Save style
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </fieldset>
    </section>
  );
}
