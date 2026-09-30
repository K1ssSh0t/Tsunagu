import { Gamepad2, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
    ActivateSingleMod,
    AddMod,
    AddModFromZipWithRoot,
    CheckForUpdates,
    CleanupCachedFile,
    CleanupTempDirectory,
    DownloadModUpdate,
    GetCharacters,
    GetCurrentGame,
    GetGamesConfig,
    GetModDownloadFiles,
    GetModsForCharacter,
    GetZipStructure,
    IsConfigured,
    LaunchXXMI,
    MoveMod,
    OpenModFolder,
    OpenUrl,
    RemoveMod,
    RestoreModImage,
    SelectDirectory,
    SelectExecutable,
    SelectFile,
    SetGame,
    ToggleMod,
    UpdateGameExecutable,
    UpdateGamePath,
    UpdateMod,
    UpdateModFromZipWithRoot,
} from "../wailsjs/go/main/App";
import type { character, mod, utils } from "../wailsjs/go/models";
import { AddModDialog } from "./components/AddModDialog";
import { CleanupDialog } from "./components/CleanupDialog";
import { ConfigScreen } from "./components/ConfigScreen";
import { DeleteAlertDialog } from "./components/DeleteAlertDialog";
import { DownloadProgressDialog } from "./components/DownloadProgressDialog";
import {
    FileSelectionDialog,
    type ModFile,
} from "./components/FileSelectionDialog";
import { GameSelector } from "./components/game-selector";
// Refactored Components
import { LoadingOverlay } from "./components/LoadingOverlay";
import { ModList } from "./components/ModList";
import { MoveModDialog } from "./components/MoveModDialog";
import { ModeToggle } from "./components/mode-toggle";
import { Sidebar } from "./components/Sidebar";
import { UpdateModDialog } from "./components/UpdateModDialog";
import { ZipModal } from "./components/ZipModal";

type Character = character.Character & {
    skins?: { name: string; folder: string }[];
};
type Mod = mod.Mod;
type ZipFile = utils.ZipFile;

const GAME_LABELS: Record<string, string> = {
    genshin: "Genshin Impact",
    wuwa: "Wuthering Waves",
    hsr: "Honkai: Star Rail",
    zzz: "Zenless Zone Zero",
    endfield: "Arknights: Endfield",
};

const LAUNCHER_LABELS: Record<string, string> = {
    genshin: "GIMI",
    wuwa: "WWMI",
    hsr: "SRMI",
    zzz: "ZZMI",
    endfield: "EFMI",
};

const App: React.FC = () => {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedCharacter, setSelectedCharacter] = useState<string>("");
    const [selectedSkin, setSelectedSkin] = useState<{
        name: string;
        folder: string;
    } | null>(null);
    const [characterMods, setCharacterMods] = useState<Mod[]>([]);
    const [showConfig, setShowConfig] = useState(false);
    const [isAppConfigured, setIsAppConfigured] = useState<boolean | null>(
        null,
    );
    const [showAddMod, setShowAddMod] = useState(false);
    const [newModPath, setNewModPath] = useState("");
    const [newModName, setNewModName] = useState("");
    const [gameBananaUrl, setGameBananaUrl] = useState("");
    const [autoNameEnabled, setAutoNameEnabled] = useState(true);
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
    const [gamesConfig, setGamesConfig] = useState<{
        games?: Record<string, { modsPath?: string; executablePath?: string }>;
    }>({});

    // Download-related states
    const [showFileSelection, setShowFileSelection] = useState(false);
    const [availableFiles, setAvailableFiles] = useState<ModFile[]>([]);
    const [showDownloadProgress, setShowDownloadProgress] = useState(false);
    const [downloadingFileName, setDownloadingFileName] = useState("");
    const [showCleanupDialog, setShowCleanupDialog] = useState(false);
    const [cachedFilePath, setCachedFilePath] = useState("");
    const [cachedFileSize, setCachedFileSize] = useState(0);
    const [pendingMods, setPendingMods] = useState<Set<string>>(new Set());
    const [downloadContext, setDownloadContext] = useState<{
        character: string;
        modName: string;
    } | null>(null);

    const hasCheckedConfig = React.useRef(false);

    const deriveNameFromPath = (path: string, isZip: boolean): string => {
        const basename = path.replace(/[\\/]/g, "/").split("/").pop() || "";
        return isZip ? basename.replace(/\.(zip|rar|7z)$/i, "") : basename;
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe correr al montar
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

            if (config.games?.[game]) {
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
            if (config.games?.[game]) {
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

    const setModPending = (key: string, pending: boolean) => {
        setPendingMods((prev) => {
            const next = new Set(prev);
            if (pending) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const handleToggleMod = async (_character: string, modName: string) => {
        const targetFolder = selectedSkin
            ? selectedSkin.folder
            : selectedCharacter;
        if (!targetFolder) return;

        const key = `${targetFolder}::${modName}`;
        const previous = characterMods.find((m) => m.name === modName);
        const wasActive = previous?.isActive ?? false;

        setModPending(key, true);
        try {
            setCharacterMods((prev) =>
                prev.map((m) =>
                    m.name === modName
                        ? Object.assign(
                              Object.create(Object.getPrototypeOf(m)),
                              m,
                              { isActive: !wasActive },
                          )
                        : m,
                ),
            );
            await ToggleMod(targetFolder, modName);
            await loadCharacterMods(targetFolder);
            toast.success(
                `Mod ${modName} ${wasActive ? "desactivado" : "activado"} correctamente`,
            );
        } catch (error) {
            console.error("Error toggling mod:", error);
            await loadCharacterMods(targetFolder);
            toast.error("Error al cambiar el estado del mod");
        } finally {
            setModPending(key, false);
        }
    };

    const handleActivateSingle = async (
        _character: string,
        modName: string,
    ) => {
        const targetFolder = selectedSkin
            ? selectedSkin.folder
            : selectedCharacter;
        if (!targetFolder) return;

        const key = `${targetFolder}::${modName}`;
        setModPending(key, true);
        try {
            await ActivateSingleMod(targetFolder, modName);
            await loadCharacterMods(targetFolder);
            toast.success(`Mod ${modName} activado como único`);
        } catch (error) {
            console.error("Error activating mod:", error);
            toast.error("Error al activar el mod");
        } finally {
            setModPending(key, false);
        }
    };

    const handleAddMod = async () => {
        const targetFolder = selectedSkin
            ? selectedSkin.folder
            : selectedCharacter;

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
                        toast.error(
                            "El archivo ZIP no contiene archivos o está vacío",
                        );
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
                await AddMod(
                    targetFolder,
                    trimmedModName,
                    newModPath,
                    gameBananaUrl,
                );
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
            toast.error(`Error al agregar el mod: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const handleZipSelectRoot = (path: string) => {
        setSelectedRoot(path);
        if (autoNameEnabled) {
            const trimmedName =
                path === "."
                    ? deriveNameFromPath(newModPath, true)
                    : path.replace(/\\/g, "/").split("/").pop() || "";
            setNewModName(trimmedName);
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

        const targetFolder = selectedSkin
            ? selectedSkin.folder
            : selectedCharacter;
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
                toast.success(
                    `Mod ${modToUpdate.modName} actualizado correctamente`,
                );

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
            toast.error(`Error al procesar ZIP: ${error}`);
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

            toast.success(
                `Mod ${modToUpdate.modName} actualizado correctamente`,
            );

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
            toast.error(`Error al actualizar desde carpeta: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadFromGameBanana = async () => {
        if (!modToUpdate?.currentUrl) return;

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
            toast.error(`Error al obtener archivos: ${error}`);
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
            toast.error(`Error al descargar: ${error}`);
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
            toast.error(`Error al limpiar archivo: ${error}`);
        } finally {
            setShowCleanupDialog(false);
            setCachedFilePath("");
            setCachedFileSize(0);
            setDownloadingFileName("");
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
            toast.error(`Error al mover el mod: ${error as Error}`);
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

    const handleRestoreImage = async (
        character: string,
        modName: string,
        force: boolean,
    ) => {
        try {
            const restored = await RestoreModImage(character, modName, force);
            if (restored) {
                const currentFolder = selectedSkin
                    ? selectedSkin.folder
                    : selectedCharacter;
                if (
                    currentFolder &&
                    currentFolder.toLowerCase() === character.toLowerCase()
                ) {
                    await loadCharacterMods(currentFolder);
                }
                if (force) {
                    toast.success(`Imagen restaurada para ${modName}`);
                }
            } else if (force) {
                toast.info(
                    "No se restauró la imagen (ya existe o está en cooldown)",
                );
            }
            return restored;
        } catch (error) {
            console.error("Error restoring mod image:", error);
            if (force) {
                toast.error(
                    `Error al restaurar imagen: ${(error as Error).message}`,
                );
            }
            return false;
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
                if (autoNameEnabled) {
                    setNewModName(deriveNameFromPath(selectedPath, false));
                }
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
                if (autoNameEnabled) {
                    setNewModName(deriveNameFromPath(selectedFile, true));
                }
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
            toast.error(`Error al iniciar el lanzador: ${error}`);
        }
    };

    if (isAppConfigured === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Card className="w-[400px]">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Cargando...</CardTitle>
                        <CardDescription>
                            Inicializando aplicación
                        </CardDescription>
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

    const totalMods = characters.reduce(
        (acc, c) => acc + (c.mods ? c.mods.length : 0),
        0,
    );
    const totalActive = characters.reduce(
        (acc, c) =>
            acc + (c.mods ? c.mods.filter((m) => m.isActive).length : 0),
        0,
    );

    return (
        <div
            className="h-dvh overflow-hidden bg-background p-4 sm:p-6 relative flex flex-col"
            data-game={selectedGame}
        >
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
                    modToUpdate?.currentUrl
                        ? handleDownloadFromGameBanana
                        : undefined
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
                gamesConfig={gamesConfig.games}
                onClose={() => setShowConfig(false)}
                onGameSelect={(game) => {
                    setSelectedGame(game);
                    if (gamesConfig.games?.[game]) {
                        setConfigPath(gamesConfig.games[game].modsPath || "");
                        setExecutablePath(
                            gamesConfig.games[game].executablePath || "",
                        );
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
                autoNameEnabled={autoNameEnabled}
                onNameChange={setNewModName}
                onPathChange={setNewModPath}
                onUrlChange={setGameBananaUrl}
                onToggleAutoName={setAutoNameEnabled}
                onSelectFile={handleSelectModFile}
                onSelectFolder={handleSelectModDirectory}
                onCancel={() => setShowAddMod(false)}
                onConfirm={handleAddMod}
            />

            <ZipModal
                isOpen={showZipModal}
                zipStructure={zipStructure}
                selectedRoot={selectedRoot}
                onSelectRoot={handleZipSelectRoot}
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
                <div className="mx-auto flex min-h-0 w-full max-w-[1760px] flex-1 flex-col space-y-4">
                    {/* Header */}
                    <Card className="border-0 shadow-none bg-transparent shrink-0">
                        <CardHeader className="pb-4 px-1">
                            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end">
                                <div className="min-w-0">
                                    <p className="spec-label text-muted-foreground flex items-center gap-2 mb-2">
                                        <span
                                            aria-hidden="true"
                                            className="game-accent-dot h-2.5 w-2.5 rounded-[1px] flex-shrink-0"
                                        />
                                        Edición ·{" "}
                                        {GAME_LABELS[selectedGame] ||
                                            "Mod Manager"}{" "}
                                        — Catálogo Nº{" "}
                                        {String(characters.length).padStart(
                                            2,
                                            "0",
                                        )}
                                    </p>
                                    <CardTitle className="display-ink text-4xl sm:text-5xl">
                                        Tsunagu
                                    </CardTitle>
                                    <CardDescription className="mt-2 font-mono text-xs uppercase tracking-[0.08em] tabular-nums">
                                        {characters.length} personajes ·{" "}
                                        {totalMods} mods · {totalActive} activos
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {executablePath && (
                                        <Button
                                            variant="default"
                                            onClick={handleLaunchXXMI}
                                            className="bg-primary hover:bg-primary/90"
                                        >
                                            <Gamepad2 className="mr-2 h-4 w-4" />
                                            Lanzar{" "}
                                            {LAUNCHER_LABELS[selectedGame] ||
                                                "Launcher"}
                                        </Button>
                                    )}
                                    <GameSelector
                                        selectedGame={selectedGame}
                                        gamesConfig={gamesConfig.games}
                                        showStatus
                                        ariaLabel="Cambiar juego activo"
                                        onGameSelect={handleGameSelect}
                                    />

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setShowConfig(true)}
                                        title="Configuración"
                                        aria-label="Abrir configuración"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                    <ModeToggle />
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Main Content */}
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-4 md:overflow-visible">
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
                            pendingMods={pendingMods}
                            onAddMod={() => setShowAddMod(true)}
                            onToggleMod={handleToggleMod}
                            onUpdateModClick={handleUpdateModClick}
                            onOpenUrl={OpenUrl}
                            onActivateSingle={handleActivateSingle}
                            onOpenFolder={handleOpenModFolder}
                            onRemoveMod={handleRemoveModClick}
                            onSelectSkin={handleSkinSelect}
                            onMoveMod={handleMoveModClick}
                            onRestoreImage={handleRestoreImage}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
