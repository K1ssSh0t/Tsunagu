import React, { useState, useEffect } from "react";
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
import { character, mod, utils } from "../wailsjs/go/models";
import { ModeToggle } from "./components/mode-toggle";
import { GameSelector } from "./components/game-selector";
import { Settings } from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Refactored Components
import { LoadingOverlay } from "./components/LoadingOverlay";
import { DeleteAlertDialog } from "./components/DeleteAlertDialog";
import { Sidebar } from "./components/Sidebar";
import { ModList } from "./components/ModList";
import { ConfigScreen } from "./components/ConfigScreen";
import { ZipModal } from "./components/ZipModal";
import { AddModDialog } from "./components/AddModDialog";
import { UpdateModDialog } from "./components/UpdateModDialog";

type Character = character.Character;
type Mod = mod.Mod;
type ZipFile = utils.ZipFile;

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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [modToDelete, setModToDelete] = useState<{
    character: string;
    modName: string;
  } | null>(null);
  const [updates, setUpdates] = useState<mod.ModUpdate[]>([]);
  const [modToUpdate, setModToUpdate] = useState<{
    character: string;
    modName: string;
    currentUrl?: string;
  } | null>(null);

  const [selectedGame, setSelectedGame] = useState("genshin");
  const [gamesConfig, setGamesConfig] = useState<any>({});

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

      const config = await GetGamesConfig();
      setGamesConfig(config);
      if (config.games && config.games[game]) {
        setConfigPath(config.games[game].modsPath);
      } else {
        setConfigPath("");
      }

      const configured = await IsConfigured();
      setIsAppConfigured(configured);

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
          `Se encontraron ${availableUpdates.length} actualizaciones disponibles`
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
          `Mod ${modName} ${mod.isActive ? "activado" : "desactivado"} correctamente`
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

        try {
          const structure = await GetZipStructure(newModPath);

          if (!structure || structure.length === 0) {
            toast.error("El archivo ZIP no contiene archivos o está vacío");
            return;
          }

          setZipStructure(structure);
          setSelectedRoot("");
          setTimeout(() => {
            setShowZipModal(true);
          }, 100);
        } catch (zipError) {
          console.error("Error reading ZIP structure:", zipError);
          toast.error(
            "Error al leer la estructura del ZIP: " + (zipError as Error).message
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

  const handleZipModalCancel = async () => {
    try {
      await CleanupTempDirectory();
    } catch (error) {
      console.error("Error cleaning up temp directory:", error);
    }

    setShowZipModal(false);
    setZipStructure([]);
    setSelectedRoot("");
    setNewModPath("");
    if (modToUpdate) {
      setModToUpdate(null);
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

        setUpdates((prev) =>
          prev.filter(
            (u) =>
              !(
                u.characterName === modToUpdate.character &&
                u.modName === modToUpdate.modName
              )
          )
        );

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

  const handleUpdateModClick = (
    character: string,
    modName: string,
    modUrl: string
  ) => {
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

        const structure = await GetZipStructure(file);
        if (!structure || structure.length === 0) {
          toast.error("El archivo ZIP está vacío");
          setIsLoading(false);
          return;
        }

        setZipStructure(structure);
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

      setUpdates((prev) =>
        prev.filter(
          (u) =>
            !(
              u.characterName === modToUpdate.character &&
              u.modName === modToUpdate.modName
            )
        )
      );

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

  return (
    <div className="min-h-screen bg-background p-6 relative">
      <Toaster position="top-center" richColors closeButton />

      {isLoading && <LoadingOverlay message={loadingMessage} />}

      <DeleteAlertDialog
        isOpen={!!modToDelete}
        modName={modToDelete?.modName || ""}
        characterName={modToDelete?.character || ""}
        onCancel={() => setModToDelete(null)}
        onConfirm={confirmRemoveMod}
      />

      <UpdateModDialog
        isOpen={!!modToUpdate && !showZipModal}
        modName={modToUpdate?.modName || ""}
        currentUrl={modToUpdate?.currentUrl}
        onOpenUrl={OpenUrl}
        onUpdateFromFile={handleUpdateFromFile}
        onUpdateFromFolder={handleUpdateFromFolder}
        onCancel={() => setModToUpdate(null)}
      />

      <ConfigScreen
        isAppConfigured={isAppConfigured}
        showConfig={showConfig}
        selectedGame={selectedGame}
        configPath={configPath}
        gamesConfig={gamesConfig}
        onClose={() => setShowConfig(false)}
        onGameSelect={(game) => {
          setSelectedGame(game);
          if (gamesConfig.games && gamesConfig.games[game]) {
            setConfigPath(gamesConfig.games[game].modsPath);
          } else {
            setConfigPath("");
          }
        }}
        onConfigPathChange={setConfigPath}
        onSelectDirectory={handleSelectDirectory}
        onSave={handleUpdateGamePath}
      />

      <AddModDialog
        isOpen={showAddMod}
        selectedCharacter={selectedCharacter}
        newModName={newModName}
        newModPath={newModPath}
        gameBananaUrl={gameBananaUrl}
        onNameChange={setNewModName}
        onPathChange={setNewModPath}
        onUrlChange={setGameBananaUrl}
        onSelectFile={handleSelectModFile}
        onSelectFolder={handleSelectModDirectory}
        onCancel={() => setShowAddMod(false)}
        onConfirm={handleAddMod}
      />

      <ZipModal
        isOpen={showZipModal}
        zipStructure={zipStructure}
        selectedRoot={selectedRoot}
        onSelectRoot={setSelectedRoot}
        onCancel={handleZipModalCancel}
        onConfirm={handleZipModalConfirmAction}
      />

      {/* Main Layout */}
      {(!(!isAppConfigured || showConfig)) && (
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
            <Sidebar
              characters={characters}
              selectedCharacter={selectedCharacter}
              updates={updates}
              onSelectCharacter={handleCharacterSelect}
            />

            <ModList
              selectedCharacter={selectedCharacter}
              mods={characterMods}
              updates={updates}
              onAddMod={() => setShowAddMod(true)}
              onToggleMod={handleToggleMod}
              onUpdateModClick={handleUpdateModClick}
              onOpenUrl={OpenUrl}
              onActivateSingle={handleActivateSingle}
              onOpenFolder={handleOpenModFolder}
              onRemoveMod={handleRemoveModClick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
