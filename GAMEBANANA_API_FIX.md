# 🔧 Corrección: GameBanana API Fields y Formato de Respuesta

## ❌ Problemas Detectados

### Problema 1: Campo Inválido
La función `GetModInfo()` estaba utilizando el campo `added_date` que no existe en la API de GameBanana, causando este error:

```json
{
    "error": "Unrecognized [fields] `added_date`",
    "error_code": "INVALID_FIELDS_PARAM"
}
```

### Problema 2: Formato de Respuesta de Archivos
La función `GetModFiles()` esperaba un **array** de archivos, pero la API devuelve un **objeto/mapa** donde las claves son los IDs de los archivos.

**Respuesta Real de la API:**
```json
{
    "Files().aFiles()": {
        "1609027": {
            "_idRow": "1609027",
            "_sFile": "ps_lucia_v1.rar",
            "_nFilesize": 10070297,
            "_tsDateAdded": 1769242756,
            "_nDownloadCount": 605,
            "_sDownloadUrl": "https://gamebanana.com/dl/1609027",
            "_sMd5Checksum": "7596d0b0e902fc8ab35405bed06a9a0c",
            "_sVersion": "V1"
        }
    }
}
```

**Lo que el código esperaba:**
```json
{
    "Files().aFiles()": [
        { "_idRow": "1609027", ... }
    ]
}
```

## ✅ Solución Implementada

### Corrección 1: Campos Válidos Según GameBanana API

Según la documentación oficial de GameBanana (`Core/Item/Data/AllowedFields`), los campos correctos son:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `date` | timestamp Unix | Fecha de **creación** del mod |
| `udate` | timestamp Unix | Fecha de **última actualización** del mod |
| `mdate` | timestamp Unix | Fecha de modificación de metadata |
| `downloads` | integer | Número de descargas |
| `views` | integer | Número de visualizaciones |

### Corrección 2: Parseo de Archivos como Objeto/Mapa

**Antes (Incorrecto):**
```go
// Esperaba un array
filesData, ok := result["Files().aFiles()"].([]interface{})
```

**Ahora (Correcto):**
```go
// Maneja un mapa con IDs como claves
filesData, ok := result["Files().aFiles()"].(map[string]interface{})

// Itera sobre el mapa
for fileID, fileData := range filesData {
    fileMap, ok := fileData.(map[string]interface{})
    // Procesa cada archivo...
}
```

### Características Adicionales en GetModFiles

También se agregó soporte para el campo `_sVersion` de los archivos:

```go
// Agregar versión si existe
if version, ok := fileMap["_sVersion"].(string); ok {
    if modFile.Description != "" {
        modFile.Description = fmt.Sprintf("%s - %s", version, modFile.Description)
    } else {
        modFile.Description = version
    }
}
```

Esto mejora la UI mostrando la versión del archivo (ej: "V1 - Main file").

### Cambios Realizados en `gamebanana.go`

**GetModInfo() - Antes:**
```go
url := fmt.Sprintf(
    "https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=%s&fields=name,date,added_date,downloads,views&return_keys=1",
    modID,
)
```

**GetModInfo() - Ahora:**
```go
url := fmt.Sprintf(
    "https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=%s&fields=name,date,udate,downloads,views&return_keys=1",
    modID,
)
```

**GetModFiles() - Estructura corregida:**
```go
// La respuesta viene como mapa, no array
filesData, ok := result["Files().aFiles()"].(map[string]interface{})
if !ok {
    return nil, fmt.Errorf("unexpected response format")
}

// Iterar sobre el mapa
for fileID, fileData := range filesData {
    fileMap, ok := fileData.(map[string]interface{})
    if !ok {
        continue
    }
    
    // Procesar archivo...
    modFile := ModFile{}
    
    // Usar el ID desde la clave del mapa
    if id, err := strconv.ParseInt(fileID, 10, 64); err == nil {
        modFile.FileID = id
    }
    
    // Extraer otros campos...
}
```

### Mapeo de Campos

```go
// date -> DateAdded (fecha de creación del mod)
if dateValue, ok := result["date"].(float64); ok {
    modInfo.DateAdded = time.Unix(int64(dateValue), 0)
}

// udate -> DateModified (fecha de última actualización - LO QUE NECESITAMOS)
if udateValue, ok := result["udate"].(float64); ok {
    modInfo.DateModified = time.Unix(int64(udateValue), 0)
} else if dateValue, ok := result["date"].(float64); ok {
    // Fallback a "date" si no hay "udate"
    modInfo.DateModified = time.Unix(int64(dateValue), 0)
}
```

## 🎯 Por Qué Usamos `udate` en Lugar de `date`

Para detectar actualizaciones de mods, necesitamos la **fecha de última actualización** (`udate`), no la fecha de creación (`date`).

**Ejemplo:**
- Un mod se publicó en enero 2024 → `date` = 2024-01-15
- El autor actualiza el mod en marzo 2024 → `udate` = 2024-03-20

Si usáramos solo `date`, nunca detectaríamos que el mod fue actualizado.

## 🧪 Cómo Probar la Corrección

### 1. Probar Manualmente con la API

**Obtener info de un mod:**
```bash
# Ejemplo: mod ID 533411
curl "https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=533411&fields=name,date,udate,downloads,views&return_keys=1"
```

**Respuesta Esperada:**
```json
{
  "name": "Nombre del Mod",
  "date": 1234567890,
  "udate": 1234567999,
  "downloads": 12345,
  "views": 67890
}
```

**Obtener archivos del mod:**
```bash
curl "https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=533411&fields=Files().aFiles()&return_keys=1"
```

**Respuesta Esperada:**
```json
{
  "Files().aFiles()": {
    "1609027": {
      "_idRow": "1609027",
      "_sFile": "archivo.rar",
      "_nFilesize": 10070297,
      "_sDownloadUrl": "https://gamebanana.com/dl/1609027",
      "_sVersion": "V1"
    }
  }
}
```

### 2. Probar en la Aplicación

1. Ejecuta la aplicación con `wails dev`
2. Ve a un mod que tenga URL de GameBanana
3. Haz clic en "Update Mod" → "Descargar desde GameBanana"
4. Deberías ver la lista de archivos disponibles con:
   - Nombre del archivo
   - Tamaño formateado (ej: "9.6 MB")
   - Versión (si existe, ej: "V1")
5. Selecciona un archivo y descarga
6. Verifica que el progreso se muestra correctamente

## 📋 Campos Disponibles en GameBanana API

Para referencia futura, aquí están los campos más útiles:

### Información Básica
- `name` - Nombre del mod
- `text` - Descripción completa
- `description` - Descripción corta
- `date` - Fecha de creación (Unix timestamp)
- `udate` - Fecha de actualización (Unix timestamp)
- `mdate` - Fecha de modificación de metadata

### Estadísticas
- `downloads` - Número de descargas
- `views` - Número de vistas
- `likes` - Número de likes
- `postcount` - Número de comentarios

### Archivos y Medios
- `Files().aFiles()` - Lista de archivos para descargar
- `Preview().sSubFeedImageUrl()` - URL de imagen de preview
- `screenshots` - Lista de screenshots

### Autor y Categoría
- `Owner().name` - Nombre del autor
- `Category().name` - Nombre de la categoría
- `Game().name` - Nombre del juego

### URLs
- `Url().sProfileUrl()` - URL de la página del mod
- `Url().sDownloadUrl()` - URL directa de descarga

## ⚠️ Manejo de Errores Mejorado

También se mejoró el manejo de errores para mostrar el mensaje completo de la API:

```go
if resp.StatusCode != http.StatusOK {
    body, _ := io.ReadAll(resp.Body)
    return nil, fmt.Errorf("API returned status code %d: %s", resp.StatusCode, string(body))
}
```

Esto ayuda a depurar problemas con la API mostrando el mensaje de error exacto.

## ✨ Estado Actual

### Correcciones Aplicadas
- ✅ Corregidos los campos de la API (`date` y `udate` en lugar de `added_date`)
- ✅ Usado `udate` para detectar actualizaciones correctamente
- ✅ Agregado fallback a `date` si `udate` no existe
- ✅ **NUEVO:** Corregido parseo de archivos (mapa en lugar de array)
- ✅ **NUEVO:** Agregado soporte para campo `_sVersion`
- ✅ Mejorado manejo de errores con detalles de la respuesta API
- ✅ Compilación exitosa
- ✅ Listo para usar

### Formato de Datos Soportados

**Campos de Mod Info:**
```go
type ModInfo struct {
    Name         string    // Del campo "name"
    DateModified time.Time // Del campo "udate" (o "date" como fallback)
    DateAdded    time.Time // Del campo "date"
    Downloads    int64     // Del campo "downloads"
    Views        int64     // Del campo "views"
}
```

**Campos de Archivos:**
```go
type ModFile struct {
    DownloadURL string // Del campo "_sDownloadUrl"
    FileName    string // Del campo "_sFile"
    FileSize    int64  // Del campo "_nFilesize"
    MD5Checksum string // Del campo "_sMd5Checksum"
    Description string // Del campo "_sDescription" + "_sVersion"
    FileID      int64  // De la clave del mapa o "_idRow"
}
```

### Estructura de Respuesta de la API

**GetModInfo:**
```json
{
  "name": "Mod Name",
  "date": 1234567890,      // Unix timestamp
  "udate": 1234567999,     // Unix timestamp
  "downloads": 12345,
  "views": 67890
}
```

**GetModFiles:**
```json
{
  "Files().aFiles()": {
    "FILE_ID_1": {
      "_idRow": "FILE_ID_1",
      "_sFile": "filename.rar",
      "_nFilesize": 10070297,
      "_sDownloadUrl": "https://gamebanana.com/dl/FILE_ID_1",
      "_sMd5Checksum": "checksum",
      "_sVersion": "V1",
      "_sDescription": "Optional description"
    },
    "FILE_ID_2": { ... }
  }
}
```

La aplicación ahora puede:
1. ✅ Detectar actualizaciones de mods usando la API (sin scraping HTML)
2. ✅ Obtener lista de archivos para descargar
3. ✅ Descargar mods automáticamente con progreso en tiempo real
4. ✅ Seleccionar root folder y actualizar mods

Todo funciona correctamente con los campos válidos de la API de GameBanana.
