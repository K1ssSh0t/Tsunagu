import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Folder, Download, RefreshCw } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { GameSelector } from "./game-selector";
import { UpdateCharactersDatabase } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";

interface UpdateResult {
    newCharacters: number;
    updatedCharacters: number;
    totalCharacters: number;
    errors?: string[];
}

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
    const [updating, setUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState("");
    const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);

    useEffect(() => {
        // Listen for progress updates from backend
        const unsubProgress = EventsOn("character-update-progress", (progress: string) => {
            setUpdateProgress(progress);
        });

        const unsubComplete = EventsOn("character-update-complete", (result: UpdateResult) => {
            setUpdating(false);
            setUpdateResult(result);
        });

        const unsubError = EventsOn("character-update-error", (error: string) => {
            setUpdating(false);
            alert(`Update failed: ${error}`);
        });

        return () => {
            unsubProgress();
            unsubComplete();
            unsubError();
        };
    }, []);

    const handleUpdateDatabase = async () => {
        setUpdating(true);
        setUpdateProgress("Starting update...");

        try {
            const result = await UpdateCharactersDatabase();
            setUpdateResult(result);
        } catch (error) {
            alert(`Update failed: ${error}`);
        } finally {
            setUpdating(false);
        }
    };

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

                        <div className="pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Base de Datos de Personajes</Label>
                                <p className="text-sm text-muted-foreground">
                                    Actualiza la lista de personajes desde hakush.in
                                </p>
                                <Button
                                    onClick={handleUpdateDatabase}
                                    disabled={updating}
                                    variant="outline"
                                    className="w-full"
                                >
                                    {updating ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Actualizando...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-4 w-4" />
                                            Actualizar Base de Datos
                                        </>
                                    )}
                                </Button>
                            </div>
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

            {/* Progress Dialog */}
            <Dialog open={updating} onOpenChange={() => {}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Actualizando Base de Datos</DialogTitle>
                        <DialogDescription>
                            Descargando información de personajes desde hakush.in...
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="text-sm text-gray-600 mb-4">{updateProgress}</div>
                        <div className="flex justify-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Result Dialog */}
            <Dialog open={updateResult !== null} onOpenChange={() => setUpdateResult(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Actualización Completa</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">✅</span>
                            <span>Nuevos personajes: <strong>{updateResult?.newCharacters || 0}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🔄</span>
                            <span>Personajes actualizados: <strong>{updateResult?.updatedCharacters || 0}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <span>Total de personajes: <strong>{updateResult?.totalCharacters || 0}</strong></span>
                        </div>

                        {updateResult?.errors && updateResult.errors.length > 0 && (
                            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <div className="font-semibold text-destructive mb-2">⚠️ Errores:</div>
                                {updateResult.errors.map((err, i) => (
                                    <div key={i} className="text-sm text-destructive/80">{err}</div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setUpdateResult(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
