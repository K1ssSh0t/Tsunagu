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
