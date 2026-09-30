---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src/components/Sidebar.tsx","frontend/src/components/ModList.tsx","frontend/src/components/ModCard.tsx","frontend/src/components/ConfigScreen.tsx","frontend/src/components/ZipModal.tsx","frontend/src/components/game-selector.tsx","frontend/src/style.css"]
---

# Surface brief — Tsunagu main surface (redesign)

Scope: visual-world replacement of the main app surface (`frontend/src/App.tsx` + Sidebar, ModList, ModCard, ConfigScreen, ZipModal, GameSelector, ui primitives, style.css). Layout topology, IA, flows and behavior preserved intact; only the look is replaced.

Mode: Operate.

Audience/job: player-modders with personal skin collections; job = set each character's look in seconds and launch the game. Proof = mod previews and truthful state, not copy.

Constraints: Wails desktop webview, offline (system font stacks only, no webfonts); ES copy; light/dark/system themes kept; a11y fixes from prior polish preserved (labels, focus, touch targets); no behavior change.

## Direction contract

THESIS: Tsunagu is a printed collection catalog, not a dashboard. It refuses the shadcn card-grid default: flat ink-on-paper plates, hairline rules, registration-like numbering, one grotesque voice plus a mono spec row. Every mod is a numbered plate; every character an index entry.

OWN-WORLD: warm paper light (#F4F1EC) / warm ink dark (#161310); ink text never pure black/white; sharp corners (radius ~2px) and 1px hairline borders, no shadows except floating modals; per-game seal accent (genshin amber, wuwa tide blue, hsr violet, zzz ember, endfield teal) used sparingly on edition marks and selection; display = system grotesque 800, tight tracking; spec = 11px mono uppercase for counts, versions, states.

STORY: the visitor understands this is their collection, believes the state shown (instrument-grade readouts, tabular figures), and does the core gesture (toggle one mod) as a tangible mechanical event.

FIRST VIEWPORT: catalog cover header (mono kicker EDICIÓN {juego}, monumental TSUNAGU, tabular collection stats) over the preserved header/sidebar/content topology; sidebar as numbered index (01 · name · count); mod rows as plates with dominant preview, plate number, mono spec line (state · update · keys), rectangular state switch.

FORM: assigned direction, seed key 26d3a2f2, from the direction roll against the audience's print/catalog world.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
