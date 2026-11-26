# Theming

Anta works without a theme. Customize individual components through their props
or with classes in your application CSS.

When an application needs many customizations or a global change to Anta's look
and feel, add a theme stylesheet. Import one theme after the package styles:

```ts
import '@antadesign/anta/theme-antune.css' // Choose one theme included in the package.
```

Antune and the default styles are MIT licensed. The Antithesis theme
(`@antadesign/anta/theme-antithesis.css`) is copyright Antithesis Operations LLC
and has a [separate noncommercial license](https://github.com/antithesishq/anta/blob/main/theme-antithesis-license.md).
Commercial use of that theme requires prior written permission through the
[Antithesis contact page](https://antithesis.com/company/contact/). You can use
Anta commercially under MIT with the default styles, Antune, or your own theme.

<a id="fonts-in-a-theme"></a>

## Font family

Anta's themes do not load fonts. `tokens.css` defines three system font stacks,
which the optional themes preserve:

```css
:root, .light {
  --sans-serif: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  --serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --monospace: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco,
    Consolas, "Liberation Mono", monospace;
}
```

Components and theme rules choose which variable to use. For example, body text
can use `--sans-serif` while a particular title style uses `--serif`. Package
styles do not force font-specific stylistic sets or variable-font axes.

Host your font files in your application and register them in a separate
stylesheet such as `fonts.css`. Load it after Anta's styles and optional theme:

```css
/* fonts.css */
@font-face {
  font-family: "App Sans";
  src: url("/fonts/app-sans.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --sans-serif: "App Sans", system-ui, sans-serif;
  --serif: Georgia, serif;
  --monospace: ui-monospace, monospace;
}
```

Alternatively, use the [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2)
to load your chosen families. This example includes regular and italic styles:

```css
/* fonts.css: place @import before other rules. */
@import url("https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,600;1,400;1,600&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400;1,600&family=Source+Serif+4:ital,wght@0,400;0,600;1,400;1,600&display=swap");

:root {
  --sans-serif: "Inter", sans-serif;
  --serif: "Source Serif 4", serif;
  --monospace: "JetBrains Mono", monospace;
}
```

Choose the styles and weights your app uses. Loading Google Fonts makes requests
to Google's servers; self-host font files when you need all assets on your own
origin.

The anta.design website loads its reference fonts through separate
[Antune font CSS](https://anta.design/themes/fonts-antune.css) and
[Antithesis font CSS](https://anta.design/themes/fonts-antithesis.css). These
site stylesheets show the website's font-face declarations, font stacks, and
font-specific axis settings. They are examples of application font setup and
are not imported by the published themes. Use your own font stylesheet and
font sources in your application.

<a id="text-and-hint-sizes"></a>

## Font sizes

Font sizes are CSS lengths. Line heights are unitless ratios that scale with
nested font sizes. For example, `calc(22 / 15)` gives 15px text a 22px line height.

### Main text

Use `--font-size-SIZE` and `--line-height-SIZE` for each size below.

| Size | Font size | Line height |
| --- | --- | --- |
| Micro | 11px | `calc(15 / 11)` |
| Tiny | 12px | `calc(16 / 12)` |
| Small | 13px | `calc(18 / 13)` |
| Medium | 15px | `calc(22 / 15)` |
| Large | 17px | `calc(26 / 17)` |

### Hints

Hints have an independent scale through `--font-size-hint-SIZE` and
`--line-height-hint-SIZE`.

| Size | Font size | Line height |
| --- | --- | --- |
| Small | 12px | `calc(16 / 12)` |
| Medium | 14px | `calc(20 / 14)` |
| Large | 16px | `calc(24 / 16)` |

### Heading sizes

Title, Expander summaries, native disclosure summaries, and raw headings share
six heading levels. Dialog headers use level 4. Each level uses
`--font-size-heading-N` and `--line-height-heading-N`, where `N` is 1 through 6.

| Level | Font size | Line height |
| --- | --- | --- |
| 1 | 28px | `calc(34 / 28)` |
| 2 | 24px | `calc(30 / 24)` |
| 3 | 20px | `calc(26 / 20)` |
| 4 | 17px | `calc(24 / 17)` |
| 5 | 15px | `calc(22 / 15)` |
| 6 | 13px | `calc(18 / 13)` |

### Menu labels

Menu labels use `--font-size-menu-medium`, independently of the field size.

| Size | Font size | Line height |
| --- | --- | --- |
| Medium | 14px | `calc(20 / 14)` |

### Menu hints

Menu hints use `--font-size-menu-hint-medium`.

| Size | Font size | Line height |
| --- | --- | --- |
| Medium | 12px | `calc(16 / 12)` |

### Code blocks

Code blocks use `--font-size-code-block-medium` and
`--line-height-code-block-medium`.

| Size | Font size | Line height |
| --- | --- | --- |
| Medium | 13px | `calc(20 / 13)` |

### Customize sizes

Override font-size tokens with lengths and line-height tokens with unitless
values. To give medium text a 24px line height at its default 15px font size:

```css
:root {
  --line-height-medium: calc(24 / 15);
}
```

For an individual component, set `font-size` and `line-height` on its styled
element or exposed part.

### Text compensation

Button and Tabs share label bottom-padding compensation through
`--text-compensation-small` (0.5px), `--text-compensation-medium` (1px), and
`--text-compensation-large` (1.5px). Their outer padding absorbs this amount to
retain control heights. Buttons inside field action slots disable compensation.

<a id="color-seeds"></a>

## Color seeds

In your custom theme, override any of Anta's six seed color tokens to recolor
components. These overrides can live in any application stylesheet:

- `--anta-seed-neutral`
- `--anta-seed-brand`
- `--anta-seed-info`
- `--anta-seed-success`
- `--anta-seed-warning`
- `--anta-seed-critical`

```css
:root {
  --anta-seed-brand: #0f766e; /* a teal brand; every brand token follows */
}
```

A colored seed sets the hue of its tone. Its lightness and chroma carry through
within limits that keep text readable:

- Solid fills, such as a primary Button or a checked Checkbox, use the seed's
  lightness between 0.42 and 0.85 in light mode and between 0.38 and 0.80 in
  dark mode. A seed outside that range moves to the nearest end.
- The label or mark on a fill is white below a fill lightness of 0.72 and dark
  above it. Anta picks that point with APCA, which rates the two labels equal
  there.
- Toned text uses the seed's lightness between 0.30 and 0.46 in light mode and
  between 0.86 and 0.92 in dark mode.
- Tinted backgrounds and borders keep a fixed lightness.
- Chroma follows the seed up to a cap, so a muted seed gives a muted tone.

Lightness and chroma are OKLCH values. WCAG 2 rates a white label below 4.5:1
on a fill lighter than about 0.58, so fills between 0.58 and 0.72 fail that
ratio. The default warning fill is one of them, at 3.6:1. When you need the
WCAG 2 ratio, set a seed darker than 0.58.

A custom `tone` color on Button, Checkbox, Radio, Switch, or Tag follows the
same limits. Neutral tokens keep fixed lightness. The Antune and Antithesis
themes set most tone colors directly, so seeds have little effect while one is
loaded.

For more control, customize the `--text-*`, `--bg-*`, and `--border-*` tokens
separately for light and dark modes.

Anta's styles use ordered child layers inside `@layer anta`. Your regular
unlayered CSS overrides them without `!important`.

<a id="themes"></a>

## Themes

Compare the same components across themes. Select a tab to preview the theme and
read its stylesheet.

<a id="theming-lab"></a>

## Theming lab

The lab below shows the derivation live. For each toned component, the shipped Default sits next to a Custom preview driven by the seed picker, with the formula constants editable and the resolved CSS shown.


## Theming lab reference

The lab varies a tone seed and formula inputs in light and dark mode. These inputs describe the lab's calculations. For application styling, use tone props, global role tokens, CSS, and the parts documented on each component page.

| Tone | Seed property | Initial lab seed |
| --- | --- | --- |
| neutral | `--anta-seed-neutral` | `#635b65` |
| brand | `--anta-seed-brand` | `#5f4bc3` |
| info | `--anta-seed-info` | `#1f6eb2` |
| success | `--anta-seed-success` | `#2a7e43` |
| warning | `--anta-seed-warning` | `#c37416` |
| critical | `--anta-seed-critical` | `#c9302c` |

### Background and Borders

The container background and border role scales. Each step keeps a pinned lightness: backgrounds sit near the page with a faint tint that grows per step, and borders step from a saturated edge (border-1) to the faint border-5. Chroma scales with the seed. At the reference chroma a step gets the chroma listed here, a more muted seed gets less, and a more vivid one gets at most the headroom multiple. Neutral pins its chroma by setting the reference near zero.

#### Background

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bg-1 L | 1 | 0 | 1 | 0 | 0–1 | 0.005 |  |
| bg-2 L | 0.99 | 0.13 | 0.985 | 0.16 | 0–1 | 0.005 |  |
| bg-2 C | 0.004 | 0.02 | 0.002 | 0.002 | 0–0.4 | 0.005 |  |
| bg-3 L | 0.972 | 0.17 | 0.97 | 0.177 | 0–1 | 0.005 |  |
| bg-3 C | 0.011 | 0.035 | 0.004 | 0.005 | 0–0.4 | 0.005 |  |
| bg-4 L | 0.955 | 0.185 | 0.954 | 0.191 | 0–1 | 0.005 |  |
| bg-4 C | 0.02 | 0.05 | 0.004 | 0.006 | 0–0.4 | 0.005 |  |
| bg-5 L | 0.935 | 0.205 | 0.935 | 0.2 | 0–1 | 0.005 |  |
| bg-5 C | 0.03 | 0.055 | 0.006 | 0.009 | 0–0.4 | 0.005 |  |

#### Border

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| border-1 L | 0.67 | 0.52 | 0.67 | 0.52 | 0–1 | 0.005 |  |
| border-1 C | 0.13 | 0.15 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-2 L | 0.8 | 0.41 | 0.8 | 0.41 | 0–1 | 0.005 |  |
| border-2 C | 0.09 | 0.12 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-3 L | 0.86 | 0.33 | 0.86 | 0.33 | 0–1 | 0.005 |  |
| border-3 C | 0.055 | 0.09 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-4 L | 0.9 | 0.26 | 0.9 | 0.26 | 0–1 | 0.005 |  |
| border-4 C | 0.04 | 0.06 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-5 L | 0.935 | 0.21 | 0.935 | 0.21 | 0–1 | 0.005 |  |
| border-5 C | 0.028 | 0.045 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |

#### Seed chroma

Shared by every background and border step.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reference C | 0.17 | 0.17 | 0.001 | 0.001 | 0.001–0.4 | 0.001 | Seed chroma at which each step gets the chroma listed for it. Neutral sets it near zero, so every step takes its listed chroma. |
| C headroom | 1.25 | 1.25 | 1 | 1 | 1–2 | 0.05 | How far above its listed chroma a step may go for a seed more vivid than the reference. |

### Text

The text color role scale. text-2 is the base: it takes the seed’s lightness inside a window, which keeps it readable on a surface, and the seed’s chroma, scaled and capped. text-1 is the strong primary, a lightness step away from text-2 with less chroma. text-3/4 step text-2 down by alpha; Title and Text read text-1..4 as their priorities. text-5 is the faintest step (the disabled / hint tone). Neutral closes the window to one lightness.

#### Secondary

text-2 base.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-2 L min | 0.3 | 0.86 | 0.3 | 0.8 | 0–1 | 0.005 | Lower end of the lightness window. In dark mode this end sets contrast with the surface. |
| text-2 L max | 0.46 | 0.92 | 0.3 | 0.8 | 0–1 | 0.005 | Upper end of the lightness window. In light mode this end sets contrast with the surface. |
| text-2 C scale | 1 | 0.75 | 1 | 1 | 0–2 | 0.05 | Multiplies the seed’s chroma. |
| text-2 C cap | 0.17 | 0.13 | 0.015 | 0.015 | 0–0.4 | 0.005 |  |

#### Primary

text-1, derived from text-2.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-1 L shift | -0.05 | 0.04 | -0.2 | 0.14 | -0.5–0.5 | 0.005 | Added to text-2’s lightness. |
| text-1 C scale | 0.75 | 0.75 | 0.6667 | 0.5333 | 0–2 | 0.05 | Multiplies text-2’s chroma. |

#### Tertiary

text-2 base at this alpha (→ text-3).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-3 α % | 82 | 80 | 82 | 80 | 0–100 | 1 |  |

#### Quaternary

text-2 base at this alpha (→ text-4).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-4 α % | 66 | 62 | 66 | 62 | 0–100 | 1 |  |

#### Faint (text-5)

text-2 base at this alpha (→ text-5) — the disabled / hint step, not a Title/Text priority.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-5 α % | 40 | 40 | 40 | 40 | 0–100 | 1 |  |

### Buttons

The primary fill takes the seed’s lightness inside a window and its chroma, scaled and capped. Hover and active shift that lightness, and the label turns from white to dark above the flip point. Secondary, tertiary, and quaternary share one foreground, which takes the seed’s lightness inside a narrower window. Secondary and tertiary share an alpha-tinted fill at a pinned lightness (tertiary a step softer, transparent at rest); quaternary has none. Neutral closes both windows to one lightness.

#### Primary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill L min | 0.42 | 0.38 | 0.5 | 0.4 | 0–1 | 0.005 | A darker seed is raised to this lightness. |
| fill L max | 0.85 | 0.8 | 0.5 | 0.4 | 0–1 | 0.005 | A lighter seed is lowered to this lightness. |
| hover L shift | -0.05 | 0.04 | -0.05 | 0.04 | -0.3–0.3 | 0.005 |  |
| active L shift | -0.1 | 0.08 | -0.1 | 0.08 | -0.3–0.3 | 0.005 |  |
| fill C scale | 1 | 0.9 | 2 | 2 | 0–2 | 0.05 | Multiplies the seed’s chroma. |
| fill C cap | 0.22 | 0.2 | 0.02 | 0.015 | 0–0.4 | 0.005 |  |
| label flip L | 0.72 | 0.72 | 0.72 | 0.72 | 0–1 | 0.005 | The label is white on a fill darker than this and dark on a lighter one. 0.72 is where APCA rates the two equal. WCAG 2 puts that point near 0.58. |

#### Secondary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L min | 0.3 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg L max | 0.46 | 0.92 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg hover L shift | -0.06 | 0 | -0.06 | 0 | -0.3–0.3 | 0.005 |  |
| fg C scale | 1 | 0.75 | 1 | 1 | 0–2 | 0.05 |  |
| fg C cap | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| tint L | 0.54 | 0.58 | 0.54 | 0.44 | 0–1 | 0.005 | Pinned. The seed’s lightness does not reach the tint. |
| tint C scale | 1 | 1 | 2 | 2 | 0–2 | 0.05 |  |
| tint C cap | 0.17 | 0.16 | 0.03 | 0.01 | 0–0.4 | 0.005 |  |
| α rest | 0.1 | 0.215 | 0.1 | 0.24 | 0–1 | 0.005 |  |
| α hover | 0.15 | 0.29 | 0.15 | 0.34 | 0–1 | 0.005 |  |
| α active | 0.2 | 0.34 | 0.2 | 0.44 | 0–1 | 0.005 |  |

#### Tertiary

Reuses the secondary foreground + tint (no separate Anta constant).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L min | 0.3 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg L max | 0.46 | 0.92 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg hover L shift | -0.06 | 0 | -0.06 | 0 | -0.3–0.3 | 0.005 |  |
| fg C scale | 1 | 0.75 | 1 | 1 | 0–2 | 0.05 |  |
| fg C cap | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| tint L | 0.54 | 0.58 | 0.54 | 0.44 | 0–1 | 0.005 | Pinned. The seed’s lightness does not reach the tint. |
| tint C scale | 1 | 1 | 2 | 2 | 0–2 | 0.05 |  |
| tint C cap | 0.17 | 0.16 | 0.03 | 0.01 | 0–0.4 | 0.005 |  |
| α rest | 0.1 | 0.215 | 0.1 | 0.24 | 0–1 | 0.005 |  |
| α hover | 0.15 | 0.29 | 0.15 | 0.34 | 0–1 | 0.005 |  |

#### Quaternary

Rest (and active) is the tertiary foreground at the rest α; hover uses its own lightness shift at full opacity. No fill.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L min | 0.3 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg L max | 0.46 | 0.92 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg C scale | 1 | 0.75 | 1 | 1 | 0–2 | 0.05 |  |
| fg C cap | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| hover L shift | -0.08 | 0.04 | -0.08 | 0.04 | -0.3–0.3 | 0.005 | Quaternary hover lightness shift, its own value. Rest and active carry the rest α; hover is opaque. |
| α rest | 0.85 | 0.85 | 0.85 | 0.85 | 0–1 | 0.005 | Alpha on the quaternary rest (and active) foreground. Light-mode neutral needs ≈0.83 to clear WCAG AA (4.5:1) over bg-2. |

### Tags

Primary is a solid fill that takes the seed’s lightness inside a window and its chroma, scaled and capped; its label turns from white to dark above the flip point. Secondary is an alpha tint at a pinned lightness; tertiary an outline. The label and edge are the Text scale — edge = --text-2, label = --text-2 at the label α (--text-3’s), tunable per Tag (e.g. raise it for small-text contrast). Alphas set each priority’s strength. Neutral closes the window to one lightness.

#### Primary

Solid fill; the label is white or dark by the fill’s lightness.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| solid L min | 0.42 | 0.38 | 0.55 | 0.48 | 0–1 | 0.005 |  |
| solid L max | 0.85 | 0.8 | 0.55 | 0.48 | 0–1 | 0.005 |  |
| solid C scale | 1 | 0.9 | 2 | 2 | 0–2 | 0.05 | Multiplies the seed’s chroma. |
| solid C cap | 0.22 | 0.2 | 0.015 | 0.015 | 0–0.4 | 0.005 |  |
| label flip L | 0.72 | 0.72 | 0.72 | 0.72 | 0–1 | 0.005 | The label is white on a fill darker than this and dark on a lighter one. |

#### Secondary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tint L | 0.57 | 0.63 | 0.55 | 0.63 | 0–1 | 0.005 |  |
| tint C scale | 1 | 1 | 3 | 3 | 0–3 | 0.05 |  |
| tint C cap | 0.16 | 0.17 | 0.03 | 0.04 | 0–0.4 | 0.005 |  |
| fill α % | 10 | 20 | 10 | 20 | 0–100 | 1 |  |
| border α % | 15 | 25 | 15 | 25 | 0–100 | 1 |  |

#### Tertiary

Outline alpha; the edge color is --text-2.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| edge α % | 20 | 30 | 20 | 30 | 0–100 | 1 |  |

#### Label

Label = --text-2 at this alpha, matching --text-3. Raise for small-text contrast.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| label α % | 82 | 80 | 82 | 80 | 0–100 | 1 |  |

### Tabs

The strip’s primary/secondary/tertiary differ structurally (filled track vs subtle vs underline). Labels and rings are the role scale: selected/hover = --text-1, rest = --text-2 at the rest α (80 → --text-3), tertiary hover = --text-2, track ring = --border-4, selected ring = --border-2, selected pill = --bg-1. Only the recessed track tint, secondary fill, and the rest α are the Tabs’ own — the knobs below.

#### Track & fill

The recessed track tint (primary) and the selected secondary fill — a faint overlay of the source hue.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill L | 0.55 | 0.8 | 0.55 | 0.8 | 0–1 | 0.005 |  |
| fill C | 0.14 | 0.12 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| track α | 0.06 | 0.07 | 0.06 | 0.07 | 0–1 | 0.005 |  |
| fill α | 0.03 | 0.08 | 0.03 | 0.08 | 0–1 | 0.005 |  |

#### Rest label

Non-selected label = --text-2 at this alpha (80 → --text-3). Selected/hover use full --text-1.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest α % | 80 | 80 | 80 | 80 | 0–100 | 1 |  |

### Checkboxes

The checked fill takes the seed’s lightness inside a window and its chroma, scaled and capped. Hover and active shift that lightness, and the checkmark turns dark above the flip point. In all scope, the off-state box border ramps off a pinned-lightness version of the tone mixed toward neutral grey; selected scope keeps it neutral. Neutral closes the window to one lightness.

#### Fill

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill L min | 0.42 | 0.38 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| fill L max | 0.85 | 0.8 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| hover L shift | -0.05 | 0.04 | -0.15 | 0.03 | -0.3–0.3 | 0.005 |  |
| active L shift | -0.1 | 0.08 | -0.2 | 0.08 | -0.3–0.3 | 0.005 |  |
| fill C scale | 1 | 0.9 | 1 | 1 | 0–2 | 0.05 | Multiplies the seed’s chroma. |
| fill C cap | 0.22 | 0.2 | 0.4 | 0.4 | 0–0.4 | 0.005 |  |
| checkmark flip L | 0.72 | 0.72 | 0.72 | 0.72 | 0–1 | 0.005 | The checkmark is light on a fill darker than this and dark on a lighter one. |
| checkmark L | 0.97 | 0.97 | 0.97 | 0.935 | 0–1 | 0.005 | Lightness of the checkmark on a fill darker than the flip point. |

### Radio

Identical fill formula to Checkbox: the selected mark takes the seed’s lightness inside a window, and the dot turns dark above the flip point. All scope also ramps the off-ring border from a pinned-lightness version of the tone; selected scope keeps unpicked options neutral.

#### Fill

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill L min | 0.42 | 0.38 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| fill L max | 0.85 | 0.8 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| hover L shift | -0.05 | 0.04 | -0.15 | 0.03 | -0.3–0.3 | 0.005 |  |
| active L shift | -0.1 | 0.08 | -0.2 | 0.08 | -0.3–0.3 | 0.005 |  |
| fill C scale | 1 | 0.9 | 1 | 1 | 0–2 | 0.05 | Multiplies the seed’s chroma. |
| fill C cap | 0.22 | 0.2 | 0.4 | 0.4 | 0–0.4 | 0.005 |  |
| dot flip L | 0.72 | 0.72 | 0.72 | 0.72 | 0–1 | 0.005 | The dot is light on a fill darker than this and dark on a lighter one. |
| dot L | 0.97 | 0.97 | 0.97 | 0.935 | 0–1 | 0.005 | Lightness of the dot on a fill darker than the flip point. |

### Expander

Every color is a role token; the Expander defines none of its own. Label: rest --text-2, hover --text-1 (Title’s secondary/primary). Fill and border are the surface scale (secondary --bg-2 / --border-5, primary --bg-4 / --border-4), and the fill lightens a step on hover. Tertiary is text only, all themed per tone.

### Input

One border color from the seed hue at a tunable L/C — the goal is a single L/C per theme that works across every tone. Hover thickens the edge 0.5→1px (no recolor). Neutral overrides pin it grey (≈ --border-2). Applies to Input and the InputDate trigger (both compose <a-input>).

#### Border

Seed hue at this L/C (hover thickens the edge, no recolor). Toned starts at the average of today’s per-status literals; neutral pins grey ≈ --border-2.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| border L | 0.58 | 0.52 | 0.8 | 0.4 | 0–1 | 0.005 |  |
| border C | 0.18 | 0.15 | 0.015 | 0.019 | 0–0.4 | 0.005 |  |

### Menu items

The item label is --text-2; the hint and icon are --text-2 at the hint α (80 → --text-3), so the text follows the Text spec while the hint strength stays tunable. The selected row holds a persistent tint of the label color — its alpha is the Menu’s own knob too.

#### Text

Label is full --text-2; hint + icon are --text-2 at this alpha (80 → --text-3).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hint α % | 80 | 80 | 80 | 80 | 0–100 | 1 |  |

#### Selected

Tint held on the selected row — a % of the item color (--text-2).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| selected α % | 9 | 12 | 9 | 12 | 0–100 | 1 |  |

### Progress

Every color is a role token; Progress defines none of its own. Track = --bg-4, border = --border-4, the fill indicator = --bg-5, the label = --text-2, and the right-aligned hint = --text-3. Named tones swap in the matching -{tone} role variant (so dark mode is free), and the fill’s right-edge fades from --bg-5 to --border-4. Follows the Text and Background & Borders panels live.
