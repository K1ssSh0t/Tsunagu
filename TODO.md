# TODO

- ~~Agregar el funcionamietno correcto de la seleccion de la carpeta raiz del zip~~
- ~~Hay un error si hay carpeta vacia no se carga la interfaz~~
- ~~Agregar funcionalidad para extraer RAR Y 7Z~~
- ~~Quitar hasmodfiles de app.go~~
- ~~Agregar que se le agregue el link de game banana como fuente a los mods~~
- ~~Corregir eeror que al abrir un personje que no tiene mods ni carpeta muestra un mensaje de error~~
- ~~Hacer que se chechen las actuliaciones en gamebanana~~
- ~~Al inciiar aparace dos veces la notifaicionde hay una actuliazacion apesar de que solo hay un mod por actualizar~~
- ~~Agregar que se actulice el mod pedira seleccionar la carpte o acrhivo compirmido para actulizar dicho mod~~
- ~~Agregar que se puedan adminstrar varios juegos no solo el genshin~~
- ~~Chear un edge case si un arhcivo comprimi tiene sus arhcivos directos en la carpeta raiz y no en una carpeta hija~~
- ~~Cambiar el nombre de la APP por uno mejor y luego se cambiara el nombre del modulo~~
- ~~Agregar sooprte para carpetas de skins de personajes~~
- ~~en el menu de personajes no muestra correctamenta la cantidad de mods que tiene si hay mods de skin~~
- ~~agregar que se pueda modever los mods~~
- ~~checar que cargue bien la iamgen cuando es mod nsfw~~
- mejorar el como se sacan las skins de los personajes
- ~~cambiar que las characters se tomen estaticamente de characters.json ya se quito de gitignore~~
- checar la forma de evitar que windows bloque el accesso a la caprta de un mod pra hacerle toggle o actulizarlo, dicce archivo bloquedo sin permiso o esta siendo ocupado por otro proceso
- agregar filtro por cantidada de mods

El programa JASM utiliza tres estrategias principales para evitar que Windows bloquee el acceso a archivos durante actualizaciones y cambio de modos:

## 1. Bloqueo Exclusivo Durante la Instalación de Mods

Durante la instalación de mods, el programa bloquea todos los archivos de la carpeta del mod usando `FileStream` con acceso de lectura/escritura y compartición de solo lectura. Esto previene que otros procesos modifiquen los archivos mientras se está instalando el mod. [1](#0-0) 

Los archivos bloqueados se liberan cuando se completa la instalación: [2](#0-1) 

## 2. Operaciones Thread-Safe

El servicio de archivos usa un objeto de bloqueo (`_fileLock`) para sincronizar todas las operaciones de lectura y escritura, evitando condiciones de carrera dentro de la aplicación misma: [3](#0-2) [4](#0-3) 

## 3. Desactivación Temporal del FileSystemWatcher

Cuando se hace toggle a los modos (habilitar/deshabilitar), el programa desactiva temporalmente el `FileSystemWatcher` para prevenir que detecte sus propios cambios de archivos: [5](#0-4) [6](#0-5) 

La clase `DisableWatcher` implementa este patrón de desactivación temporal: [7](#0-6) 

## Notas

Estas estrategias en conjunto aseguran que:
- No haya conflictos de acceso a archivos entre diferentes partes de la aplicación
- Windows no bloquee archivos que el programa necesita modificar
- No se generen eventos de FileSystemWatcher para operaciones que el programa mismo está realizando
- Se previenen condiciones de carrera durante operaciones de renombrado, habilitación/deshabilitación de mods

### Citations

**File:** src/GIMI-ModManager.WinUI/Services/ModHandling/ModInstallerService.cs (L159-166)
```csharp
    private void LockFiles()
    {
        foreach (var fileInfo in _originalModFolder.GetFiles("*", SearchOption.AllDirectories))
        {
            var fileStream = fileInfo.Open(FileMode.Open, FileAccess.ReadWrite, FileShare.Read);
            _lockedFiles.Add(fileStream);
        }
    }
```

**File:** src/GIMI-ModManager.WinUI/Services/ModHandling/ModInstallerService.cs (L393-402)
```csharp
    private void ReleaseLockedFiles()
    {
        foreach (var fileStream in _lockedFiles.ToArray())
        {
            fileStream.Dispose();
            _lockedFiles.Remove(fileStream);
        }

        Log.Debug("Released locked files, {time}", DateTime.Now);
    }
```

**File:** src/GIMI-ModManager.Core/Services/FileService.cs (L9-9)
```csharp
    private readonly object _fileLock = new();
```

**File:** src/GIMI-ModManager.Core/Services/FileService.cs (L35-38)
```csharp
        lock (_fileLock)
        {
            File.WriteAllText(Path.Combine(folderPath, fileName), fileContent, Encoding.UTF8);
        }
```

**File:** src/GIMI-ModManager.Core/Entities/CharacterModList.cs (L276-303)
```csharp
    public void EnableMod(Guid modId)
    {
        try
        {
            _watcher.EnableRaisingEvents = false;

            var mod = _mods.First(m => m.Id == modId).Mod;

            if (!ModAlreadyAdded(mod))
                throw new InvalidOperationException("Mod not added");

            if (!ModFolderHelpers.FolderHasDisabledPrefix(mod.Name))
                throw new InvalidOperationException("Cannot enable a enabled mod");

            var newName = ModFolderHelpers.GetFolderNameWithoutDisabledPrefix(mod.Name);

            if (Directory.Exists(Path.Combine(AbsModsFolderPath, newName)))
                throw new InvalidOperationException("Cannot disable a mod with the same name as a disabled mod");

            mod.Rename(newName);


            _mods.First(m => m.Mod.Equals(mod)).IsEnabled = true;
        }
        finally
        {
            _watcher.EnableRaisingEvents = true;
        }
```

**File:** src/GIMI-ModManager.Core/Entities/CharacterModList.cs (L306-331)
```csharp
    public void DisableMod(Guid modId)
    {
        try
        {
            _watcher.EnableRaisingEvents = false;
            var mod = _mods.First(m => m.Id == modId).Mod;

            if (!ModAlreadyAdded(mod))
                throw new InvalidOperationException("Mod not added");

            if (ModFolderHelpers.FolderHasDisabledPrefix(mod.Name))
                throw new InvalidOperationException("Cannot disable a disabled mod");

            var newName = ModFolderHelpers.GetFolderNameWithDisabledPrefix(mod.Name);

            if (Directory.Exists(Path.Combine(AbsModsFolderPath, newName)))
                throw new InvalidOperationException("Cannot disable a mod with the same name as a disabled mod");

            mod.Rename(newName);
            _mods.First(m => m.Mod.Equals(mod)).IsEnabled = false;
        }
        finally
        {
            _watcher.EnableRaisingEvents = true;
        }
    }
```

**File:** src/GIMI-ModManager.Core/Entities/CharacterModList.cs (L480-495)
```csharp
public class DisableWatcher : IDisposable
{
    private readonly FileSystemWatcher _watcher;

    public DisableWatcher(FileSystemWatcher watcher)
    {
        ArgumentNullException.ThrowIfNull(watcher);
        _watcher = watcher;
        _watcher.EnableRaisingEvents = false;
    }

    public void Dispose()
    {
        _watcher.EnableRaisingEvents = true;
    }
}
```
https://deepwiki.com/search/como-es-que-el-progrma-evita-q_c3a405c6-653b-47f3-b6e4-44923694feb1?mode=deep
