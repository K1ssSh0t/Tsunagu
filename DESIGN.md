# Design

Tsunagu main surface — collection-catalog world (replaces the stock shadcn look; layout, IA and flows unchanged).

## World

Ink on warm paper. Every mod is a numbered plate, every character an index entry, every game an edition with its own seal. Flat surfaces, hairline rules, registration-like numbering. Dark base by scene (room dark in front of the monitor before playing); light paper `#F4F1EC` equivalent kept for bright rooms.

## Palette

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.946 0.009 85)` warm paper | `oklch(0.21 0.012 60)` warm ink |
| `--foreground` | `oklch(0.22 0.012 60)` ink, never pure black | `oklch(0.92 0.008 85)` paper, never pure white |
| `--card` | `oklch(0.928 0.011 80)` | `oklch(0.25 0.013 60)` |
| `--primary` | warm ink `oklch(0.25 0.012 60)` | warm paper `oklch(0.9 0.01 85)` |
| `--border` / `--input` | `oklch(0.82 0.014 78)` hairline | white 13–16% |
| `--muted-foreground` | `oklch(0.45 0.015 70)` | `oklch(0.68 0.014 75)` |

Game seals (`--game-accent` under `[data-game]` on the app root): genshin amber `0.75/0.15/95`, wuwa tide `0.7/0.16/250`, hsr violet `0.68/0.18/300`, zzz ember `0.68/0.18/30`, endfield teal `0.72/0.14/170`. Seals mark edition (header dot) and selection (sidebar mark) only — never body text, never status (green keeps state meaning).

## Typography

System stacks only (offline Wails app, no webfonts): `--font-sans` system-ui stack, `--font-mono` ui-monospace stack. Two voices: `.display-ink` (800, -0.03em, balanced) for Tsunagu, character name, dialog titles; `.spec-label` (11px mono, uppercase, 0.12em, tabular) for kickers, stats, states. Body 14–16px sans. Counts always `tabular-nums`.

## Marca

El símbolo son dos cabos que llegan desde esquinas opuestas y se encuentran en un sello cuadrado: el juego y el mod reunidos en el catálogo. Tinta plana, sin degradados.

- **En la UI**: `<TsunaguMark />` (`frontend/src/components/TsunaguMark.tsx`), dibujado con `currentColor`. 40–48 px en el header, 36 px en Configuración. Monocromo, hereda tinta/papel del tema.
- **Icono de app**: `build/appicon.svg` es el master (papel `#F4F1EC`, tinta `#26221D`, radio 176/1024). `build/appicon.png` (1024) y `build/windows/icon.ico` (16–256) se generan desde ahí; Wails deriva el `.icns` al compilar en macOS. Mantener la geometría sincronizada con el componente.
- **Reglas**: no recolorear por juego, no rotar, no añadir sombra ni usarlo sobre fotos; mínimo 16 px (el sello central sigue legible). El wordmark es `Tsunagu` en `.display-ink`, sin tracking añadido.

## Shape and depth

`--radius: 0.25rem` → sm 0, md 2px, lg 4px. Plates, switches, badges, bars are 0–3px sharp; pills survive only where the control is inherently round (radio). 1px hairline borders; zero shadows on surfaces and controls; `shadow-lg` reserved for floating menus and modals. No glass, no gradients, no glow halos.

## Components

- **Shell**: viewport-filling (`h-dvh`, no page scroll — only inner lists scroll), fluid to `1760px`, header fixed + flexible grid; mod grid goes 3-up at `2xl` so wide monitors earn their space.
- **Cover header**: transparent card; mono kicker `EDICIÓN · {juego} — CATÁLOGO Nº nn` with seal; monumental `Tsunagu`; mono stats `nn personajes · nn mods · nn activos`.
- **Index (sidebar)**: spec kicker with entry count; rows `nn · name · count`, selected row carries the game-seal mark; static update dot + sr text (no ping).
- **Plates (ModCard)**: flat hairline row, `Nº nn`, bold name, mono state line, seal-style badges (`Actualizar`, `n Teclas`), dominant framed preview, visible Zap action, rectangular switch with per-card pending spinner.
- **Switches**: rectangular track/thumb; checked = ink/paper inversion.
- **Badges**: 2px rect, mono 10px uppercase; green = update available, blue = key info; always paired with text, never color-alone.
- **Dialogs/menus**: sharp, hairline, flat; image-expand is a paper plate with top caption, no glass.
- **Pending**: per-card `Actualizando…` + spinner; global overlay only for genuinely global ops (game switch, add/remove/move).

## Motion

One authored moment: the toggle as a tangible mechanical event (optimistic flip, rollback on error). Overlays fade; no entrances, no ping loops (`prefers-reduced-motion` respected by omission — nothing ambient animates).

## Rules for future work

Tokens live in `style.css`, variants in `ui/*.tsx`, features use semantic classes only — no hex/oklch/`gray-*` outside `style.css`. ES copy everywhere including dates (`es` locale) and sr-only text. Icon-only controls carry `aria-label`. Touch targets ≥44px. Errors name problem + recovery inline. New surfaces inherit this world; deviations need user approval.
