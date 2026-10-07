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
    Zap,
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
    plateNo?: string;
    pending?: boolean;
    onToggle: (character: string, modName: string) => void;
    onUpdateClick: (character: string, modName: string, url: string) => void;
    onOpenUrl: (url: string) => void;
    onActivateSingle: (character: string, modName: string) => void;
    onOpenFolder: (path: string) => void;
    onRemove: (character: string, modName: string) => void;
    onMove: (character: string, modName: string) => void;
    onRestoreImage: (
        character: string,
        modName: string,
        force: boolean,
    ) => Promise<boolean>;
}

export const ModCard: React.FC<ModCardProps> = ({
    mod,
    hasUpdate,
    updateInfo,
    plateNo,
    pending = false,
    onToggle,
    onUpdateClick,
    onOpenUrl,
    onActivateSingle,
    onOpenFolder,
    onRemove,
    onMove,
    onRestoreImage,
}) => {
    const [imageData, setImageData] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [isKeySwapsExpanded, setIsKeySwapsExpanded] = useState(false);
    const [imageRestoring, setImageRestoring] = useState(false);

    const hasKeySwaps = mod.keySwaps && mod.keySwaps.length > 0;

    // biome-ignore lint/correctness/useExhaustiveDependencies: onRestoreImage es wrapper estable del backend; añadirlo recargaría imágenes en cada render
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
                    if (mod.gameBananaUrl) {
                        try {
                            setImageRestoring(true);
                            const restored = await onRestoreImage(
                                mod.character,
                                mod.name,
                                false,
                            );
                            if (restored) {
                                setImageData(null);
                                setImageError(false);
                                return;
                            }
                        } catch (restoreError) {
                            console.error(
                                "Failed to auto-restore mod image:",
                                restoreError,
                            );
                        } finally {
                            setImageRestoring(false);
                        }
                    }
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
    }, [mod.imagePath, mod.gameBananaUrl, mod.character, mod.name]);

    return (
        <>
            <div className="flex flex-col h-auto min-w-0">
                <div className="group relative flex items-center justify-between gap-2 p-3 rounded-[3px] border bg-card hover:bg-accent/50 hover:border-foreground/30 focus-within:bg-accent/50 focus-within:border-foreground/30 transition-colors duration-200 min-h-[108px] w-full">
                    <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        {/* Mod Cover Image */}
                        <button
                            type="button"
                            aria-label={`Ampliar imagen de ${mod.name}`}
                            className={`relative h-20 w-20 rounded-[2px] overflow-hidden bg-muted flex-shrink-0 border ${
                                imageData && !imageError
                                    ? "cursor-pointer hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring transition-all"
                                    : ""
                            }`}
                            onClick={() => {
                                if (imageData && !imageError) {
                                    setIsImageExpanded(true);
                                }
                            }}
                        >
                            {imageLoading || imageRestoring ? (
                                <div className="h-full w-full flex items-center justify-center">
                                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : imageData && !imageError ? (
                                <img
                                    src={imageData}
                                    alt={`Vista previa de ${mod.name}`}
                                    loading="lazy"
                                    draggable={false}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                    <ImageOff className="h-6 w-6" />
                                </div>
                            )}
                            {/* Active indicator bar */}
                            <div
                                className={`absolute bottom-0 left-0 right-0 h-1 ${
                                    mod.isActive
                                        ? "bg-green-600 dark:bg-green-400"
                                        : "bg-muted-foreground/30"
                                }`}
                            />
                        </button>

                        <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                            <div className="flex items-start gap-2 min-w-0">
                                {plateNo && (
                                    <span
                                        aria-hidden="true"
                                        className="font-mono text-[10px] text-muted-foreground tabular-nums flex-shrink-0 pt-[3px]"
                                    >
                                        Nº {plateNo}
                                    </span>
                                )}
                                <h3
                                    title={mod.name}
                                    className="flex-1 min-w-0 font-bold tracking-tight text-[15px] leading-[1.25] line-clamp-2 [text-wrap:pretty] break-words min-h-[2.5rem]"
                                >
                                    {mod.name}
                                </h3>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 h-5 mt-1 overflow-hidden">
                                <p
                                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground truncate flex-1 min-w-0"
                                    role="status"
                                >
                                    {pending
                                        ? "Actualizando…"
                                        : mod.isActive
                                          ? "Habilitado"
                                          : "Deshabilitado"}
                                </p>
                                {hasUpdate && (
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-1.5 text-[10px] border-green-500/50 text-green-700 dark:text-green-400 bg-green-500/10 cursor-pointer hover:bg-green-500/20 flex-shrink-0 whitespace-nowrap"
                                        onClick={() =>
                                            onUpdateClick(
                                                mod.character,
                                                mod.name,
                                                updateInfo?.modUrl || "",
                                            )
                                        }
                                    >
                                        Actualizar
                                    </Badge>
                                )}
                                {hasKeySwaps && (
                                    <Badge
                                        variant="outline"
                                        aria-expanded={isKeySwapsExpanded}
                                        className="h-5 px-1.5 text-[10px] border-blue-500/50 text-blue-700 dark:text-blue-400 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 flex-shrink-0 whitespace-nowrap"
                                        onClick={() =>
                                            setIsKeySwapsExpanded(
                                                !isKeySwapsExpanded,
                                            )
                                        }
                                    >
                                        <Keyboard className="h-3 w-3 mr-1" />
                                        {mod.keySwaps.length}{" "}
                                        {mod.keySwaps.length === 1
                                            ? "Tecla"
                                            : "Teclas"}
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

                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Activar solo este"
                            aria-label={`Activar solo ${mod.name}`}
                            disabled={pending}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                            onClick={() =>
                                onActivateSingle(mod.character, mod.name)
                            }
                        >
                            <Zap className="h-4 w-4" />
                        </Button>
                        {mod.gameBananaUrl && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary opacity-70 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                                title="Ver en GameBanana"
                                aria-label={`Ver ${mod.name} en GameBanana`}
                                onClick={() => onOpenUrl(mod.gameBananaUrl)}
                            >
                                <Globe className="h-4 w-4" />
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Acciones para ${mod.name}`}
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
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
                                {mod.gameBananaUrl && (
                                    <DropdownMenuItem
                                        onClick={() =>
                                            onRestoreImage(
                                                mod.character,
                                                mod.name,
                                                true,
                                            )
                                        }
                                    >
                                        Restaurar imagen
                                    </DropdownMenuItem>
                                )}
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

                        <div className="pl-2 border-l ml-1 flex items-center gap-2">
                            {pending && (
                                <div
                                    className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
                                    role="status"
                                    aria-label={`Actualizando ${mod.name}`}
                                />
                            )}
                            <Switch
                                checked={mod.isActive}
                                disabled={pending}
                                aria-label={
                                    mod.isActive
                                        ? `Desactivar ${mod.name}`
                                        : `Activar ${mod.name}`
                                }
                                onCheckedChange={() =>
                                    onToggle(mod.character, mod.name)
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* KeySwaps Dialog - flotante, no mueve la grilla */}
                {hasKeySwaps && (
                    <Dialog
                        open={isKeySwapsExpanded}
                        onOpenChange={setIsKeySwapsExpanded}
                    >
                        <DialogContent className="max-w-md p-4 rounded-[3px] border bg-card">
                            <div className="flex items-center gap-2 pr-8">
                                <Keyboard className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0">
                                    <DialogTitle className="text-sm truncate">
                                        {mod.name}
                                    </DialogTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {mod.keySwaps.length}{" "}
                                        {mod.keySwaps.length === 1
                                            ? "atajo"
                                            : "atajos"}{" "}
                                        de teclado en el juego
                                    </p>
                                </div>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                                {mod.keySwaps.map((swap) => {
                                    // Display name: strip "KeySwap" or "Key" prefix to get the descriptive part
                                    const displayName =
                                        swap.sectionName
                                            .replace(/^KeySwap/i, "")
                                            .replace(/^Key/i, "")
                                            .trim() || swap.sectionName;

                                    return (
                                        <div
                                            key={swap.sectionName}
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
                                                        title="Tecla para avanzar"
                                                    >
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                        <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded-[2px] border border-border">
                                                            {swap.forwardKey}
                                                        </kbd>
                                                    </div>
                                                )}
                                                {swap.backwardKey && (
                                                    <div
                                                        className="flex items-center gap-1"
                                                        title="Tecla para retroceder"
                                                    >
                                                        <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                                                        <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded-[2px] border border-border">
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
                                                        {swap.variants} var.
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Image Expand Dialog */}
            <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[3px] border bg-card">
                    <DialogTitle className="sr-only">{mod.name}</DialogTitle>
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Cerrar vista previa de ${mod.name}`}
                            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-[2px] bg-card hover:bg-accent border"
                            onClick={() => setIsImageExpanded(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        {imageData && (
                            <img
                                src={imageData}
                                alt={`Vista previa ampliada de ${mod.name}`}
                                className="w-full h-auto max-h-[80vh] object-contain"
                            />
                        )}
                        <div className="border-t p-4 bg-card">
                            <h3 className="font-bold tracking-tight text-lg truncate">
                                {mod.name}
                            </h3>
                            <p className="spec-label text-muted-foreground mt-1">
                                {pending
                                    ? "Actualizando…"
                                    : mod.isActive
                                      ? "Habilitado"
                                      : "Deshabilitado"}
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
