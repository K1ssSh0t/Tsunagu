---
target: frontend/
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/kissshot/Proyectos/Personal/Tsunagu/frontend/src/App.tsx"
target_fingerprint: "sha256:c06fbb922b66dea1ae10287ad6da357c686e1cf09fa7abe16443a9e0112156c1"
target_path: /home/kissshot/Proyectos/Personal/Tsunagu/frontend/src/App.tsx
timestamp: 2026-09-30T21-18-24Z
slug: frontend-src-app-tsx
closed: true
---
# Critique — frontend/src/App.tsx

Method: dual-agent (A: ses_f0bd35d5dffeUHe6hIDwyWhawu · B: ses_f0bd35d5affeVP9kMMnBm40ZHF)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Overlay global bloqueante + mensajes genericos Procesando |
| 2 | Match System / Real World | 2 | Mezcla ES/EN: Default, Update, Keys, .ini/.dds sin explicar |
| 3 | User Control and Freedom | 2 | Sin undo, sin bulk, Activar Solo Este sin confirm |
| 4 | Consistency and Standards | 2 | Hover-only vs Switch siempre visible, modales custom vs AlertDialog |
| 5 | Error Prevention | 1 | Paths free-text, URL sin validar, zip-root ambiguo |
| 6 | Recognition Rather Than Recall | 1 | Acciones opacity-0 group-hover, target folder implicito |
| 7 | Flexibility and Efficiency | 2 | Sort+search persistidos bien, sin shortcuts ni bulk ni drag-drop |
| 8 | Aesthetic and Minimalist Design | 2 | Card-in-card, h-calc fragil, header denso |
| 9 | Error Recovery | 2 | Toasts genericos sin retry, delete irreversible, ZIP expone raw error |
| 10 | Help and Documentation | 1 | Cero onboarding, vacios pobres, zip sin ejemplo |
| **Total** | | **17/40** | **Poor** |

## Design Specificity Verdict

Shell shadcn generico con nametag de mod-manager. `App.tsx:1044` dice Mod Manager, solo el subtitulo menciona 3DMigoto. Sin avatar de personaje, sin arte de juego, thumbs 64px `ModCard.tsx:122` con fallback ImageOff. Tema oklch gris `style.css:44-77`, sin acento por juego (Genshin/Wuwa/HSR/ZZZ/Endfield). KeySwaps `ModCard.tsx:310-388` es el unico momento authored y esta enterrado. Cambia Personajes por Projects y Mods por Tasks y nada mas cambia.

**Deterministic scan:** `detect --json` sobre 6 ficheros → exit 0, `[]`, 0 findings. Detector limpio; todos los issues vienen de review LLM. Sin falsos positivos que adjudicar.

**Visual overlays:** sin overlay fiable. Server Vite ok (curl 200 en :1420) pero `browser.disconnected` — sin desktop browser conectado. No se reclama overlay.

## Overall Impression

Base solida (sidebar con sort, ModCard denso, pipeline de updates completo) pero lastrada por acciones ocultas, feedback mentiroso en toggle, config de doble comportamiento y puerta zip-root solo-expertos. Mayor oportunidad: hacer visibles las acciones + preview-first.

## What's Working

1. Sidebar search + sort persistido `Sidebar.tsx:34-68` + Badge conteo + ping updates — pensado para 100+ personajes.
2. ModCard una fila: cover+nombre+estado+badges+Switch `ModCard.tsx:117-307` + underglow verde activo + kbd KeySwaps — escaneable.
3. Pipeline update GameBanana → file picker → progress → zip-root → cleanup `.cache` `App.tsx:590-690` — ciclo real completo.

## Priority Issues

### [P0] Acciones primarias invisibles hasta hover; teclado/touch muertos
**What:** Globe + menu `opacity-0 group-hover:opacity-100` `ModCard.tsx:216,229`, solo `title=`, sin aria-label.
**Why:** En touch/teclado nunca aparecen; Sam no puede tabular, Alex no puede ir rapido.
**Fix:** opacity-100 en focus-within + `(hover:none)`, aria-labels, sacar Activar Solo Este a icon-button visible.
**Suggested command:** /impeccable audit

### [P1] Feedback invertido + bloqueo fullscreen destruye confianza
**What:** `handleToggleMod` `App.tsx:282-287` lee `characterMods` stale → toast dice lo contrario. Overlay global `App.tsx:926` congela app por un switch.
**Why:** Usuario aprende a desconfiar del estado.
**Fix:** Usar retorno de ToggleMod, optimistic Switch con rollback, pending por-card en vez de overlay.
**Suggested command:** /impeccable harden

### [P1] Doble GameSelector, dos comportamientos; config sin validar
**What:** Header `App.tsx:171-208` hace SetGame + wipe; config `App.tsx:967-978` solo muta local hasta Save. Save habilitado con `!configPath` `ConfigScreen.tsx:167`, paths free-text.
**Why:** Jordan configura juego equivocado, typos se guardan a ciegas.
**Fix:** GameSwitcher vs GameConfigTabs con dot configurado, validar modsPath existe + contiene carpetas, error inline.
**Suggested command:** /impeccable harden

### [P1] Zip-root es puerta solo-expertos
**What:** Instruccion `.ini/.dds` `ZipModal.tsx:162-166`, auto-expand todo `ZipModal.tsx:42-56`, footer Ninguno (Raiz del ZIP) vs guard que exige carpeta `App.tsx:421-424`.
**Why:** Punto de abandono de Jordan, friccion bulk de Alex.
**Fix:** Resaltar candidatos con .ini, colapsar resto, boton Seleccionar detectado, Confirm disabled hasta dir valida.
**Suggested command:** /impeccable onboard

### [P2] Luce admin generico; preview degradado
**What:** Header Mod Manager `App.tsx:1044`, thumbs 64px, monocromo.
**Why:** Mod se elige por look; thumbs mini empujan a filesystem.
**Fix:** Header Tsunagu · {juego}, cover h-20 w-20 con zoom, acento por juego, conteo activos + splash en ModList header.
**Suggested command:** /impeccable bolder

## Persona Red Flags

**Alex (Power User):** hover-hunt por card, sin shortcuts, overlay bloquea triage bulk, ping Sidebar no navegable a mod, AddModDialog 3 clicks sin drag-drop. Termina renombrando DISABLED_ en filesystem.

**Sam (A11y):** botones opacity-0 sin aria-label, cover button sin label, Switch sin nombre accesible `ModCard.tsx:299-304`, arbol zip con div[role=button]+button anidado, verde-como-unico-cue `ModCard.tsx:150-155`.

**Jordan (First-Timer):** ConfigScreen jerga Ruta/Lanzador GIMI + placeholders solo-Windows, cree que cambio juego desde config, empty No hay personajes sin diagnostico, auto-nombrar disabled parece roto, ZIP pide .ini/.dds → cancela.

## Minor Observations

- Default sin localizar `ModList.tsx:81`; Update/Key/var en ingles `ModCard.tsx:175,197,380`.
- Alturas fijas calc(100vh-200px) `Sidebar.tsx:71`, `ModList.tsx:55` → flex-1 min-h-0.
- ZipFileTree key Date.now() `ZipModal.tsx:81` remountea y mata foco.
- deriveNameFromPath solo ultimo segmento `App.tsx:131-134`; auto-rename clobbera nombre custom `App.tsx:393-402`.
- Match update toLowerCase en character pero exacto en mod `ModList.tsx:128-139`.
- Labels launch duplicados `App.tsx:1060-1071` vs `ConfigScreen.tsx:59-70`.
- Cleanup/Progress fileName stale tras close.

## Questions to Consider

- Si el mod se elige por look, por que la imagen grande vive en dialog oculto?
- Si DISABLED_ y el Switch discrepan, a cual cree el usuario y por que el toast consulta estado stale?
- ConfigScreen es wizard (por que permite cerrar con 0 personajes?) o settings (por que takeover sin mapa por juego)?
