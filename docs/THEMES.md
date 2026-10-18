# Themes

toodly has two independent appearance settings (*Settings → Appearance*):

- **Mode**: *Light*, *Dark* or *System* (follows the operating system).
- **Theme**: the style of the app (colours, shapes, shadows, details).

Any theme can be combined with any mode, except **CRT**, which exists only in dark: when it is selected the mode buttons are disabled.

| Theme | Character |
|---|---|
| **Default** | The classic toodly look. |
| **Material** | Material Design 3: tonal surfaces, pill-shaped buttons, large radii, 28 px dialogs, elevation shadows. |
| **CRT** | Green phosphors on black, square corners, text glow, scanlines and vignette, system monospace font. Dark only. |
| **Nord** | Cool, flat, small radii, no shadows on small controls. |
| **Solarized** | Warm paper (light) or deep teal (dark), hairline borders, very small radii. |
| **Dracula** | Purple neon: luminous halo on focus and on the primary button. Light variant: *Alucard*. |
| **Gruvbox** | Retro warm palette with hard, offset shadows. |
| **Rosé Pine** | Soft, very round, muted pinks and violets. Light variant: *Dawn*. |

The font is the same in every theme. The only exception is CRT, which uses the generic system `monospace` family (no font is named, so it is the monospace font of each operating system).

The choice is stored in `localStorage` (`toodly.theme` for the mode, `toodly.themestyle` for the theme) and shared by all windows.

## How it works

`theme.svelte.ts` sets two things on the `<html>` element:

- the class `dark`, when the effective mode is dark;
- the attribute `data-theme="<id>"`, for every theme except *Default* (which has no attribute).

An inline script in `src/app.html` does the same before the first paint, so there is no flash of the wrong theme at startup.

All colours in the app come from CSS variables (`--bg`, `--panel`, `--accent`…), which Tailwind exposes as `bg-bg`, `bg-panel`, `text-fg`, `text-muted`, `border-border`, `bg-accent`, etc. A theme is nothing more than a block of CSS that redefines those variables. The blocks live in **`src/themes.css`** (imported by `src/app.css`); the *Default* values are in `src/app.css` (`:root` for light, `.dark` for dark).

```css
:root[data-theme='nord'] { /* light variant */ }
:root[data-theme='nord'].dark { /* dark variant */ }
```

## Variable reference

### Colours (required, in the light and in the dark block)

| Variable | Used for |
|---|---|
| `--bg` | background of the main area |
| `--panel` | panels, dialogs, input fields, cards |
| `--sidebar` | the left sidebar |
| `--elev` | raised surfaces: buttons, menus, popovers |
| `--border` | borders and separators |
| `--fg` | main text |
| `--muted` | secondary text |
| `--faint` | tertiary text, placeholders, disabled icons |
| `--hover` | hover background (use a translucent colour) |
| `--active` | selected item background, e.g. the current view in the sidebar (translucent) |
| `--accent` | accent colour: primary button, links, focus ring, selection |
| `--accent-fg` | text on top of `--accent` |
| `--p3` `--p2` `--p1` `--p0` | priority colours: urgent, high, medium, none |
| `--shadow` | shadow of menus and dialogs (any `box-shadow` value) |

Also set `color-scheme: light;` or `color-scheme: dark;` so that native controls (scroll bars, date pickers) follow the theme.

### Shapes (optional; they default to the *Default* theme values)

| Variable | Used for |
|---|---|
| `--radius-sm` `--radius-md` `--radius-lg` `--radius-xl` `--radius-2xl` | Tailwind's `rounded-sm … rounded-2xl` (and bare `rounded`, which maps to `--radius-sm`): cards, rows, tabs, dialogs |
| `--r-ctl` | buttons (`.btn`) |
| `--r-field` | text fields and selects (`.field`) |
| `--r-icon` | icon buttons (`.icon-btn`) |
| `--r-menu` | popup menus (`.menu`) |
| `--r-item` | menu items |
| `--r-gr` `--r-gs` | Graph nodes: top-level groups and sub-groups |

`rounded-full` (checkboxes, dots, switches) is always a circle: it is not a variable. A theme that wants squares must override it, as CRT does.

### Shadows and glow (optional)

| Variable | Used for |
|---|---|
| `--shadow` | menus, dialogs and the `shadow-pop` / `shadow-lg` utilities |
| `--shadow-sm` | the `shadow` and `shadow-sm` utilities: the selected segment of a switcher, the thumb of a switch |
| `--glow` | extra `box-shadow` of the primary button (`none` by default) |

### Graph group colours (optional)

Graph groups take their colour from a 20-entry blue/violet palette (hues 200–310°). A theme bends it with:

| Variable | Meaning |
|---|---|
| `--g-hs` | hue shift in degrees, added to every group hue (e.g. `-100` turns them green, `-170` orange/olive) |
| `--g-sat` | saturation multiplier (`1` = unchanged, `0.5` = half as vivid) |
| `--g-ld` | lightness offset, e.g. `4%` |

## Creating a theme

1. **Add the block(s) to `src/themes.css`.** Copy an existing theme (*Nord* is a good starting point) and change `data-theme='nord'` to your id, in lowercase letters only (for example `ocean`). Provide the light block and the dark block, with all the colour variables. If the theme is dark only, provide just the dark block.

   ```css
   /* ---- Ocean ---- */
   :root[data-theme='ocean'] {
   	--bg: #eef6fb;
   	--panel: #ffffff;
   	--sidebar: #e2eff8;
   	--elev: #ffffff;
   	--border: #cfe2ef;
   	--fg: #0b2a3d;
   	--muted: #4a6b80;
   	--faint: #8fa9ba;
   	--hover: rgba(11, 42, 61, 0.06);
   	--active: rgba(0, 119, 182, 0.16);
   	--accent: #0077b6;
   	--accent-fg: #ffffff;
   	--p3: #d62828;
   	--p2: #e08a00;
   	--p1: #0077b6;
   	--p0: #8fa9ba;
   	--shadow: 0 10px 30px -8px rgba(11, 42, 61, 0.3);
   	--r-ctl: 10px;
   	--g-hs: -20;
   	color-scheme: light;
   }
   :root[data-theme='ocean'].dark {
   	/* same variables, dark values */
   	color-scheme: dark;
   }
   ```

2. **Register it** in `THEME_STYLES` in `src/lib/theme.svelte.ts`: `{ id: 'ocean', label: 'Ocean' }`. The label is shown in Settings; a proper name needs no translation, otherwise add it to `src/lib/en.json`. If the theme is dark only, add its id to `DARK_ONLY` in the same file and to the inline script in `src/app.html` (it currently tests `s === 'crt'`).

3. **Give it a character** (optional but recommended): a theme that only changes colours looks like a re-colour. Shapes (`--radius-*`, `--r-*`), shadows (`--shadow`, `--shadow-sm`, `--glow`) and a few extra rules at the bottom of `themes.css` are what make a theme recognisable, for example Gruvbox's hard shadow or Dracula's halo.

4. **Check it**: run `npm run tauri dev`, pick the theme in Settings and look at every view (List, Kanban, Calendar, Gantt, Graph), a dialog, a menu and the settings, in light and dark. Check the contrast of `--muted` and `--faint` text on `--bg` and `--panel`, and that `--accent-fg` is readable on `--accent`.

5. **Run the tests** (`npm test`): `tests/themes.test.ts` checks that every registered theme has its light and dark blocks, that all colour variables are defined, and that CRT uses the generic `monospace`.

## Customising an existing theme

Edit its block in `src/themes.css`: every value is a plain CSS variable, and the dev server reloads on save. The *Default* theme can be changed in `src/app.css` (`:root` and `.dark`).

## Extra rules and gotchas

- **Extra effects** go at the end of `themes.css`, scoped with `:root[data-theme='x']`, e.g. CRT's glow (`text-shadow` on `body`), scanlines (`body::after`) and square checkboxes (`.rounded-full { border-radius: 0 !important }`).
- **Bare `rounded`, `shadow`, `shadow-sm`, `shadow-lg`** have fixed values in Tailwind v4, so `themes.css` contains a small bridge that points them to the variables above for every theme except *Default*.
- **Use the variables in new components.** Prefer `bg-panel`, `text-muted`, `border-border`, `rounded-lg`, `shadow-pop`, or `var(--accent)` in a `<style>` block, instead of hard-coded colours or pixel radii, or the component will not follow the theme. For a custom corner radius, use one of the `--r-*` variables.
- **Scoped component styles** that need theme-dependent values should read the variables (as `GraphGroup.svelte` does with `--r-gr` and `--r-gs`).
- **Order and specificity**: theme blocks use `:root[data-theme='x']` (and `.dark`), which is more specific than the *Default* `:root` and `.dark`, so they win regardless of the order in the files.
