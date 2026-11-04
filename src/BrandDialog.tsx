import { useState } from "react";
import { Dialog } from "../vendor/formlane/src/components/Dialog";
import { themePresets, type ThemeId } from "../vendor/formlane/src/model";
import { paletteProblems, type Palette } from "../vendor/formlane/src/theme";
import type { Theme } from "./workspace";
import type { BrandDraft } from "./brand";

export function BrandDialog({
  name,
  theme,
  close,
  preview,
}: {
  name: string;
  theme?: Theme;
  close: () => void;
  preview: (draft: BrandDraft) => void;
}) {
  const [draft, setDraft] = useState<BrandDraft>({
    name,
    theme: theme ?? { preset: "grove", font: "serif", radius: 12 },
    allPages: true,
  });
  const colors =
    draft.theme.palette ??
    draft.theme.custom ??
    themePresets[draft.theme.preset];
  const problems = draft.theme.palette ? paletteProblems(colors) : [];
  return (
    <Dialog title="Shared brand" close={close}>
      <form
        className="brand-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!problems.length) preview(draft);
        }}
      >
        <label>
          Brand name
          <input
            aria-label="Brand name"
            value={draft.name}
            maxLength={80}
            required
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Theme
          <select
            aria-label="Brand theme"
            value={draft.theme.preset}
            onChange={(e) => {
              const preset = e.target.value as ThemeId,
                value = themePresets[preset];
              setDraft({
                ...draft,
                theme: { preset, font: value.font, radius: value.radius },
              });
            }}
          >
            {Object.entries(themePresets).map(([id, value]) => (
              <option key={id} value={id}>
                {value.name}
              </option>
            ))}
          </select>
        </label>
        <div className="brand-palette">
          {(["accent", "surface", "ink", "soft"] as (keyof Palette)[]).map(
            (key) => (
              <label key={key}>
                {key}
                <input
                  type="color"
                  aria-label={`Brand ${key} color`}
                  value={colors[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      theme: {
                        ...draft.theme,
                        palette: {
                          accent: colors.accent,
                          surface: colors.surface,
                          ink: colors.ink,
                          soft: colors.soft,
                          [key]: e.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            ),
          )}
        </div>
        <label>
          Heading font
          <select
            aria-label="Brand heading font"
            value={draft.theme.font}
            onChange={(e) =>
              setDraft({
                ...draft,
                theme: {
                  ...draft.theme,
                  font: e.target.value as "serif" | "sans",
                },
              })
            }
          >
            <option value="serif">Serif</option>
            <option value="sans">Sans serif</option>
          </select>
        </label>
        <label>
          Corners: {draft.theme.radius}px
          <input
            aria-label="Brand corner radius"
            type="range"
            min={0}
            max={24}
            value={draft.theme.radius}
            onChange={(e) =>
              setDraft({
                ...draft,
                theme: { ...draft.theme, radius: Number(e.target.value) },
              })
            }
          />
        </label>
        <label>
          Apply to
          <select
            aria-label="Brand scope"
            value={draft.allPages ? "all" : "page"}
            onChange={(e) =>
              setDraft({ ...draft, allPages: e.target.value === "all" })
            }
          >
            <option value="all">All pages and new pages</option>
            <option value="page">Current page only</option>
          </select>
        </label>
        <p>
          Preview before applying. Content, component styles and borders stay.
          Page-wide Styler styles on the chosen pages are replaced. The brand
          name is shared throughout the workspace.
        </p>
        {problems.length > 0 && <p role="alert">{problems.join(" ")}</p>}
        <button
          className="primary"
          disabled={!!problems.length || !draft.name.trim()}
        >
          Preview brand
        </button>
      </form>
    </Dialog>
  );
}
