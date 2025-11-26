import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, Gamepad2 } from "lucide-react";
import { ModCard } from "./ModCard";
import { mod } from "../../wailsjs/go/models";

interface ModListProps {
    selectedCharacter: string;
    selectedSkin: { name: string; folder: string } | null;
    skins: { name: string; folder: string }[];
    mods: mod.Mod[];
    updates: mod.ModUpdate[];
    onAddMod: () => void;
    onToggleMod: (character: string, modName: string) => void;
    onUpdateModClick: (character: string, modName: string, url: string) => void;
    onOpenUrl: (url: string) => void;
    onActivateSingle: (character: string, modName: string) => void;
    onOpenFolder: (path: string) => void;
    onRemoveMod: (character: string, modName: string) => void;
    onSelectSkin: (skin: { name: string; folder: string } | null) => void;
}

export const ModList: React.FC<ModListProps> = ({
    selectedCharacter,
    selectedSkin,
    skins,
    mods,
    updates,
    onAddMod,
    onToggleMod,
    onUpdateModClick,
    onOpenUrl,
    onActivateSingle,
    onOpenFolder,
    onRemoveMod,
    onSelectSkin,
}) => {
    return (
        <Card className="md:col-span-3 h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex flex-row justify-between items-center mb-4">
                    <div>
                        <CardTitle className="text-xl capitalize">
                            {selectedCharacter || "Selecciona un personaje"}
                        </CardTitle>
                        <CardDescription className="capitalize">
                            {selectedCharacter
                                ? `Gestionando mods para ${selectedCharacter}`
                                : "Selecciona un personaje para ver sus mods"}
                        </CardDescription>
                    </div>
                    {selectedCharacter && (
                        <Button onClick={onAddMod}>Agregar Mod</Button>
                    )}
                </div>

                {selectedCharacter && skins && skins.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <Button
                            variant={!selectedSkin ? "default" : "outline"}
                            size="sm"
                            onClick={() => onSelectSkin(null)}
                            className="whitespace-nowrap"
                        >
                            Default
                        </Button>
                        {skins.map((skin) => (
                            <Button
                                key={skin.name}
                                variant={
                                    selectedSkin?.name === skin.name
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                onClick={() => onSelectSkin(skin)}
                                className="whitespace-nowrap"
                            >
                                {skin.name}
                            </Button>
                        ))}
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 bg-muted/20">
                {!selectedCharacter ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Gamepad2 className="h-16 w-16 mb-4 opacity-20" />
                        <p>Selecciona un personaje de la lista</p>
                    </div>
                ) : mods.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Folder className="h-16 w-16 mb-4 opacity-20" />
                        <p>No hay mods instalados para {selectedSkin ? `la skin ${selectedSkin.name}` : "este personaje"}</p>
                        <Button variant="link" onClick={onAddMod} className="mt-2">
                            Agregar el primer mod
                        </Button>
                    </div>
                ) : (
                    <ScrollArea className="h-full pr-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {mods.map((mod) => {
                                const hasUpdate = updates.some(
                                    (u) =>
                                        u.characterName === mod.character && u.modName === mod.name
                                );
                                const updateInfo = updates.find(
                                    (u) =>
                                        u.characterName === mod.character && u.modName === mod.name
                                );

                                return (
                                    <ModCard
                                        key={mod.id}
                                        mod={mod}
                                        hasUpdate={hasUpdate}
                                        updateInfo={updateInfo}
                                        onToggle={onToggleMod}
                                        onUpdateClick={onUpdateModClick}
                                        onOpenUrl={onOpenUrl}
                                        onActivateSingle={onActivateSingle}
                                        onOpenFolder={onOpenFolder}
                                        onRemove={onRemoveMod}
                                    />
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
};
