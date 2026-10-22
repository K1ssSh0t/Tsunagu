# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jugadores modders de juegos gacha (Genshin Impact, Wuthering Waves, Honkai: Star Rail, Zenless Zone Zero, Arknights: Endfield) que coleccionan skins creadas por terceros. Uso personal en desktop, en sesiones cortas antes de jugar: eligen personaje, activan/desactivan mods, agregan descargas nuevas. No son creadores de mods.

## Product Purpose

Tsunagu administra mods de 3DMigoto/XXMI por personaje y juego: qué skin lleva cada personaje al abrir el juego. Existe para que cambiar de look sea un gesto de segundos, no administración de carpetas. Éxito = el jugador entra, deja sus mods como quiere y lanza el juego sin fricción.

## Positioning

Manager multi-juego (5 juegos, cada uno con su lanzador GIMI/WWMI/SRMI/ZZMI/EFMI) con pipeline completo de actualización desde GameBanana: detecta updates, descarga, resuelve la carpeta raíz del ZIP y decide la higiene del archivo en `.cache`. Ningún manager genérico de archivos hace ese ciclo.

## Operating Context

Desktop junto al juego y GameBanana en el navegador. Los mods son carpetas con `.ini`/`.dds`; el ecosistema marca deshabilitados con prefijo `DISABLED_`. Flujos core: seleccionar personaje → ver sus mods con preview → toggle/activar-solo-uno → lanzar juego. Flujos secundarios: agregar (ZIP/carpeta), actualizar (GameBanana/archivo/carpeta), mover entre personajes, eliminar con confirmación.

## Capabilities and Constraints

Funcionalidad confirmada: sidebar de personajes con búsqueda y orden persistido; skins por personaje; cards de mod con preview, estado, badges de update y keySwaps; updates GameBanana con file-picker y progreso; ZipModal con selección de raíz; MoveModDialog; config por juego (ruta de mods + ejecutable); launch XXMI; UI en español; temas claro/oscuro/sistema.

Restricción de rediseño (decisión del dueño): se reemplaza el mundo visual desde cero, pero flujos, IA y topología del layout se conservan intactos. Stack existente (Wails + Go backend, React 19, shadcn new-york, Tailwind v4) no se cambia.

## Brand Commitments

Nombre Tsunagu. Compromiso explícito: no verse como una app genérica de plantilla shadcn. Marca definida: sello cuadrado tipo hanko con una T tallada y regla interior, en tinta plana; icono de app generado desde `build/appicon.svg` y reglas en `DESIGN.md`.

## Evidence on Hand

App funcional en `frontend/src/App.tsx`; componentes en `frontend/src/components/` (`Sidebar`, `ModList`, `ModCard`, `ConfigScreen`, `ZipModal`, `GameSelector`); tokens en `frontend/src/style.css`; critique previo 17/40 Poor cerrado (`.impeccable/critique/`). Sin screenshots de referencia ni material de marca real.

## Product Principles

1. El look se elige por preview: la imagen del mod manda sobre la metadata.
2. Un gesto, un resultado: activar un mod nunca bloquea el resto de la app.
3. El estado mostrado siempre es el real del backend, nunca optimismo sin rollback.
4. Cada juego conserva su identidad (nombre + lanzador) en todo el recorrido.
5. Cero jerga sin explicación: `.ini`, `DISABLED_`, GameBanana se traducen a lenguaje de jugador.

## Accessibility & Inclusion

Desktop con teclado y touch; todo en español; targets táctiles y foco visible; el color nunca es el único indicador de estado.
