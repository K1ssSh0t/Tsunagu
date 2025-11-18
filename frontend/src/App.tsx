import React, { useState, useEffect, useCallback } from "react";
import {
  GetCharacters,
  GetModsForCharacter,
  ToggleMod,
  ActivateSingleMod,
  AddMod,
  AddModFromZip,
  AddModFromZipWithRoot,
  CleanupTempDirectory,
  GetZipStructure,
  RemoveMod,
  OpenModFolder,
  IsConfigured,
  SaveConfig,
  SelectDirectory,
  SelectFile,
} from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { ModeToggle } from "./components/mode-toggle";
import { Trash2, Folder, File, ChevronRight, ChevronDown } from "lucide-react";

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
  const [configPath, setConfigPath] = useState("");
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipStructure, setZipStructure] = useState<ZipFile[]>([]);
  const [selectedRoot, setSelectedRoot] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const configured = await IsConfigured();
      setIsAppConfigured(configured);
      if (configured) {
        loadCharacters();
      }
    } catch (error) {
      console.error("Error checking configuration:", error);
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
      toast.error("Error al cargar los mods del personaje");
      setCharacterMods([]);
    }
  };

  const handleCharacterSelect = async (characterName: string) => {
    setSelectedCharacter(characterName);
    await loadCharacterMods(characterName);
  };

  const handleToggleMod = async (character: string, modName: string) => {
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
    }
  };

  const handleActivateSingle = async (character: string, modName: string) => {
    try {
      await ActivateSingleMod(character, modName);
      await loadCharacterMods(character);
      await loadCharacters();
      toast.success(`Mod ${modName} activado como único`);
    } catch (error) {
      console.error("Error activating mod:", error);
      toast.error("Error al activar el mod");
    }
  };

  const handleAddMod = async () => {
    if (!selectedCharacter || !newModName || !newModPath) return;

    try {
      // Check if the path is a ZIP file
      if (newModPath.toLowerCase().endsWith(".zip")) {
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
        await AddMod(selectedCharacter, newModName, newModPath);
        setShowAddMod(false);
        setNewModName("");
        setNewModPath("");
        await loadCharacterMods(selectedCharacter);
        await loadCharacters();
        toast.success(`Mod ${newModName} agregado correctamente`);
      }
    } catch (error) {
      console.error("Error adding mod:", error);
      toast.error("Error al agregar el mod: " + (error as Error).message);
    }
  };

  const handleZipModalConfirm = async () => {
    if (!selectedRoot) {
      toast.error("Por favor selecciona una carpeta raíz");
      return;
    }

    try {
      await AddModFromZipWithRoot(
        selectedCharacter,
        newModName,
        newModPath,
        selectedRoot,
      );
      setShowZipModal(false);
      setShowAddMod(false);
      setNewModName("");
      setNewModPath("");
      setSelectedRoot("");
      setZipStructure([]);
      setExpandedFolders(new Set());
      await loadCharacterMods(selectedCharacter);
      await loadCharacters();
      toast.success(`Mod ${newModName} agregado correctamente`);
    } catch (error) {
      console.error("Error adding mod from ZIP:", error);
      toast.error("Error al agregar el mod desde ZIP: " + error);
    }
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
              className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                selectedRoot === file.path ? "bg-blue-100 dark:bg-blue-900" : ""
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

  const handleRemoveMod = async (character: string, modName: string) => {
    if (
      confirm(
        `¿Estás seguro de que quieres eliminar el mod "${modName}" de ${character}?`,
      )
    ) {
      try {
        await RemoveMod(character, modName);
        await loadCharacterMods(character);
        await loadCharacters();
        toast.success(`Mod ${modName} eliminado correctamente`);
      } catch (error) {
        console.error("Error removing mod:", error);
        toast.error("Error al eliminar el mod");
      }
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
    <div className="min-h-screen bg-background p-6">
      <Toaster position="top-center" richColors closeButton />
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

                <CardContent className="pt-4">
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
                              onChange={(e) => setNewModName(e.target.value)}
                            />
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
                                className="flex-1"
                              />
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

                  {/* Mods List */}
                  <div className="space-y-3">
                    {characterMods.length === 0 ? (
                      <Alert className="text-center">
                        <AlertTitle className="mb-2">
                          {characters.find((c) => c.name === selectedCharacter)
                            ?.hasFolder
                            ? "No hay mods para este personaje"
                            : "Este personaje no tiene carpeta"}
                        </AlertTitle>
                        <AlertDescription>
                          {!characters.find((c) => c.name === selectedCharacter)
                            ?.hasFolder && (
                            <p className="mb-2">
                              Agrega un mod para crear la carpeta.
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddMod(true)}
                          >
                            Agregar el primer mod
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      characterMods.map((mod) => (
                        <Card
                          key={mod.id}
                          className={`overflow-hidden ${
                            mod.isActive
                              ? "border-green-200 dark:border-green-900"
                              : ""
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    mod.isActive
                                      ? "bg-green-500"
                                      : "bg-muted-foreground/50"
                                  }`}
                                />
                                <div>
                                  <p className="font-medium">{mod.name}</p>
                                  <Badge
                                    variant={
                                      mod.isActive ? "default" : "outline"
                                    }
                                    className={`text-xs ${
                                      mod.isActive
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                        : ""
                                    }`}
                                  >
                                    {mod.isActive ? "ACTIVO" : "INACTIVO"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleOpenModFolder(mod.fullPath)
                                  }
                                >
                                  Abrir Carpeta
                                </Button>
                                <Button
                                  variant={
                                    mod.isActive ? "secondary" : "default"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    handleToggleMod(mod.character, mod.name)
                                  }
                                  className="min-w-[100px]"
                                >
                                  {mod.isActive ? "Desactivar" : "Activar"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleActivateSingle(
                                      mod.character,
                                      mod.name,
                                    )
                                  }
                                  className="hidden sm:inline-flex"
                                >
                                  Activar Único
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    handleRemoveMod(mod.character, mod.name)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
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
      </div>

      {/* Configuration Modal */}
      {showConfig && (
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
      )}
    </div>
  );
};

export default App;
