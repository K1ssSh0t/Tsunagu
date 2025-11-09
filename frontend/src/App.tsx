import React, { useEffect, useState } from 'react';
import {
  GetCharacters,
  GetModsForCharacter,
  ToggleMod,
  ActivateSingleMod,
  AddMod,
  RemoveMod,
  IsConfigured,
  SaveConfig
} from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import { ModeToggle } from './components/mode-toggle';
import { Trash2 } from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

type Character = main.Character;
type Mod = main.Mod;

const App: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [characterMods, setCharacterMods] = useState<Mod[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isAppConfigured, setIsAppConfigured] = useState<boolean | null>(null);
  const [showAddMod, setShowAddMod] = useState(false);
  const [newModPath, setNewModPath] = useState('');
  const [newModName, setNewModName] = useState('');
  const [configPath, setConfigPath] = useState('');

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
      console.error('Error checking configuration:', error);
    }
  };

  const loadCharacters = async () => {
    try {
      const chars = await GetCharacters();
      setCharacters(chars);
    } catch (error) {
      console.error('Error loading characters:', error);
      toast.error('Error al cargar los personajes');
    }
  };

  const loadCharacterMods = async (characterName: string) => {
    try {
      const mods = await GetModsForCharacter(characterName);
      setCharacterMods(mods);
    } catch (error) {
      console.error('Error loading character mods:', error);
      toast.error('Error al cargar los mods del personaje');
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
      const mod = characterMods.find(m => m.name === modName);
      if (mod) {
        toast.success(`Mod ${modName} ${mod.isActive ? 'activado' : 'desactivado'} correctamente`);
      }
    } catch (error) {
      console.error('Error toggling mod:', error);
      toast.error('Error al cambiar el estado del mod');
    }
  };

  const handleActivateSingle = async (character: string, modName: string) => {
    try {
      await ActivateSingleMod(character, modName);
      await loadCharacterMods(character);
      await loadCharacters();
      toast.success(`Mod ${modName} activado como único`);
    } catch (error) {
      console.error('Error activating mod:', error);
      toast.error('Error al activar el mod');
    }
  };

  const handleAddMod = async () => {
    if (!selectedCharacter || !newModName || !newModPath) return;

    try {
      await AddMod(selectedCharacter, newModName, newModPath);
      setShowAddMod(false);
      setNewModName('');
      setNewModPath('');
      await loadCharacterMods(selectedCharacter);
      await loadCharacters();
      toast.success(`Mod ${newModName} agregado correctamente`);
    } catch (error) {
      console.error('Error adding mod:', error);
      toast.error('Error al agregar el mod');
    }
  };

  const handleRemoveMod = async (character: string, modName: string) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el mod "${modName}" de ${character}?`)) {
      try {
        await RemoveMod(character, modName);
        await loadCharacterMods(character);
        await loadCharacters();
        toast.success(`Mod ${modName} eliminado correctamente`);
      } catch (error) {
        console.error('Error removing mod:', error);
        toast.error('Error al eliminar el mod');
      }
    }
  };

  const handleSaveConfig = async () => {
    try {
      await SaveConfig(configPath);
      setIsAppConfigured(true);
      setShowConfig(false);
      await loadCharacters();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar la configuración');
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
            <CardTitle className="text-2xl text-center">Configuración Inicial</CardTitle>
            <CardDescription className="text-center">
              Configura la ruta de la carpeta de mods para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modsPath">Ruta de la carpeta 'mods' de 3DMigoto:</Label>
                <Input
                  id="modsPath"
                  type="text"
                  value={configPath}
                  onChange={(e) => setConfigPath(e.target.value)}
                  placeholder="Ej: C:\\Genshin Impact\\3DMigoto\\mods"
                  className="w-full"
                />
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
                <CardTitle className="text-3xl font-bold">Genshin Impact Mod Manager</CardTitle>
                <CardDescription>Administra tus mods de 3DMigoto</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <ModeToggle />
                <Button
                  variant="outline"
                  onClick={() => setShowConfig(true)}
                >
                  Configuración
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Character List */}
          <div className="lg:col-span-1">
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
                        variant={selectedCharacter === character.name ? 'secondary' : 'ghost'}
                        onClick={() => handleCharacterSelect(character.name)}
                        className={`w-full justify-between h-auto py-3 ${!character.hasFolder ? 'opacity-70' : ''}`}
                      // disabled={!character.hasFolder}
                      >
                        <span className="font-medium capitalize">{character.name}</span>
                        <div className="flex items-center space-x-2">
                          {!character.hasFolder && (
                            <Badge variant="outline" className="text-xs">
                              Sin carpeta
                            </Badge>
                          )}
                          <Badge variant={selectedCharacter === character.name ? 'default' : 'secondary'}>
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
                        {characters.find(c => c.name === selectedCharacter)?.hasFolder
                          ? `${characterMods.length} mods encontrados`
                          : 'La carpeta se creará al agregar el primer mod'
                        }
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
                        <CardTitle className="text-lg">Agregar Nuevo Mod</CardTitle>
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
                            <Label htmlFor="modPath">Ruta de los archivos</Label>
                            <Input
                              id="modPath"
                              type="text"
                              placeholder="Ruta completa del mod..."
                              value={newModPath}
                              onChange={(e) => setNewModPath(e.target.value)}
                            />
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

                  {/* Mods List */}
                  <div className="space-y-3">
                    {characterMods.length === 0 ? (
                      <Alert className="text-center">
                        <AlertTitle className="mb-2">
                          {characters.find(c => c.name === selectedCharacter)?.hasFolder
                            ? 'No hay mods para este personaje'
                            : 'Este personaje no tiene carpeta'}
                        </AlertTitle>
                        <AlertDescription>
                          {!characters.find(c => c.name === selectedCharacter)?.hasFolder && (
                            <p className="mb-2">Agrega un mod para crear la carpeta.</p>
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
                          className={`overflow-hidden ${mod.isActive ? 'border-green-200 dark:border-green-900' : ''
                            }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${mod.isActive ? 'bg-green-500' : 'bg-muted-foreground/50'
                                  }`} />
                                <div>
                                  <p className="font-medium">{mod.name}</p>
                                  <Badge
                                    variant={mod.isActive ? 'default' : 'outline'}
                                    className={`text-xs ${mod.isActive
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : ''
                                      }`}
                                  >
                                    {mod.isActive ? 'ACTIVO' : 'INACTIVO'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant={mod.isActive ? 'secondary' : 'default'}
                                  size="sm"
                                  onClick={() => handleToggleMod(mod.character, mod.name)}
                                  className="min-w-[100px]"
                                >
                                  {mod.isActive ? 'Desactivar' : 'Activar'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleActivateSingle(mod.character, mod.name)}
                                  className="hidden sm:inline-flex"
                                >
                                  Activar Único
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveMod(mod.character, mod.name)}
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
                  <Input
                    id="configPath"
                    type="text"
                    value={configPath}
                    onChange={(e) => setConfigPath(e.target.value)}
                    placeholder="Ej: C:\\Genshin Impact\\3DMigoto\\mods"
                  />
                  <p className="text-sm text-muted-foreground">
                    Esta es la carpeta donde se crearán las carpetas de personajes
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowConfig(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={!configPath}
              >
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