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
  MoveMod,
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
  UpdateGameExecutable,
  LaunchXXMI,
  SelectExecutable,
  GetModDownloadFiles,
  DownloadModUpdate,
  CleanupCachedFile,
} from "../wailsjs/go/main/App";
import { character, mod, utils } from "../wailsjs/go/models";
import { ModeToggle } from "./components/mode-toggle";
import { GameSelector } from "./components/game-selector";
import { Settings, Gamepad2 } from "lucide-react";

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
import { MoveModDialog } from "./components/MoveModDialog";
import { FileSelectionDialog, ModFile } from "./components/FileSelectionDialog";
import { DownloadProgressDialog } from "./components/DownloadProgressDialog";
import { CleanupDialog } from "./components/CleanupDialog";

type Character = character.Character & {
  skins?: { name: string; folder: string }[];
};
type Mod = mod.Mod;
type ZipFile = utils.ZipFile;

const App: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [selectedSkin, setSelectedSkin] = useState<{
    name: string;
    folder: string;
  } | null>(null);
  const [characterMods, setCharacterMods] = useState<Mod[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isAppConfigured, setIsAppConfigured] = useState<boolean | null>(null);
  const [showAddMod, setShowAddMod] = useState(false);
  const [newModPath, setNewModPath] = useState("");
  const [newModName, setNewModName] = useState("");
  const [gameBananaUrl, setGameBananaUrl] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [executablePath, setExecutablePath] = useState("");
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

  const [modToMove, setModToMove] = useState<{
    character: string;
    modName: string;
  } | null>(null);

  const [selectedGame, setSelectedGame] = useState("genshin");
  const [gamesConfig, setGamesConfig] = useState<any>({});

  // Download-related states
  const [showFileSelection, setShowFileSelection] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<ModFile[]>([]);
  const [showDownloadProgress, setShowDownloadProgress] = useState(false);
  const [downloadingFileName, setDownloadingFileName] = useState("");
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cachedFilePath, setCachedFilePath] = useState("");
  const [cachedFileSize, setCachedFileSize] = useState(0);
  const [downloadContext, setDownloadContext] = useState<{
    character: string;
    modName: string;
  } | null>(null);

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
        setConfigPath(config.games[game].modsPath || "");
        setExecutablePath(config.games[game].executablePath || "");
      } else {
        setConfigPath("");
        setExecutablePath("");
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
        setConfigPath(config.games[game].modsPath || "");
        setExecutablePath(config.games[game].executablePath || "");
      } else {
        setConfigPath("");
        setExecutablePath("");
      }

      const configured = await IsConfigured();
      setIsAppConfigured(configured);

      setSelectedCharacter("");
      setSelectedSkin(null);
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
      setCharacters(chars as Character[]);
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
    setSelectedSkin(null);
    await loadCharacterMods(characterName);
  };

  const handleSkinSelect = async (
    skin: { name: string; folder: string } | null,
  ) => {
    setSelectedSkin(skin);
    if (skin) {
      await loadCharacterMods(skin.folder);
    } else {
      await loadCharacterMods(selectedCharacter);
    }
  };

  const handleToggleMod = async (character: string, modName: string) => {
    // If a skin is selected, 'character' argument coming from ModList might be the skin folder name
    // or we should use the current context.
    // Actually, ModList passes the selectedCharacter prop, which is the main character name.
    // But for skins, we need to operate on the skin folder.
    // So we should use selectedSkin.folder if it exists.

    const targetFolder = selectedSkin ? selectedSkin.folder : selectedCharacter;

    setIsLoading(true);
    setLoadingMessage("Actualizando estado del mod...");
    try {
      await ToggleMod(targetFolder, modName);
      await loadCharacterMods(targetFolder);
      // We don't need to reload all characters unless we want to update the "HasFolder" status,
      // but for toggling mods it's not strictly necessary and avoids flickering.
      // await loadCharacters();
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
    const targetFolder = selectedSkin ? selectedSkin.folder : selectedCharacter;

    setIsLoading(true);
    setLoadingMessage("Activando mod único...");
    try {
      await ActivateSingleMod(targetFolder, modName);
      await loadCharacterMods(targetFolder);
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
    const targetFolder = selectedSkin ? selectedSkin.folder : selectedCharacter;

    if (!targetFolder || !newModName || !newModPath) return;

    const trimmedModName = newModName.trim();
    if (!trimmedModName) {
      toast.error("El nombre del mod no puede estar vacío");
      return;
    }

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
            "Error al leer la estructura del ZIP: " +
              (zipError as Error).message,
          );
        }
      } else {
        setLoadingMessage("Copiando archivos del mod...");
        await AddMod(targetFolder, trimmedModName, newModPath, gameBananaUrl);
        setShowAddMod(false);
        setNewModName("");
        setNewModPath("");
        setGameBananaUrl("");
        await loadCharacterMods(targetFolder);
        await loadCharacters();
        toast.success(`Mod ${trimmedModName} agregado correctamente`);
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

    const targetFolder = selectedSkin ? selectedSkin.folder : selectedCharacter;
    const trimmedModName = newModName.trim();

    setIsLoading(true);
    setLoadingMessage("Extrayendo y copiando archivos...");

    try {
      if (modToUpdate) {
        await UpdateModFromZipWithRoot(
          modToUpdate.character, // This comes from the mod object, which should have the correct folder
          modToUpdate.modName,
          newModPath,
          selectedRoot,
        );
        toast.success(`Mod ${modToUpdate.modName} actualizado correctamente`);

        setUpdates((prev) =>
          prev.filter(
            (u) =>
              !(
                u.characterName === modToUpdate.character &&
                u.modName === modToUpdate.modName
              ),
          ),
        );

        setModToUpdate(null);

        // If this was a downloaded file, show cleanup dialog
        if (cachedFilePath) {
          setShowCleanupDialog(true);
        }
      } else {
        if (!trimmedModName) {
          toast.error("El nombre del mod no puede estar vacío");
          setIsLoading(false);
          return;
        }

        await AddModFromZipWithRoot(
          targetFolder,
          trimmedModName,
          newModPath,
          selectedRoot,
          gameBananaUrl,
        );
        toast.success(`Mod ${trimmedModName} agregado correctamente`);
        setShowAddMod(false);
        setNewModName("");
        setGameBananaUrl("");
      }

      setShowZipModal(false);
      setNewModPath("");
      setSelectedRoot("");
      setZipStructure([]);

      if (targetFolder) {
        await loadCharacterMods(targetFolder);
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
    modUrl: string,
  ) => {
    // character here is the folder name (either character name or skin folder)
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
        toast.error(
          "Por favor selecciona un archivo comprimido (.zip, .rar, .7z)",
        );
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
            ),
        ),
      );

      setModToUpdate(null);
      await loadCharacterMods(modToUpdate.character);
    } catch (error) {
      console.error("Error updating from folder:", error);
      toast.error("Error al actualizar desde carpeta: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadFromGameBanana = async () => {
    if (!modToUpdate || !modToUpdate.currentUrl) return;

    try {
      setIsLoading(true);
      setLoadingMessage("Obteniendo archivos disponibles...");

      // Fetch available files from GameBanana API
      const files = await GetModDownloadFiles(modToUpdate.currentUrl);

      if (!files || files.length === 0) {
        toast.error("No hay archivos disponibles para descargar");
        setIsLoading(false);
        return;
      }

      // Store download context
      setDownloadContext({
        character: modToUpdate.character,
        modName: modToUpdate.modName,
      });

      // Show file selection dialog
      setAvailableFiles(files);
      setShowFileSelection(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching mod files:", error);
      toast.error("Error al obtener archivos: " + error);
      setIsLoading(false);
    }
  };

  const handleFileSelected = async (file: ModFile) => {
    if (!downloadContext) return;

    try {
      // Close file selection dialog
      setShowFileSelection(false);

      // Show download progress dialog
      setDownloadingFileName(file.fileName);
      setShowDownloadProgress(true);

      // Download the file
      const downloadedPath = await DownloadModUpdate(
        file.downloadUrl,
        file.fileName,
      );

      // Close download progress
      setShowDownloadProgress(false);

      // Store file info for cleanup later
      setCachedFilePath(downloadedPath);
      setCachedFileSize(file.fileSize);

      // Get ZIP structure
      setIsLoading(true);
      setLoadingMessage("Analizando archivo descargado...");

      const structure = await GetZipStructure(downloadedPath);
      if (!structure || structure.length === 0) {
        toast.error("El archivo descargado está vacío o corrupto");
        setIsLoading(false);
        return;
      }

      // Set up for ZIP modal
      setZipStructure(structure);
      setNewModPath(downloadedPath);
      setSelectedRoot("");

      setIsLoading(false);
      setShowZipModal(true);
    } catch (error) {
      console.error("Error downloading mod:", error);
      toast.error("Error al descargar: " + error);
      setShowDownloadProgress(false);
      setIsLoading(false);
    }
  };

  const handleCleanupDecision = async (shouldDelete: boolean) => {
    try {
      if (shouldDelete && cachedFilePath) {
        await CleanupCachedFile(cachedFilePath);
        toast.success("Archivo descargado eliminado");
      } else {
        toast.success("Archivo guardado en carpeta .cache");
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      toast.error("Error al limpiar archivo: " + error);
    } finally {
      setShowCleanupDialog(false);
      setCachedFilePath("");
      setCachedFileSize(0);
      setDownloadContext(null);
    }
  };

  const handleRemoveModClick = (character: string, modName: string) => {
    // character here is the folder name
    setModToDelete({ character, modName });
  };

  const handleMoveModClick = (character: string, modName: string) => {
    // character here is the folder name
    setModToMove({ character, modName });
  };

  const handleConfirmMoveMod = async (targetCharacter: string) => {
    if (!modToMove) return;

    const { character: sourceCharacter, modName } = modToMove;
    setIsLoading(true);
    setLoadingMessage(`Moviendo mod "${modName}" a ${targetCharacter}...`);

    try {
      await MoveMod(sourceCharacter, modName, targetCharacter);

      // Reload mods for both source and target if we're viewing either
      const currentFolder = selectedSkin
        ? selectedSkin.folder
        : selectedCharacter;
      if (
        currentFolder === sourceCharacter ||
        currentFolder === targetCharacter
      ) {
        await loadCharacterMods(currentFolder);
      }

      await loadCharacters();
      toast.success(
        `Mod "${modName}" movido correctamente a ${targetCharacter}`,
      );
      setModToMove(null);
    } catch (error) {
      console.error("Error moving mod:", error);
      toast.error("Error al mover el mod: " + (error as Error));
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
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
      await UpdateGameExecutable(selectedGame, executablePath);
      setIsAppConfigured(true);
      setShowConfig(false);

      const newConfig = { ...gamesConfig };
      if (!newConfig.games) newConfig.games = {};
      newConfig.games[selectedGame] = {
        modsPath: configPath,
        executablePath: executablePath,
      };
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

  const handleSelectExecutable = async () => {
    try {
      const selectedFile = await SelectExecutable();
      if (selectedFile) {
        setExecutablePath(selectedFile);
      }
    } catch (error) {
      console.error("Error selecting executable:", error);
      toast.error("Error al seleccionar el lanzador");
    }
  };

  const handleLaunchXXMI = async () => {
    if (!executablePath) {
      toast.error(
        "No se ha configurado el lanzador para este juego. Ve a configuración.",
      );
      setShowConfig(true);
      return;
    }

    try {
      await LaunchXXMI();
      toast.success("Lanzador iniciado");
    } catch (error) {
      console.error("Error launching XXMI:", error);
      toast.error("Error al iniciar el lanzador: " + error);
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

  // Find the currently selected character object to pass its skins
  const currentCharacterObj = characters.find(
    (c) => c.name === selectedCharacter,
  );

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
        onDownloadFromGameBanana={
          modToUpdate?.currentUrl ? handleDownloadFromGameBanana : undefined
        }
        onUpdateFromFile={handleUpdateFromFile}
        onUpdateFromFolder={handleUpdateFromFolder}
        onCancel={() => setModToUpdate(null)}
      />

      <MoveModDialog
        open={!!modToMove}
        onOpenChange={(open) => !open && setModToMove(null)}
        modName={modToMove?.modName || ""}
        currentCharacter={modToMove?.character || ""}
        characters={characters}
        onMove={handleConfirmMoveMod}
      />

      <ConfigScreen
        isAppConfigured={isAppConfigured}
        showConfig={showConfig}
        selectedGame={selectedGame}
        configPath={configPath}
        executablePath={executablePath}
        gamesConfig={gamesConfig}
        onClose={() => setShowConfig(false)}
        onGameSelect={(game) => {
          setSelectedGame(game);
          if (gamesConfig.games && gamesConfig.games[game]) {
            setConfigPath(gamesConfig.games[game].modsPath || "");
            setExecutablePath(gamesConfig.games[game].executablePath || "");
          } else {
            setConfigPath("");
            setExecutablePath("");
          }
        }}
        onConfigPathChange={setConfigPath}
        onExecutablePathChange={setExecutablePath}
        onSelectDirectory={handleSelectDirectory}
        onSelectExecutable={handleSelectExecutable}
        onSave={handleUpdateGamePath}
      />

      <AddModDialog
        isOpen={showAddMod}
        selectedCharacter={
          selectedSkin ? selectedSkin.folder : selectedCharacter
        }
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

      <FileSelectionDialog
        open={showFileSelection}
        files={availableFiles}
        onSelectFile={handleFileSelected}
        onCancel={() => {
          setShowFileSelection(false);
          setAvailableFiles([]);
        }}
      />

      <DownloadProgressDialog
        open={showDownloadProgress}
        fileName={downloadingFileName}
      />

      <CleanupDialog
        open={showCleanupDialog}
        fileName={downloadingFileName}
        fileSize={cachedFileSize}
        onDecision={handleCleanupDecision}
      />

      {/* Main Layout */}
      {!(!isAppConfigured || showConfig) && (
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
                  {executablePath && (
                    <Button
                      variant="default"
                      onClick={handleLaunchXXMI}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      Lanzar{" "}
                      {selectedGame === "genshin"
                        ? "GIMI"
                        : selectedGame === "wuwa"
                          ? "WWMI"
                          : selectedGame === "hsr"
                            ? "SRMI"
                            : selectedGame === "zzz"
                              ? "ZZMI"
                              : selectedGame === "endfield"
                                ? "EFMI"
                                : "Launcher"}
                    </Button>
                  )}
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
              selectedSkin={selectedSkin}
              skins={currentCharacterObj?.skins || []}
              mods={characterMods}
              updates={updates}
              onAddMod={() => setShowAddMod(true)}
              onToggleMod={handleToggleMod}
              onUpdateModClick={handleUpdateModClick}
              onOpenUrl={OpenUrl}
              onActivateSingle={handleActivateSingle}
              onOpenFolder={handleOpenModFolder}
              onRemoveMod={handleRemoveModClick}
              onSelectSkin={handleSkinSelect}
              onMoveMod={handleMoveModClick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
