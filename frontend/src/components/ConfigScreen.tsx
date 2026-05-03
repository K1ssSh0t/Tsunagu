import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  executablePath: string;
  gamesConfig: any;
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
          <CardTitle className="text-2xl text-center">Configuración</CardTitle>
          <CardDescription className="text-center">
            Configura las rutas de mods y lanzadores para tus juegos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex justify-center">
              <GameSelector
                selectedGame={selectedGame}
                onGameSelect={(game) => {
                  onGameSelect(game);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modsPath">Ruta de mods para {gameLabel}:</Label>
              <div className="flex space-x-2">
                <Input
                  id="modsPath"
                  type="text"
                  value={configPath}
                  onChange={(e) => onConfigPathChange(e.target.value)}
                  placeholder="Ej: C:\\Juegos\\Genshin Impact\\3DMigoto\\mods"
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
                Carpeta donde se encuentran los mods de {gameLabel}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="executablePath">
                Lanzador de mods ({launcherLabel}) para {gameLabel}:
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="executablePath"
                  type="text"
                  value={executablePath}
                  onChange={(e) => onExecutablePathChange(e.target.value)}
                  placeholder="Ej: C:\\Lanzadores\\3DMigoto\\3DMigoto.exe"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSelectExecutable}
                  className="px-3"
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Archivo .exe o acceso directo (.lnk) del lanzador.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onSave} disabled={!configPath} className="w-full">
            Guardar Configuración
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
