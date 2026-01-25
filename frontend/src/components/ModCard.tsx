import React, { useState, useEffect } from "react";
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Globe, MoreVertical, ImageOff, X } from "lucide-react";
import { mod } from "../../wailsjs/go/models";
import { GetModImageBase64 } from "../../wailsjs/go/main/App";

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
    const [imageData, setImageData] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isImageExpanded, setIsImageExpanded] = useState(false);

    useEffect(() => {
        const loadImage = async () => {
            if (mod.imagePath) {
                setImageLoading(true);
                setImageError(false);
                try {
                    const base64 = await GetModImageBase64(mod.imagePath);
                    setImageData(base64);
                } catch (err) {
                    console.error("Failed to load mod image:", err);
                    setImageError(true);
                } finally {
                    setImageLoading(false);
                }
            } else {
                setImageData(null);
                setImageError(false);
            }
        };
        loadImage();
    }, [mod.imagePath]);

    return (
        <>
            <div className="group relative flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent/50 transition-all duration-200 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {/* Mod Cover Image */}
                    <div
                        className={`relative h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border ${imageData && !imageError ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all" : ""
                            }`}
                        onClick={() => {
                            if (imageData && !imageError) {
                                setIsImageExpanded(true);
                            }
                        }}
                    >
                        {imageLoading ? (
                            <div className="h-full w-full flex items-center justify-center">
                                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : imageData && !imageError ? (
                            <img
                                src={imageData}
                                alt={mod.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                <ImageOff className="h-6 w-6" />
                            </div>
                        )}
                        {/* Active indicator overlay */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 h-1 ${mod.isActive
                                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                : "bg-muted-foreground/30"
                                }`}
                        />
                    </div>

                    <div className="flex flex-col overflow-hidden flex-1">
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

            {/* Image Expand Dialog */}
            <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background/95 backdrop-blur-sm border-0">
                    <DialogTitle className="sr-only">{mod.name}</DialogTitle>
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
                            onClick={() => setIsImageExpanded(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        {imageData && (
                            <img
                                src={imageData}
                                alt={mod.name}
                                className="w-full h-auto max-h-[80vh] object-contain"
                            />
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                            <h3 className="font-semibold text-lg">{mod.name}</h3>
                            <p className="text-sm text-muted-foreground">
                                {mod.isActive ? "Habilitado" : "Deshabilitado"}
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
