import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Folder } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { GameSelector } from "./game-selector";

interface ConfigScreenProps {
    isAppConfigured: boolean | null;
    showConfig: boolean;
    selectedGame: string;
    configPath: string;
    gamesConfig: any;
    onClose: () => void;
    onGameSelect: (game: string) => void;
    onConfigPathChange: (path: string) => void;
    onSelectDirectory: () => void;
    onSave: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
    isAppConfigured,
    showConfig,
    selectedGame,
    configPath,
    gamesConfig,
    onClose,
    onGameSelect,
    onConfigPathChange,
    onSelectDirectory,
    onSave,
}) => {
    if (!(!isAppConfigured || showConfig)) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="absolute top-4 right-4 flex gap-2">
                {isAppConfigured && (
                    <Button variant="ghost" onClick={onClose}>
                        Cerrar
                    </Button>
                )}
                <ModeToggle />
            </div>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Configuración</CardTitle>
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
                                    onGameSelect(game);
                                    // Logic for updating path handled in parent or here?
                                    // Parent handles it via onGameSelect usually, but here we need to update the input
                                    // The parent should update the configPath state when game changes
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modsPath">
                                Ruta de mods para{" "}
                                {selectedGame === "genshin"
                                    ? "Genshin Impact"
                                    : selectedGame === "wuwa"
                                        ? "Wuthering Waves"
                                        : selectedGame === "hsr"
                                            ? "Honkai: Star Rail"
                                            : "Zenless Zone Zero"}
                                :
                            </Label>
                            <div className="flex space-x-2">
                                <Input
                                    id="modsPath"
                                    type="text"
                                    value={configPath}
                                    onChange={(e) => onConfigPathChange(e.target.value)}
                                    placeholder="Ej: C:\\Genshin Impact\\3DMigoto\\mods"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onSelectDirectory}
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
                        onClick={onSave}
                        disabled={!configPath}
                        className="w-full"
                    >
                        Guardar Configuración
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
