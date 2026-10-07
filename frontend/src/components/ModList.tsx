import { Folder, Gamepad2 } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { mod } from "../../wailsjs/go/models";
import { ModCard } from "./ModCard";

interface ModListProps {
    selectedCharacter: string;
    selectedSkin: { name: string; folder: string } | null;
    skins: { name: string; folder: string }[];
    mods: mod.Mod[];
    updates: mod.ModUpdate[];
    pendingMods?: Set<string>;
    onAddMod: () => void;
    onToggleMod: (character: string, modName: string) => void;
    onUpdateModClick: (character: string, modName: string, url: string) => void;
    onOpenUrl: (url: string) => void;
    onActivateSingle: (character: string, modName: string) => void;
    onOpenFolder: (path: string) => void;
    onRemoveMod: (character: string, modName: string) => void;
    onSelectSkin: (skin: { name: string; folder: string } | null) => void;
    onMoveMod: (character: string, modName: string) => void;
    onRestoreImage: (
        character: string,
        modName: string,
        force: boolean,
    ) => Promise<boolean>;
}

export const ModList: React.FC<ModListProps> = ({
    selectedCharacter,
    selectedSkin,
    skins,
    mods,
    updates,
    pendingMods,
    onAddMod,
    onToggleMod,
    onUpdateModClick,
    onOpenUrl,
    onActivateSingle,
    onOpenFolder,
    onRemoveMod,
    onSelectSkin,
    onMoveMod,
    onRestoreImage,
}) => {
    const activeCount = mods.filter((m) => m.isActive).length;
    // Same canonical key as App's targetFolder: skin folder when a skin is
    // selected, otherwise the character. Never key on mod.character, which
    // may not match the folder the backend toggled.
    const pendingCtx = selectedSkin ? selectedSkin.folder : selectedCharacter;
    const pendingKey = (name: string) => `${pendingCtx}::${name}`;
    return (
        <Card className="md:col-span-3 h-auto md:h-full md:min-h-0 flex flex-col min-h-0">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
                    <div className="min-w-0">
                        {selectedCharacter && (
                            <p className="spec-label text-muted-foreground mb-1">
                                Grupo de plates ·{" "}
                                {selectedSkin ? selectedSkin.name : "Base"}
                            </p>
                        )}
                        <CardTitle className="display-ink text-2xl capitalize">
                            {selectedCharacter || "Selecciona un personaje"}
                        </CardTitle>
                        <CardDescription className="capitalize font-mono text-xs tabular-nums">
                            {selectedCharacter
                                ? mods.length > 0
                                    ? `${activeCount}/${mods.length} activos`
                                    : "Sin mods registrados"
                                : "Selecciona un personaje para ver sus mods"}
                        </CardDescription>
                    </div>
                    {selectedCharacter && (
                        <Button onClick={onAddMod}>Agregar Mod</Button>
                    )}
                </div>

                {selectedCharacter && skins && skins.length > 0 && (
                    <div
                        className="flex gap-2 overflow-x-auto pb-2"
                        role="tablist"
                        aria-label="Skins del personaje"
                    >
                        <Button
                            variant={!selectedSkin ? "default" : "outline"}
                            size="sm"
                            role="tab"
                            aria-selected={!selectedSkin}
                            onClick={() => onSelectSkin(null)}
                            className="whitespace-nowrap"
                        >
                            Base
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
                                role="tab"
                                aria-selected={selectedSkin?.name === skin.name}
                                onClick={() => onSelectSkin(skin)}
                                className="whitespace-nowrap"
                            >
                                {skin.name}
                            </Button>
                        ))}
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden min-h-0 p-4 bg-muted/20">
                {!selectedCharacter ? (
                    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                        <Gamepad2
                            className="h-16 w-16 mb-2 opacity-20"
                            aria-hidden="true"
                        />
                        <p className="font-medium text-foreground">
                            Selecciona un personaje de la lista
                        </p>
                        <p className="text-sm max-w-[32ch]">
                            Tus mods aparecerán aquí con su vista previa y
                            estado.
                        </p>
                    </div>
                ) : mods.length === 0 ? (
                    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                        <Folder
                            className="h-16 w-16 mb-2 opacity-20"
                            aria-hidden="true"
                        />
                        <p className="font-medium text-foreground">
                            No hay mods instalados para{" "}
                            {selectedSkin
                                ? `la skin ${selectedSkin.name}`
                                : "este personaje"}
                        </p>
                        <p className="text-sm max-w-[36ch]">
                            Agrega tu primer mod desde un ZIP o carpeta. Te
                            pediremos la carpeta con el .ini.
                        </p>
                        <Button
                            variant="link"
                            onClick={onAddMod}
                            className="mt-2"
                        >
                            Agregar el primer mod
                        </Button>
                    </div>
                ) : (
                    <ScrollArea className="h-full pr-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 auto-rows-auto items-start [&>*]:min-w-0 [&>*]:min-h-0">
                            {mods.map((mod, index) => {
                                const hasUpdate = updates.some(
                                    (u) =>
                                        u.characterName.toLowerCase() ===
                                            mod.character.toLowerCase() &&
                                        u.modName.toLowerCase() ===
                                            mod.name.toLowerCase(),
                                );
                                const updateInfo = updates.find(
                                    (u) =>
                                        u.characterName.toLowerCase() ===
                                            mod.character.toLowerCase() &&
                                        u.modName.toLowerCase() ===
                                            mod.name.toLowerCase(),
                                );

                                return (
                                    <ModCard
                                        key={mod.id}
                                        mod={mod}
                                        hasUpdate={hasUpdate}
                                        updateInfo={updateInfo}
                                        plateNo={String(index + 1).padStart(
                                            2,
                                            "0",
                                        )}
                                        pending={pendingMods?.has(
                                            pendingKey(mod.name),
                                        )}
                                        onToggle={onToggleMod}
                                        onUpdateClick={onUpdateModClick}
                                        onOpenUrl={onOpenUrl}
                                        onActivateSingle={onActivateSingle}
                                        onOpenFolder={onOpenFolder}
                                        onRemove={onRemoveMod}
                                        onMove={onMoveMod}
                                        onRestoreImage={onRestoreImage}
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
