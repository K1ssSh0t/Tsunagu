import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Globe,
    ImageOff,
    Keyboard,
    MoreVertical,
    MoveRight,
    X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { GetModImageBase64 } from "../../wailsjs/go/main/App";
import type { mod } from "../../wailsjs/go/models";

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
    onMove: (character: string, modName: string) => void;
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
    onMove,
}) => {
    const [imageData, setImageData] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [isKeySwapsExpanded, setIsKeySwapsExpanded] = useState(false);

    const hasKeySwaps = mod.keySwaps && mod.keySwaps.length > 0;

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
            <div className="flex flex-col">
                <div className="group relative flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent/50 transition-all duration-200 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                        {/* Mod Cover Image */}
                        <div
                            className={`relative h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border ${
                                imageData && !imageError
                                    ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    : ""
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
                                className={`absolute bottom-0 left-0 right-0 h-1 ${
                                    mod.isActive
                                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                        : "bg-muted-foreground/30"
                                }`}
                            />
                        </div>

                        <div className="flex flex-col overflow-hidden flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate text-base">
                                    {mod.name}
                                </h3>
                                {hasUpdate && (
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-1.5 text-[10px] border-green-500/50 text-green-500 bg-green-500/10 animate-pulse cursor-pointer hover:bg-green-500/20"
                                        onClick={() =>
                                            onUpdateClick(
                                                mod.character,
                                                mod.name,
                                                updateInfo?.modUrl || "",
                                            )
                                        }
                                    >
                                        Update
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground truncate">
                                    {mod.isActive
                                        ? "Habilitado"
                                        : "Deshabilitado"}
                                </p>
                                {hasKeySwaps && (
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-1.5 text-[10px] border-blue-500/50 text-blue-500 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 flex-shrink-0"
                                        onClick={() =>
                                            setIsKeySwapsExpanded(
                                                !isKeySwapsExpanded,
                                            )
                                        }
                                    >
                                        <Keyboard className="h-3 w-3 mr-1" />
                                        {mod.keySwaps.length}{" "}
                                        {mod.keySwaps.length === 1
                                            ? "Key"
                                            : "Keys"}
                                        {isKeySwapsExpanded ? (
                                            <ChevronUp className="h-3 w-3 ml-1" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3 ml-1" />
                                        )}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(mod as any).gameBananaUrl && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Ver en GameBanana"
                                onClick={() =>
                                    onOpenUrl((mod as any).gameBananaUrl)
                                }
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
                                    onClick={() =>
                                        onActivateSingle(
                                            mod.character,
                                            mod.name,
                                        )
                                    }
                                >
                                    Activar Solo Este
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onOpenFolder(mod.fullPath)}
                                >
                                    Abrir Carpeta
                                </DropdownMenuItem>
                                {hasUpdate && (
                                    <DropdownMenuItem
                                        onClick={() =>
                                            onUpdateClick(
                                                mod.character,
                                                mod.name,
                                                updateInfo?.modUrl || "",
                                            )
                                        }
                                    >
                                        Actualizar Mod
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() =>
                                        onMove(mod.character, mod.name)
                                    }
                                >
                                    <MoveRight className="mr-2 h-4 w-4" />
                                    Mover a...
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() =>
                                        onRemove(mod.character, mod.name)
                                    }
                                >
                                    Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="pl-2 border-l ml-1">
                            <Switch
                                checked={mod.isActive}
                                onCheckedChange={() =>
                                    onToggle(mod.character, mod.name)
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* KeySwaps Expandable Panel */}
                {hasKeySwaps && isKeySwapsExpanded && (
                    <div className="mt-1 mx-2 p-3 rounded-lg border bg-muted/30 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Keyboard className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs font-medium text-muted-foreground">
                                Atajos de teclado en el juego
                            </span>
                        </div>
                        {mod.keySwaps.map((swap, index) => {
                            // Display name: strip "KeySwap" or "Key" prefix to get the descriptive part
                            const displayName =
                                swap.sectionName
                                    .replace(/^KeySwap/i, "")
                                    .replace(/^Key/i, "")
                                    .trim() || swap.sectionName;

                            return (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-background/60 border border-border/50"
                                >
                                    <div className="flex flex-col min-w-0 flex-shrink-0 max-w-[130px]">
                                        <span
                                            className="text-xs font-medium text-muted-foreground truncate"
                                            title={swap.sectionName}
                                        >
                                            {displayName}
                                        </span>
                                        {swap.condition && (
                                            <span
                                                className="text-[10px] text-muted-foreground/60 truncate"
                                                title={swap.condition}
                                            >
                                                {swap.condition}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                        {swap.forwardKey && (
                                            <div
                                                className="flex items-center gap-1"
                                                title="Forward Key"
                                            >
                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded border border-border shadow-sm">
                                                    {swap.forwardKey}
                                                </kbd>
                                            </div>
                                        )}
                                        {swap.backwardKey && (
                                            <div
                                                className="flex items-center gap-1"
                                                title="Backward Key"
                                            >
                                                <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                                                <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded border border-border shadow-sm">
                                                    {swap.backwardKey}
                                                </kbd>
                                            </div>
                                        )}
                                        {swap.variants > 0 && (
                                            <Badge
                                                variant="secondary"
                                                className="h-4 px-1 text-[10px]"
                                                title={
                                                    swap.variableName
                                                        ? `${swap.variableName} = ${swap.variants} variantes`
                                                        : undefined
                                                }
                                            >
                                                {swap.variants} var
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
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
                            <h3 className="font-semibold text-lg">
                                {mod.name}
                            </h3>
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
