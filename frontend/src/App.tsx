import React, { useState, useEffect, useCallback } from "react";
import {
  GetCharacters,
  GetModsForCharacter,
  ToggleMod,
  ActivateSingleMod,
  AddMod,
  AddModFromZipWithRoot,
  CleanupTempDirectory,
  GetZipStructure,
  RemoveMod,
  OpenModFolder,
  IsConfigured,
  SaveConfig,
  SelectDirectory,
  SelectFile,
  CheckForUpdates,
  OpenUrl,
  UpdateMod,
  UpdateModFromZipWithRoot,
} from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { ModeToggle } from "./components/mode-toggle";
import { Trash2, Folder, File, ChevronRight, ChevronDown, Loader2, RefreshCw, Download } from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Character = main.Character;
type Mod = main.Mod;
type ZipFile = main.ZipFile;

const App: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [characterMods, setCharacterMods] = useState<Mod[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isAppConfigured, setIsAppConfigured] = useState<boolean | null>(null);
  const [showAddMod, setShowAddMod] = useState(false);
  const [newModPath, setNewModPath] = useState("");
  const [newModName, setNewModName] = useState("");
  const [gameBananaUrl, setGameBananaUrl] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipStructure, setZipStructure] = useState<ZipFile[]>([]);
  const [selectedRoot, setSelectedRoot] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [modToDelete, setModToDelete] = useState<{
    character: string;
    modName: string;
  } | null>(null);
  const [updates, setUpdates] = useState<main.ModUpdate[]>([]);
  const [modToUpdate, setModToUpdate] = useState<{
    character: string;
    modName: string;
    currentUrl?: string;
  } | null>(null);

  const hasCheckedConfig = React.useRef(false);

  useEffect(() => {
    if (hasCheckedConfig.current) return;
    hasCheckedConfig.current = true;
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const configured = await IsConfigured();
      setIsAppConfigured(configured);
      if (configured) {
        loadCharacters();
        checkForUpdates();
      }
    } catch (error) {
      console.error("Error checking configuration:", error);
    }
  };

  const checkForUpdates = async () => {
    try {
      const availableUpdates = await CheckForUpdates();
      if (availableUpdates && availableUpdates.length > 0) {
        setUpdates(availableUpdates);
        toast.info(
          `Se encontraron ${availableUpdates.length} actualizaciones disponibles`,
          {
            action: {
              label: "Ver",
              onClick: () => {
                // Could scroll to first updated mod or show a list
                console.log("Updates:", availableUpdates);
              },
            },
          },
        );
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    }
  };

  const loadCharacters = async () => {
    try {
      const chars = await GetCharacters();
      setCharacters(chars);
    } catch (error) {
      console.error("Error loading characters:", error);
      toast.error("Error al cargar los personajes");
    }
  };

  const loadCharacterMods = async (characterName: string) => {
    try {
      const mods = await GetModsForCharacter(characterName);
      setCharacterMods(mods);
    } catch (error) {
      console.error("Error loading character mods:", error);
      // toast.error("Error al cargar los mods del personaje");
      setCharacterMods([]);
    }
  };

  const handleCharacterSelect = async (characterName: string) => {
    setSelectedCharacter(characterName);
    await loadCharacterMods(characterName);
  };

  const handleToggleMod = async (character: string, modName: string) => {
    setIsLoading(true);
    setLoadingMessage("Actualizando estado del mod...");
    try {
      await ToggleMod(character, modName);
      await loadCharacterMods(character);
      await loadCharacters();
      // Get the current state of the mod to show the correct message
      const mod = characterMods.find((m) => m.name === modName);
      if (mod) {
        toast.success(
          `Mod ${modName} ${mod.isActive ? "activado" : "desactivado"} correctamente`,
        );
      }
    } catch (error) {
      console.error("Error toggling mod:", error);
      toast.error("Error al cambiar el estado del mod");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleActivateSingle = async (character: string, modName: string) => {
    setIsLoading(true);
    setLoadingMessage("Activando mod único...");
    try {
      await ActivateSingleMod(character, modName);
      await loadCharacterMods(character);
      await loadCharacters();
      toast.success(`Mod ${modName} activado como único`);
    } catch (error) {
      console.error("Error activating mod:", error);
      toast.error("Error al activar el mod");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleAddMod = async () => {
    if (!selectedCharacter || !newModName || !newModPath) return;

    setIsLoading(true);
    setLoadingMessage("Procesando...");

    try {
      // Check if the path is a ZIP file
      if (
        newModPath.toLowerCase().endsWith(".zip") ||
        newModPath.toLowerCase().endsWith(".rar") ||
        newModPath.toLowerCase().endsWith(".7z")
      ) {
        setLoadingMessage("Analizando archivo ZIP...");
        // Reset all ZIP-related states first
        setZipStructure([]);
        setSelectedRoot("");
        setExpandedFolders(new Set());

        try {
          // Show ZIP structure modal
          const structure = await GetZipStructure(newModPath);
          console.log("ZIP structure received:", structure);

          // Ensure we have valid structure before proceeding
          if (!structure || structure.length === 0) {
            toast.error("El archivo ZIP no contiene archivos o está vacío");
            return;
          }

          // Prepare expanded folders
          const initialExpanded = new Set<string>();
          structure.forEach((file) => {
            if (file.isDir) {
              initialExpanded.add(file.path);
            }
          });

          // Update states in sequence
          setZipStructure(structure);
          setExpandedFolders(initialExpanded);
          setSelectedRoot("");

          // Show modal after a short delay to ensure states are updated
          setTimeout(() => {
            setShowZipModal(true);
          }, 100);
        } catch (zipError) {
          console.error("Error reading ZIP structure:", zipError);
          toast.error(
            "Error al leer la estructura del ZIP: " +
            (zipError as Error).message,
          );
        }
      } else {
        setLoadingMessage("Copiando archivos del mod...");
        await AddMod(selectedCharacter, newModName, newModPath, gameBananaUrl);
        setShowAddMod(false);
        setNewModName("");
        setNewModPath("");
        setGameBananaUrl("");
        await loadCharacterMods(selectedCharacter);
        await loadCharacters();
        toast.success(`Mod ${newModName} agregado correctamente`);
      }
    } catch (error) {
      console.error("Error adding mod:", error);
      toast.error("Error al agregar el mod: " + (error as Error).message);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleZipModalConfirm = async () => {
    handleZipModalConfirmAction();
  };


  const handleZipModalCancel = async () => {
    // Limpiar el directorio temporal en el backend
    try {
      await CleanupTempDirectory();
    } catch (error) {
      console.error("Error cleaning up temp directory:", error);
    }

    setShowZipModal(false);
    setZipStructure([]);
    setSelectedRoot("");
    setExpandedFolders(new Set());
    setNewModPath("");
    // Si estábamos en proceso de actualización, no limpiamos modToUpdate todavía para que el usuario pueda reintentar o cancelar explícitamente desde el diálogo de actualización si existiera,
    // pero aquí el modal de zip es parte del flujo.
    // Si cancelamos el zip, cancelamos la operación de actualización si era eso lo que hacíamos.
    if (modToUpdate) {
      setModToUpdate(null);
    }
  };

  const handleUpdateModClick = (character: string, modName: string, modUrl: string) => {
    setModToUpdate({ character, modName, currentUrl: modUrl });
  };

  const handleUpdateFromFile = async () => {
    if (!modToUpdate) return;

    // 1. Seleccionar archivo o carpeta
    // Por simplicidad, preguntamos primero qué quiere usar, o usamos un diálogo genérico?
    // Vamos a usar SelectFile por defecto para zips, o podríamos poner dos botones en el diálogo de confirmación.
    // Para hacerlo más fluido, abriremos un diálogo de selección que permita ambos si es posible, o botones separados.
    // Wails no tiene "SelectAny", así que usaremos SelectFile para Zips (lo más común)

    try {
      const file = await SelectFile();
      if (!file) return; // Cancelado por usuario

      setIsLoading(true);
      setLoadingMessage("Procesando actualización...");

      if (
        file.toLowerCase().endsWith(".zip") ||
        file.toLowerCase().endsWith(".rar") ||
        file.toLowerCase().endsWith(".7z")
      ) {
        setLoadingMessage("Analizando archivo ZIP...");
        setZipStructure([]);
        setSelectedRoot("");
        setExpandedFolders(new Set());

        const structure = await GetZipStructure(file);
        if (!structure || structure.length === 0) {
          toast.error("El archivo ZIP está vacío");
          setIsLoading(false);
          return;
        }

        // Preparar modal de zip
        const initialExpanded = new Set<string>();
        structure.forEach((f) => { if (f.isDir) initialExpanded.add(f.path); });

        setZipStructure(structure);
        setExpandedFolders(initialExpanded);
        setNewModPath(file); // Usamos esto para guardar la ruta temporalmente

        // Importante: mantenemos modToUpdate activo para saber que es una actualización
        setShowZipModal(true);
        setIsLoading(false);
      } else {
        // Es un archivo no zip? SelectFile tiene filtro.
        // Si queremos soportar carpetas, necesitaríamos otro botón.
        // Asumimos que si seleccionó algo es válido según el filtro.
        toast.error("Por favor selecciona un archivo comprimido (.zip, .rar, .7z)");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error selecting update file:", error);
      toast.error("Error al seleccionar archivo");
      setIsLoading(false);
    }
  };

  const handleUpdateFromFolder = async () => {
    if (!modToUpdate) return;

    try {
      const folder = await SelectDirectory();
      if (!folder) return;

      setIsLoading(true);
      setLoadingMessage("Actualizando desde carpeta...");

      await UpdateMod(modToUpdate.character, modToUpdate.modName, folder);

      toast.success(`Mod ${modToUpdate.modName} actualizado correctamente`);

      // Actualizar estado local para quitar la notificación inmediatamente
      setUpdates(prev => prev.filter(u => !(u.characterName === modToUpdate.character && u.modName === modToUpdate.modName)));

      setModToUpdate(null);
      await loadCharacterMods(modToUpdate.character);
      await checkForUpdates(); // Refrescar estado de actualizaciones del backend
    } catch (error) {
      console.error("Error updating from folder:", error);
      toast.error("Error al actualizar desde carpeta: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  // Modificar handleZipModalConfirm para manejar actualizaciones
  const handleZipModalConfirmAction = async () => {
    if (!selectedRoot) {
      toast.error("Por favor selecciona una carpeta raíz");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Extrayendo y copiando archivos...");

    try {
      if (modToUpdate) {
        // Es una actualización
        await UpdateModFromZipWithRoot(
          modToUpdate.character,
          modToUpdate.modName,
          newModPath,
          selectedRoot
        );
        toast.success(`Mod ${modToUpdate.modName} actualizado correctamente`);

        // Actualizar estado local para quitar la notificación inmediatamente
        setUpdates(prev => prev.filter(u => !(u.characterName === modToUpdate.character && u.modName === modToUpdate.modName)));

        setModToUpdate(null);
      } else {
        // Es un nuevo mod
        await AddModFromZipWithRoot(
          selectedCharacter,
          newModName,
          newModPath,
          selectedRoot,
          gameBananaUrl
        );
        toast.success(`Mod ${newModName} agregado correctamente`);
        setShowAddMod(false);
        setNewModName("");
        setGameBananaUrl("");
      }

      // Limpieza común
      setShowZipModal(false);
      setNewModPath("");
      setSelectedRoot("");
      setZipStructure([]);
      setExpandedFolders(new Set());

      if (selectedCharacter) {
        await loadCharacterMods(selectedCharacter);
      }
      await loadCharacters();
      await checkForUpdates();

    } catch (error) {
      console.error("Error processing ZIP:", error);
      toast.error("Error al procesar ZIP: " + error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // ZIP Modal state management
  useEffect(() => {
    if (showZipModal && zipStructure.length > 0) {
      console.log("ZIP modal shown with structure:", zipStructure);
    }
  }, [showZipModal, zipStructure]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const selectRootFolder = (path: string) => {
    setSelectedRoot(path);
  };

  // Component to render ZIP file tree
  const ZipFileTree: React.FC<{ files: ZipFile[]; level: number }> = ({
    files,
    level,
  }) => {
    // Early return if no files
    if (!files || files.length === 0) {
      return (
        <div className="text-gray-500 text-sm p-2">
          No hay archivos para mostrar
        </div>
      );
    }

    return (
      <div key={`zip-tree-${level}-${Date.now()}`}>
        {files.map((file) => (
          <div
            key={`${file.path}-${file.isDir}`}
            style={{ paddingLeft: `${level * 20}px` }}
          >
            <div
              className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedRoot === file.path ? "bg-blue-100 dark:bg-blue-900" : ""
                }`}
              onClick={() => {
                if (file.isDir) {
                  selectRootFolder(file.path);
                }
              }}
            >
              {file.isDir && (
                <span
                  className="mr-1 p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(file.path);
                  }}
                >
                  {expandedFolders.has(file.path) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              )}
              {file.isDir ? (
                <Folder className="w-4 h-4 mr-2 text-blue-500" />
              ) : (
                <File className="w-4 h-4 mr-2 text-gray-500" />
              )}
              <span className="text-sm">{file.name}</span>
              {file.isDir && (
                <span className="ml-2 text-xs text-gray-500">
                  ({file.children ? file.children.length : 0} items)
                </span>
              )}
            </div>
            {file.isDir &&
              expandedFolders.has(file.path) &&
              file.children &&
              file.children.length > 0 && (
                <ZipFileTree files={file.children} level={level + 1} />
              )}
          </div>
        ))}
      </div>
    );
  };

  const handleRemoveModClick = (character: string, modName: string) => {
    setModToDelete({ character, modName });
  };

  const confirmRemoveMod = async () => {
    if (!modToDelete) return;

    const { character, modName } = modToDelete;
    setIsLoading(true);
    setLoadingMessage("Eliminando mod...");
    try {
      await RemoveMod(character, modName);
      await loadCharacterMods(character);
      await loadCharacters();
      toast.success(`Mod ${modName} eliminado correctamente`);
    } catch (error) {
      console.error("Error removing mod:", error);
      toast.error("Error al eliminar el mod");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      setModToDelete(null);
    }
  };

  const handleOpenModFolder = async (modPath: string) => {
    try {
      await OpenModFolder(modPath);
    } catch (error) {
      console.error("Error opening mod folder:", error);
      toast.error("Error al abrir la carpeta del mod");
    }
  };

  const handleSaveConfig = async () => {
    try {
      await SaveConfig(configPath);
      setIsAppConfigured(true);
      setShowConfig(false);
      await loadCharacters();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await SelectDirectory();
      if (selectedPath) {
        setConfigPath(selectedPath);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
      toast.error("Error al seleccionar la carpeta");
    }
  };

  const handleSelectModDirectory = async () => {
    try {
      const selectedPath = await SelectDirectory();
      if (selectedPath) {
        setNewModPath(selectedPath);
      }
    } catch (error) {
      console.error("Error selecting mod directory:", error);
      toast.error("Error al seleccionar la carpeta del mod");
    }
  };

  const handleSelectModFile = async () => {
    try {
      const selectedFile = await SelectFile();
      if (selectedFile) {
        setNewModPath(selectedFile);
      }
    } catch (error) {
      console.error("Error selecting mod file:", error);
      toast.error("Error al seleccionar el archivo del mod");
    }
  };

  if (isAppConfigured === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Cargando...</CardTitle>
            <CardDescription>Inicializando aplicación</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAppConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Configuración Inicial
            </CardTitle>
            <CardDescription className="text-center">
              Configura la ruta de la carpeta de mods para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modsPath">
                  Ruta de la carpeta 'mods' de 3DMigoto:
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="modsPath"
                    type="text"
                    value={configPath}
                    onChange={(e) => setConfigPath(e.target.value)}
                    placeholder="Ej: C:\\Genshin Impact\\3DMigoto\\mods"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectDirectory}
                    className="px-3"
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta es la carpeta donde se crearán las carpetas de personajes
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSaveConfig}
              disabled={!configPath}
              className="w-full"
            >
              Guardar Configuración
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 relative">
      <Toaster position="top-center" richColors closeButton />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <Card className="w-[300px]">
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-center">{loadingMessage}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!modToDelete}
        onOpenChange={(open) => !open && setModToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el
              mod "{modToDelete?.modName}" de la carpeta de {modToDelete?.character}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMod}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Dialog */}
      <AlertDialog open={!!modToUpdate && !showZipModal} onOpenChange={(open) => !open && setModToUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Actualizar Mod</AlertDialogTitle>
            <AlertDialogDescription>
              Hay una actualización disponible para "{modToUpdate?.modName}".
              ¿Cómo deseas actualizarlo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {modToUpdate?.currentUrl && (
              <Button onClick={() => OpenUrl(modToUpdate.currentUrl!)} variant="outline" className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                Ir a la página del mod (GameBanana)
              </Button>
            )}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O actualizar manualmente</span>
              </div>
            </div>
            <Button onClick={handleUpdateFromFile} className="w-full justify-start">
              <File className="mr-2 h-4 w-4" />
              Seleccionar archivo ZIP
            </Button>
            <Button onClick={handleUpdateFromFolder} variant="secondary" className="w-full justify-start">
              <Folder className="mr-2 h-4 w-4" />
              Seleccionar Carpeta
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-3xl font-bold">
                  Genshin Impact Mod Manager
                </CardTitle>
                <CardDescription>
                  Administra tus mods de 3DMigoto
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <ModeToggle />
                <Button variant="outline" onClick={() => setShowConfig(true)}>
                  Configuración
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sidebar - Character List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Personajes</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {characters.map((character) => (
                      <Button
                        key={character.name}
                        variant={
                          selectedCharacter === character.name
                            ? "secondary"
                            : "ghost"
                        }
                        onClick={() => handleCharacterSelect(character.name)}
                        className={`w-full justify-between h-auto py-3 ${!character.hasFolder ? "opacity-70" : ""}`}
                      // disabled={!character.hasFolder}
                      >
                        <span className="font-medium capitalize">
                          {character.name}
                        </span>
                        <div className="flex items-center space-x-2">
                          {!character.hasFolder && (
                            <Badge variant="outline" className="text-xs">
                              Sin carpeta
                            </Badge>
                          )}
                          {updates.some(u => u.characterName === character.name) && (
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Actualizaciones disponibles" />
                          )}
                          <Badge
                            variant={
                              selectedCharacter === character.name
                                ? "default"
                                : "secondary"
                            }
                          >
                            {character.mods.length} mods
                          </Badge>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Character Mods */}
          <div className="lg:col-span-3">
            {selectedCharacter ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl capitalize">
                        Mods de {selectedCharacter}
                      </CardTitle>
                      <CardDescription>
                        {characters.find((c) => c.name === selectedCharacter)
                          ?.hasFolder
                          ? `${characterMods.length} mods encontrados`
                          : "La carpeta se creará al agregar el primer mod"}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setShowAddMod(true)}
                      variant="default"
                      size="sm"
                      className="gap-1"
                    >
                      <span className="text-lg">+</span> Agregar Mod
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Updates Alert */}
                  {updates.filter(u => u.characterName === selectedCharacter).length > 0 && (
                    <Alert className="mb-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      <AlertTitle>Actualizaciones disponibles</AlertTitle>
                      <AlertDescription>
                        Hay actualizaciones para algunos mods de este personaje. Busca el icono de actualización en la lista.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Mod List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characterMods.map((mod) => {
                      const hasUpdate = updates.some(u => u.characterName === mod.character && u.modName === mod.name);
                      const updateInfo = updates.find(u => u.characterName === mod.character && u.modName === mod.name);

                      return (
                        <Card key={mod.id} className={`overflow-hidden ${!mod.isActive ? "opacity-70 bg-muted" : ""}`}>
                          <CardHeader className="p-4 pb-2 space-y-0">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base font-medium truncate pr-2" title={mod.name}>
                                {mod.name}
                              </CardTitle>
                              {hasUpdate && (
                                <Badge variant="default" className="bg-green-500 hover:bg-green-600 animate-pulse">
                                  Update
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-2 pb-2">
                            <div className="text-xs text-muted-foreground mb-2">
                              Estado: {mod.isActive ? "Activo" : "Desactivado"}
                            </div>
                            {hasUpdate && (
                              <div className="text-xs text-green-600 dark:text-green-400 mb-2">
                                Nueva versión disponible ({updateInfo?.remoteDate})
                              </div>
                            )}
                          </CardContent>
                          <CardFooter className="p-4 pt-0 flex justify-between gap-2">
                            <div className="flex gap-2">
                              <Button
                                variant={mod.isActive ? "secondary" : "default"}
                                size="sm"
                                onClick={() => handleToggleMod(mod.character, mod.name)}
                              >
                                {mod.isActive ? "Desactivar" : "Activar"}
                              </Button>
                              {hasUpdate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                                  onClick={() => handleUpdateModClick(mod.character, mod.name, updateInfo?.modUrl || "")}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Actualizar
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenModFolder(mod.fullPath)}
                                title="Abrir carpeta"
                              >
                                <Folder className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveModClick(mod.character, mod.name)}
                                title="Eliminar mod"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Add Mod Form */}
                  {showAddMod && (
                    <Card className="mb-6">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                          Agregar Nuevo Mod
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="modName">Nombre del mod</Label>
                            <Input
                              id="modName"
                              type="text"
                              placeholder="Ej: Mod de Traje"
                              value={newModName}
                              onChange={(e) => setNewModName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="modPath">
                              Ruta de los archivos
                            </Label>
                            <div className="flex space-x-2">
                              <Input
                                id="modPath"
                                type="text"
                                placeholder="Ruta del mod (carpeta o archivo .zip)"
                                value={newModPath}
                                onChange={(e) => setNewModPath(e.target.value)}
                                className="flex-1" />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleSelectModDirectory}
                                className="px-3"
                              >
                                <Folder className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleSelectModFile}
                                className="px-3"
                              >
                                <File className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="gameBananaUrl">
                              Enlace de GameBanana (Opcional)
                            </Label>
                            <Input
                              id="gameBananaUrl"
                              type="text"
                              placeholder="https://gamebanana.com/mods/..."
                              value={gameBananaUrl}
                              onChange={(e) => setGameBananaUrl(e.target.value)} />
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowAddMod(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleAddMod}
                          disabled={!newModName || !newModPath}
                        >
                          Agregar Mod
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {/* ZIP Structure Modal */}
                  {showZipModal && (
                    <div
                      key={`zip-modal-${newModPath}-${Date.now()}`}
                      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    >
                      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Folder className="w-5 h-5" />
                            Seleccionar raíz del mod
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="mb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Selecciona la carpeta raíz del mod dentro del
                              archivo ZIP:
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {newModPath}
                            </p>
                          </div>

                          <ScrollArea className="h-50 border rounded-md p-2">
                            <ZipFileTree files={zipStructure} level={0} />
                          </ScrollArea>

                          {selectedRoot && (
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                              <p className="text-sm">
                                <span className="font-medium">
                                  Raíz seleccionada:
                                </span>{" "}
                                {selectedRoot}
                              </p>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={handleZipModalCancel}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleZipModalConfirm}
                            disabled={!selectedRoot}
                          >
                            Confirmar
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  )}


                </CardContent>
              </Card>
            ) : (
              <Card className="text-center p-8">
                <div className="text-muted-foreground mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <CardTitle className="text-lg font-medium mb-2">
                  Selecciona un personaje
                </CardTitle>
                <CardDescription>
                  Elige un personaje de la lista para ver y gestionar sus mods.
                </CardDescription>
              </Card>
            )}
          </div>
        </div>
      </div >

      {/* Configuration Modal */}
      {
        showConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
                <CardDescription>
                  Configura la ruta de la carpeta de mods de 3DMigoto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="configPath">Ruta de la carpeta 'mods'</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="configPath"
                        type="text"
                        value={configPath}
                        onChange={(e) => setConfigPath(e.target.value)}
                        placeholder="Ej: C:\\Genshin Impact\\3DMigoto\\mods"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSelectDirectory}
                        className="px-3"
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Esta es la carpeta donde se crearán las carpetas de
                      personajes
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowConfig(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig} disabled={!configPath}>
                  Guardar Cambios
                </Button>
              </CardFooter>
            </Card>
          </div>
        )
      }
    </div >
  );
};

export default App;
