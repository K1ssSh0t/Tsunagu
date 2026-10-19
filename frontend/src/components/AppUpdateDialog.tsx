import { ArrowUpRight, Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { updater } from "../../wailsjs/go/models";
import { EventsOn } from "../../wailsjs/runtime/runtime";

export interface AppUpdateProgress {
    phase: string;
    bytesDownloaded: number;
    totalBytes: number;
    percentage: number;
    speed: string;
}

interface AppUpdateDialogProps {
    open: boolean;
    info: updater.UpdateInfo | null;
    busy: boolean;
    restarting: boolean;
    onUpdate: () => void;
    onLater: () => void;
    onOpenRelease: () => void;
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.min(
        Math.floor(Math.log(bytes) / Math.log(k)),
        sizes.length - 1,
    );
    return `${Math.round((bytes / k ** i) * 10) / 10} ${sizes[i]}`;
}

function formatReleaseDate(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

const PHASE_LABELS: Record<string, string> = {
    downloading: "Descargando actualización",
    extracting: "Extrayendo archivos",
    applying: "Aplicando actualización",
    restarting: "Reiniciando Tsunagu",
};

export function AppUpdateDialog({
    open,
    info,
    busy,
    restarting,
    onUpdate,
    onLater,
    onOpenRelease,
}: AppUpdateDialogProps) {
    const [progress, setProgress] = useState<AppUpdateProgress | null>(null);

    useEffect(() => {
        if (!open || !busy) return;
        const unsubscribe = EventsOn(
            "update:progress",
            (payload: AppUpdateProgress) => {
                setProgress(payload);
            },
        );
        return () => unsubscribe();
    }, [open, busy]);

    useEffect(() => {
        if (!open) setProgress(null);
    }, [open]);

    if (!info) return null;

    const date = formatReleaseDate(info.publishedAt);
    const phaseLabel = progress
        ? PHASE_LABELS[progress.phase] || "Actualizando"
        : "Preparando actualización";
    const downloading = !progress || progress.phase === "downloading";
    const percentage = Math.round(progress?.percentage ?? 0);
    const barValue =
        restarting || (progress && progress.phase !== "downloading")
            ? 100
            : percentage;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onLater();
            }}
        >
            <DialogContent
                className="sm:max-w-lg"
                onInteractOutside={(event) => {
                    if (busy) event.preventDefault();
                }}
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle className="display-ink flex items-center gap-2 text-xl">
                        <RefreshCw className="h-5 w-5" />
                        Actualización disponible
                    </DialogTitle>
                    <DialogDescription>
                        Hay una compilación nueva de Tsunagu lista para
                        instalar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border border-border p-3 text-sm">
                        <span className="spec-label text-muted-foreground">
                            Versión
                        </span>
                        <span className="font-mono tabular-nums">
                            {info.currentVersion}
                        </span>
                        <span className="spec-label text-muted-foreground">
                            Nueva build
                        </span>
                        <span className="truncate font-mono tabular-nums">
                            {info.latestVersion}
                        </span>
                        {date && (
                            <>
                                <span className="spec-label text-muted-foreground">
                                    Publicada
                                </span>
                                <span>{date}</span>
                            </>
                        )}
                        <span className="spec-label text-muted-foreground">
                            Tamaño
                        </span>
                        <span className="font-mono tabular-nums">
                            {formatBytes(info.assetSize)}
                        </span>
                    </div>

                    {info.notes && (
                        <div className="space-y-1.5">
                            <p className="spec-label text-muted-foreground">
                                Notas del release
                            </p>
                            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/40 p-3 text-sm leading-relaxed">
                                {info.notes}
                            </div>
                        </div>
                    )}

                    {busy && (
                        <div className="space-y-2 border border-border p-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2">
                                    {restarting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    {phaseLabel}
                                </span>
                                {downloading && !restarting && (
                                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                        {percentage}%
                                    </span>
                                )}
                            </div>
                            <Progress
                                value={barValue}
                                aria-label="Progreso de la actualización"
                            />
                            {downloading &&
                                !restarting &&
                                progress &&
                                progress.totalBytes > 0 && (
                                    <p className="font-mono text-xs text-muted-foreground tabular-nums">
                                        {formatBytes(progress.bytesDownloaded)}{" "}
                                        / {formatBytes(progress.totalBytes)}
                                        {progress.speed
                                            ? ` · ${progress.speed}`
                                            : ""}
                                    </p>
                                )}
                            {restarting && (
                                <p className="text-xs text-muted-foreground">
                                    La app se cerrará y volverá a abrir con la
                                    versión nueva.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!restarting && (
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={onOpenRelease}
                            disabled={busy}
                        >
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Ver release
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        type="button"
                        onClick={onLater}
                        disabled={busy}
                    >
                        Ahora no
                    </Button>
                    <Button
                        type="button"
                        onClick={onUpdate}
                        disabled={busy}
                        className="min-w-32"
                    >
                        {busy ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {restarting ? "Reiniciando" : "Actualizando"}
                            </>
                        ) : (
                            "Actualizar"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
