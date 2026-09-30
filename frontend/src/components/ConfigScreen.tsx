import { Folder } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GameSelector } from "./game-selector";
import { ModeToggle } from "./mode-toggle";

interface ConfigScreenProps {
    isAppConfigured: boolean | null;
    showConfig: boolean;
    selectedGame: string;
    configPath: string;
    executablePath: string;
    gamesConfig?: Record<string, { modsPath?: string }>;
    onClose: () => void;
    onGameSelect: (game: string) => void;
    onConfigPathChange: (path: string) => void;
    onExecutablePathChange: (path: string) => void;
    onSelectDirectory: () => void;
    onSelectExecutable: () => void;
    onSave: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
    isAppConfigured,
    showConfig,
    selectedGame,
    configPath,
    executablePath,
    gamesConfig,
    onClose,
    onGameSelect,
    onConfigPathChange,
    onExecutablePathChange,
    onSelectDirectory,
    onSelectExecutable,
    onSave,
}) => {
    if (!(!isAppConfigured || showConfig)) return null;

    const trimmedPath = configPath.trim();
    const pathError = !trimmedPath
        ? "La ruta de mods es obligatoria."
        : trimmedPath.length < 4
          ? "Esa ruta parece incompleta. Usa Examinar para elegirla."
          : null;
    const canSave = !pathError;

    const gameLabel =
        selectedGame === "genshin"
            ? "Genshin Impact"
            : selectedGame === "wuwa"
              ? "Wuthering Waves"
              : selectedGame === "hsr"
                ? "Honkai: Star Rail"
                : selectedGame === "zzz"
                  ? "Zenless Zone Zero"
                  : "Arknights: Endfield";

    const launcherLabel =
        selectedGame === "genshin"
            ? "GIMI"
            : selectedGame === "wuwa"
              ? "WWMI"
              : selectedGame === "hsr"
                ? "SRMI"
                : selectedGame === "zzz"
                  ? "ZZMI"
                  : selectedGame === "endfield"
                    ? "EFMI"
                    : "Launcher";

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
                    <CardTitle className="display-ink text-2xl text-center">
                        Configuración
                    </CardTitle>
                    <CardDescription className="text-center">
                        Configura las rutas de mods y lanzadores para tus juegos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-center">
                                <GameSelector
                                    selectedGame={selectedGame}
                                    gamesConfig={gamesConfig}
                                    showStatus
                                    ariaLabel="Elegir juego a configurar"
                                    onGameSelect={(game) => {
                                        onGameSelect(game);
                                    }}
                                />
                            </div>
                            <p className="text-xs text-center text-muted-foreground">
                                Editas las rutas de este juego. No cambia el
                                juego activo hasta que guardes y vuelvas.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modsPath">
                                Ruta de mods para {gameLabel}:
                            </Label>
                            <div className="flex space-x-2">
                                <Input
                                    id="modsPath"
                                    type="text"
                                    autoComplete="off"
                                    aria-invalid={Boolean(pathError)}
                                    aria-describedby="modsPath-hint modsPath-error"
                                    value={configPath}
                                    onChange={(e) =>
                                        onConfigPathChange(e.target.value)
                                    }
                                    placeholder="Ej: C:\Juegos\...\Mods o /home/usuario/juegos/.../Mods"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    aria-label="Examinar carpeta de mods"
                                    onClick={onSelectDirectory}
                                    className="px-3"
                                >
                                    <Folder className="h-4 w-4" />
                                </Button>
                            </div>
                            <p
                                id="modsPath-hint"
                                className="text-sm text-muted-foreground"
                            >
                                Carpeta donde se encuentran los mods de{" "}
                                {gameLabel}. Debería contener una carpeta por
                                personaje.
                            </p>
                            {pathError && (
                                <p
                                    id="modsPath-error"
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {pathError}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="executablePath">
                                Lanzador de mods ({launcherLabel}) para{" "}
                                {gameLabel}:
                            </Label>
                            <div className="flex space-x-2">
                                <Input
                                    id="executablePath"
                                    type="text"
                                    autoComplete="off"
                                    aria-describedby="exePath-hint"
                                    value={executablePath}
                                    onChange={(e) =>
                                        onExecutablePathChange(e.target.value)
                                    }
                                    placeholder="Ej: C:\Lanzadores\...\GIMI.exe o /ruta/al/lanzador"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    aria-label="Examinar lanzador"
                                    onClick={onSelectExecutable}
                                    className="px-3"
                                >
                                    <Folder className="h-4 w-4" />
                                </Button>
                            </div>
                            <p
                                id="exePath-hint"
                                className="text-sm text-muted-foreground"
                            >
                                Archivo .exe o acceso directo (.lnk) del
                                lanzador. Opcional, pero sin él no verás el
                                botón Lanzar.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={onSave}
                        disabled={!canSave}
                        className="w-full"
                    >
                        Guardar Configuración
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
