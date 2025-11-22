import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, MoreVertical } from "lucide-react";
import { mod } from "../../wailsjs/go/models";

interface ModCardProps {
    mod: mod.Mod;
    hasUpdate: boolean;
    updateInfo?: mod.ModUpdate;
    onToggle: (character: string, modName: string) => void;
    onUpdateClick: (character: string, modName: string, url: string) => void;
    onOpenUrl: (url: string) => void;
    onActivateSingle: (character: string, modName: string) => void;
    onOpenFolder: (path: string) => void;
    onRemove: (character: string, modName: string) => void;
}

export const ModCard: React.FC<ModCardProps> = ({
    mod,
    hasUpdate,
    updateInfo,
    onToggle,
    onUpdateClick,
    onOpenUrl,
    onActivateSingle,
    onOpenFolder,
    onRemove,
}) => {
    return (
        <div className="group relative flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all duration-200 shadow-sm hover:shadow-md">
            <div className="flex items-center gap-4 overflow-hidden">
                <div
                    className={`h-10 w-1 rounded-full ${mod.isActive
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                        : "bg-muted-foreground/30"
                        }`}
                />

                <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate text-base">{mod.name}</h3>
                        {hasUpdate && (
                            <Badge
                                variant="outline"
                                className="h-5 px-1.5 text-[10px] border-green-500/50 text-green-500 bg-green-500/10 animate-pulse cursor-pointer hover:bg-green-500/20"
                                onClick={() =>
                                    onUpdateClick(mod.character, mod.name, updateInfo?.modUrl || "")
                                }
                            >
                                Update
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                        {mod.isActive ? "Habilitado" : "Deshabilitado"}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {(mod as any).gameBananaUrl && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Ver en GameBanana"
                        onClick={() => onOpenUrl((mod as any).gameBananaUrl)}
                    >
                        <Globe className="h-4 w-4" />
                    </Button>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => onActivateSingle(mod.character, mod.name)}
                        >
                            Activar Solo Este
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOpenFolder(mod.fullPath)}>
                            Abrir Carpeta
                        </DropdownMenuItem>
                        {hasUpdate && (
                            <DropdownMenuItem
                                onClick={() =>
                                    onUpdateClick(mod.character, mod.name, updateInfo?.modUrl || "")
                                }
                            >
                                Actualizar Mod
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => onRemove(mod.character, mod.name)}
                        >
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="pl-2 border-l ml-1">
                    <Switch
                        checked={mod.isActive}
                        onCheckedChange={() => onToggle(mod.character, mod.name)}
                    />
                </div>
            </div>
        </div>
    );
};
