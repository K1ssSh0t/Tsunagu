import { Archive, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";

interface CleanupDialogProps {
    open: boolean;
    fileName: string;
    fileSize: number;
    onDecision: (shouldDelete: boolean) => void;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 10) / 10} ${sizes[i]}`;
}

export function CleanupDialog({
    open,
    fileName,
    fileSize,
    onDecision,
}: CleanupDialogProps) {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(isOpen) => !isOpen && onDecision(false)}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        ¿Eliminar archivo descargado?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        El mod se actualizó correctamente. ¿Qué quieres hacer
                        con el archivo descargado?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="my-4 p-4 bg-muted rounded-lg border">
                    <div className="flex items-start gap-3">
                        <Archive className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                                {fileName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Tamaño: {formatBytes(fileSize)} · Se guarda en
                                .cache si lo conservas
                            </p>
                        </div>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onDecision(false)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Conservar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onDecision(true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
