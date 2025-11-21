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
  SelectDirectory,
  SelectFile,
  CheckForUpdates,
  OpenUrl,
  UpdateMod,
  UpdateModFromZipWithRoot,
  SetGame,
  GetCurrentGame,
  GetGamesConfig,
  UpdateGamePath,
} from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { ModeToggle } from "./components/mode-toggle";
import { GameSelector } from "./components/game-selector";
import { Trash2, Folder, File, ChevronRight, ChevronDown, Loader2, RefreshCw, Download, MoreVertical, Settings, Gamepad2, Globe } from "lucide-react";

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


import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const [selectedGame, setSelectedGame] = useState("genshin");
  const [gamesConfig, setGamesConfig] = useState<any>({}); // Using any for now as Config type might not be generated yet

  const hasCheckedConfig = React.useRef(false);

  useEffect(() => {
    if (hasCheckedConfig.current) return;
    hasCheckedConfig.current = true;
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const game = await GetCurrentGame();
      setSelectedGame(game);

      const config = await GetGamesConfig();
      setGamesConfig(config);

      // Set initial config path for the selected game
      if (config.games && config.games[game]) {
        setConfigPath(config.games[game].modsPath);
      } else {
        setConfigPath("");
      }

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

  const handleGameSelect = async (game: string) => {
    setIsLoading(true);
    setLoadingMessage(`Cambiando a ${game}...`);
    try {
      await SetGame(game);
      setSelectedGame(game);

      // Update config path for the new game
      const config = await GetGamesConfig();
      setGamesConfig(config);
      if (config.games && config.games[game]) {
        setConfigPath(config.games[game].modsPath);
      } else {
        setConfigPath("");
      }

      const configured = await IsConfigured();
      setIsAppConfigured(configured);

      // Reset selection
      setSelectedCharacter("");
      setCharacterMods([]);

      if (configured) {
        await loadCharacters();
        await checkForUpdates();
      } else {
        setCharacters([]);
      }
    } catch (error) {
      console.error("Error switching game:", error);
      toast.error("Error al cambiar de juego");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const checkForUpdates = async () => {
    try {
      const availableUpdates = await CheckForUpdates();
      if (availableUpdates && availableUpdates.length > 0) {
        setUpdates(availableUpdates);
        toast.info(
          `Se encontraron ${availableUpdates.length} actualizaciones disponibles`,
          // {
          //   action: {
          //     label: "Ver",
          //     onClick: () => {
          //       console.log("Updates:", availableUpdates);
          //     },
          //   },
          // },
        );
      } else {
        setUpdates([]);
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
      if (
        newModPath.toLowerCase().endsWith(".zip") ||
        newModPath.toLowerCase().endsWith(".rar") ||
        newModPath.toLowerCase().endsWith(".7z")
      ) {
        setLoadingMessage("Analizando archivo ZIP...");
        setZipStructure([]);
        setSelectedRoot("");
        setExpandedFolders(new Set());

        try {
          const structure = await GetZipStructure(newModPath);

          if (!structure || structure.length === 0) {
            toast.error("El archivo ZIP no contiene archivos o está vacío");
            return;
          }

          const initialExpanded = new Set<string>();
          structure.forEach((file) => {
            if (file.isDir) {
              initialExpanded.add(file.path);
            }
          });

          setZipStructure(structure);
          setExpandedFolders(initialExpanded);
          setSelectedRoot("");

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
    if (modToUpdate) {
      setModToUpdate(null);
    }
  };

  const handleUpdateModClick = (character: string, modName: string, modUrl: string) => {
    setModToUpdate({ character, modName, currentUrl: modUrl });
  };

  const handleUpdateFromFile = async () => {
    if (!modToUpdate) return;

    try {
      const file = await SelectFile();
      if (!file) return;

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

        const initialExpanded = new Set<string>();
        structure.forEach((f) => { if (f.isDir) initialExpanded.add(f.path); });

        setZipStructure(structure);
        setExpandedFolders(initialExpanded);
        setNewModPath(file);

        setShowZipModal(true);
        setIsLoading(false);
      } else {
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

      setUpdates(prev => prev.filter(u => !(u.characterName === modToUpdate.character && u.modName === modToUpdate.modName)));

      setModToUpdate(null);
      await loadCharacterMods(modToUpdate.character);
      await checkForUpdates();
    } catch (error) {
      console.error("Error updating from folder:", error);
      toast.error("Error al actualizar desde carpeta: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipModalConfirmAction = async () => {
    if (!selectedRoot) {
      toast.error("Por favor selecciona una carpeta raíz");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Extrayendo y copiando archivos...");

    try {
      if (modToUpdate) {
        await UpdateModFromZipWithRoot(
          modToUpdate.character,
          modToUpdate.modName,
          newModPath,
          selectedRoot
        );
        toast.success(`Mod ${modToUpdate.modName} actualizado correctamente`);

        setUpdates(prev => prev.filter(u => !(u.characterName === modToUpdate.character && u.modName === modToUpdate.modName)));

        setModToUpdate(null);
      } else {
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

  const ZipFileTree: React.FC<{ files: ZipFile[]; level: number }> = ({
    files,
    level,
  }) => {
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

  const handleUpdateGamePath = async () => {
    try {
      await UpdateGamePath(selectedGame, configPath);
      setIsAppConfigured(true);
      setShowConfig(false);

      // Update local config state
      const newConfig = { ...gamesConfig };
      if (!newConfig.games) newConfig.games = {};
      newConfig.games[selectedGame] = { modsPath: configPath };
      setGamesConfig(newConfig);

      await loadCharacters();
      toast.success("Configuración guardada correctamente");
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

  // Configuration Screen (Initial or Requested)
  if (!isAppConfigured || showConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute top-4 right-4 flex gap-2">
          {isAppConfigured && (
            <Button variant="ghost" onClick={() => setShowConfig(false)}>
              Cerrar
            </Button>
          )}
          <ModeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Configuración
            </CardTitle>
            <CardDescription className="text-center">
              Configura las rutas de mods para tus juegos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-center">
                <GameSelector
                  selectedGame={selectedGame}
                  onGameSelect={(game) => {
                    setSelectedGame(game);
                    // Update input with path for selected game
                    if (gamesConfig.games && gamesConfig.games[game]) {
                      setConfigPath(gamesConfig.games[game].modsPath);
                    } else {
                      setConfigPath("");
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modsPath">
                  Ruta de mods para {selectedGame === "genshin" ? "Genshin Impact" :
                    selectedGame === "wuwa" ? "Wuthering Waves" :
                      selectedGame === "hsr" ? "Honkai: Star Rail" : "Zenless Zone Zero"}:
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
                  Selecciona la carpeta donde se guardarán los mods para este juego.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleUpdateGamePath}
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

      {/* Loading Overlay - Increased z-index to ensure it's above modals */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-100 flex items-center justify-center">
          <Card className="w-[300px] shadow-lg">
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
                  Mod Manager
                </CardTitle>
                <CardDescription>
                  Administra tus mods de 3DMigoto
                </CardDescription>
              </div>
              <div className="flex items-center space-x-4">
                <GameSelector
                  selectedGame={selectedGame}
                  onGameSelect={handleGameSelect}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowConfig(true)}
                  title="Configuración"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <ModeToggle />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Character List */}
          <Card className="md:col-span-1 h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Personajes</CardTitle>
              <div className="relative">
                <Input placeholder="Buscar..." className="h-8" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-1">
                  {characters.map((char) => {
                    const hasCharUpdate = updates.some(u => u.characterName === char.name);
                    return (
                      <Button
                        key={char.name}
                        variant={
                          selectedCharacter === char.name ? "secondary" : "ghost"
                        }
                        className="w-full justify-start capitalize relative"
                        onClick={() => handleCharacterSelect(char.name)}
                      >
                        <span className="truncate">{char.name}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {hasCharUpdate && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                          )}
                          {char.hasFolder && (
                            <Badge variant="outline" className="text-xs">
                              {char.mods ? char.mods.length : 0}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                  {characters.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No hay personajes
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Mods List */}
          <Card className="md:col-span-3 h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <div>
                <CardTitle className="text-xl capitalize">
                  {selectedCharacter || "Selecciona un personaje"}
                </CardTitle>
                <CardDescription>
                  {selectedCharacter
                    ? `Gestionando mods para ${selectedCharacter}`
                    : "Selecciona un personaje para ver sus mods"}
                </CardDescription>
              </div>
              {selectedCharacter && (
                <Button onClick={() => setShowAddMod(true)}>
                  Agregar Mod
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 bg-muted/20">
              {!selectedCharacter ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Gamepad2 className="h-16 w-16 mb-4 opacity-20" />
                  <p>Selecciona un personaje de la lista</p>
                </div>
              ) : characterMods.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Folder className="h-16 w-16 mb-4 opacity-20" />
                  <p>No hay mods instalados para este personaje</p>
                  <Button
                    variant="link"
                    onClick={() => setShowAddMod(true)}
                    className="mt-2"
                  >
                    Agregar el primer mod
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-full pr-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {characterMods.map((mod) => {
                      const hasUpdate = updates.some(u => u.characterName === mod.character && u.modName === mod.name);
                      const updateInfo = updates.find(u => u.characterName === mod.character && u.modName === mod.name);

                      return (
                        <div key={mod.id} className="group relative flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all duration-200 shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className={`h-10 w-1 rounded-full ${mod.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30"}`} />

                            <div className="flex flex-col overflow-hidden">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate text-base">{mod.name}</h3>
                                {hasUpdate && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 px-1.5 text-[10px] border-green-500/50 text-green-500 bg-green-500/10 animate-pulse cursor-pointer hover:bg-green-500/20"
                                    onClick={() => handleUpdateModClick(mod.character, mod.name, updateInfo?.modUrl || "")}
                                  >
                                    Update
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {mod.isActive ? "Habilitado" : "Deshabilitado"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(mod as any).gameBananaUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Ver en GameBanana"
                                onClick={() => OpenUrl((mod as any).gameBananaUrl)}
                              >
                                <Globe className="h-4 w-4" />
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleActivateSingle(mod.character, mod.name)}>
                                  Activar Solo Este
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenModFolder(mod.fullPath)}>
                                  Abrir Carpeta
                                </DropdownMenuItem>
                                {hasUpdate && (
                                  <DropdownMenuItem onClick={() => handleUpdateModClick(mod.character, mod.name, updateInfo?.modUrl || "")}>
                                    Actualizar Mod
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => handleRemoveModClick(mod.character, mod.name)}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="pl-2 border-l ml-1">
                              <Switch
                                checked={mod.isActive}
                                onCheckedChange={() => handleToggleMod(mod.character, mod.name)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Mod Dialog */}
      {showAddMod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Agregar Nuevo Mod</CardTitle>
              <CardDescription>
                Agrega un mod para {selectedCharacter}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modName">Nombre del Mod</Label>
                <Input
                  id="modName"
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  placeholder="Ej: Skin Verano"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modPath">Archivo o Carpeta del Mod</Label>
                <div className="flex space-x-2">
                  <Input
                    id="modPath"
                    value={newModPath}
                    onChange={(e) => setNewModPath(e.target.value)}
                    placeholder="Ruta al archivo .zip o carpeta"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Folder className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleSelectModFile}>
                        <File className="mr-2 h-4 w-4" />
                        Seleccionar Archivo (ZIP/RAR)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSelectModDirectory}>
                        <Folder className="mr-2 h-4 w-4" />
                        Seleccionar Carpeta
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gameBananaUrl">URL de GameBanana (Opcional)</Label>
                <Input
                  id="gameBananaUrl"
                  value={gameBananaUrl}
                  onChange={(e) => setGameBananaUrl(e.target.value)}
                  placeholder="https://gamebanana.com/mods/..."
                />
                <p className="text-xs text-muted-foreground">
                  Permite verificar actualizaciones automáticamente
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddMod(false)}>
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
        </div>
      )}

      {/* ZIP Structure Modal */}
      {showZipModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle>Estructura del ZIP</CardTitle>
              <CardDescription>
                Selecciona la carpeta raíz del mod dentro del archivo comprimido.
                Busca la carpeta que contiene los archivos .ini y .dds
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full border rounded-md p-2">
                <ZipFileTree files={zipStructure} level={0} />
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground truncate max-w-[50%]">
                Seleccionado: {selectedRoot || "Ninguno (Raíz del ZIP)"}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleZipModalCancel}>
                  Cancelar
                </Button>
                <Button onClick={handleZipModalConfirm}>
                  Confirmar Selección
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};



export default App;
