# Tsunagu

Gestor de mods de personajes para Genshin Impact, Wuthering Waves, Honkai:
Star Rail, Zenless Zone Zero y Arknights: Endfield. Wails 2 (Go + React 19),
interfaz en español, tema claro/oscuro.

## Desarrollo

```bash
make install   # dependencias del frontend (bun)
make dev       # wails dev
```

Builds: `make build-linux`, `make build-windows`, `make build-all`.
El binario y `characters.json` quedan en `build/bin/`.

## Versión y auto-actualización

- La versión vive en `VERSION`; el `Makefile` la inyecta en el binario con
  `-ldflags`, junto con `BuildTag` (tag del release) y `BuildTime`. Sin esos
  valores la app se considera una build de desarrollo (`dev`).
- Al iniciar (si está activado) y desde **Configuración → Buscar
  actualizaciones**, la app consulta los releases de `K1ssSh0t/Tsunagu`.
  Para probar con otro repositorio: `TSUN_UPDATE_REPO=owner/repo`.
- Si hay una versión nueva muestra el diálogo, descarga el zip de la
  plataforma y verifica el SHA-256 contra el `digest` de GitHub.
  - **Windows**: un helper de PowerShell espera a que la app se cierre,
    reemplaza `Tsunagu.exe` (deja `.old` por si acaso) y la vuelve a abrir.
  - **Linux**: reemplaza el binario en sitio, comprueba que la versión nueva
    arranque y, si falla, restaura la anterior antes de relanzar.
- Nunca toca `config.json`, `.logs/` ni los mods; del `.cache/` solo usa
  (y limpia) su propia carpeta `.cache/update`.
- El chequeo al inicio se puede desactivar en Configuración.

Los binarios Linux se compilan contra `webkit2gtk-4.1` (Ubuntu 24.04+,
Fedora, Arch y derivados). En distros que solo ofrezcan `webkit2gtk-4.0`
el binario no arrancará.

## Releases

Cada push a `main` (o una ejecución manual del workflow) compila Windows y
Linux, empaqueta `<binario> + characters.json` y publica un release con tag
`build-<fecha>-<run>-<sha>` y notas generadas por GitHub. Los assets son
`Tsunagu-windows-amd64.zip`, `Tsunagu-linux-amd64.zip` y `checksums.sha256`.

El auto-update desde la app requiere que el repositorio sea público (la API
de releases responde 404 a peticiones sin credenciales en repos privados).

## Publicar una versión

1. Actualiza `VERSION` (por ejemplo, `1.9.1`) y sincroniza la metadata de
   Windows: `make sync-version`. El workflow también lo hace por su cuenta.
2. Haz commit de `VERSION` (y de `wails.json` si cambió) y súbelo a `main`.
   También puedes lanzar el workflow **Release** a mano desde Actions.
3. Espera a que termine y comprueba en **Releases** que el tag `build-...`
   tenga los dos zips y `checksums.sha256`.
4. En una instalación 1.9.0 o superior, la app lo detecta al arrancar (unos
   2,5 s después) o desde **Configuración → Buscar actualizaciones**.

Notas:

- **Sube `VERSION` en cada release.** El workflow se ejecuta en cada push a
  `main` aunque no cambies la versión; la app se actualizaría igual y
  seguiría mostrando el número anterior.
- La detección no compara semver: considera más nuevo cualquier release
  creado después de la build y con tag distinto. Por eso **no reemplaces
  assets en un release ya publicado** (su `created_at` no cambia): publica
  uno nuevo.
- Solo se publican y aceptan builds **amd64** de Windows y Linux. En ARM o
  macOS no hay actualización automática.
- Las instalaciones anteriores a 1.9.0 (releases `manual-*`) **no tienen
  auto-update**: hay que instalar 1.9.0 o superior una vez a mano. A partir
  de ahí las siguientes versiones se reciben solas.
