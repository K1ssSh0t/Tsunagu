import { CloudDownload, Download, File, Folder } from "lucide-react";
import type React from "react";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface UpdateModDialogProps {
    isOpen: boolean;
    modName: string;
    currentUrl?: string;
    onOpenUrl: (url: string) => void;
    onDownloadFromGameBanana?: () => void;
    onUpdateFromFile: () => void;
    onUpdateFromFolder: () => void;
    onCancel: () => void;
}

export const UpdateModDialog: React.FC<UpdateModDialogProps> = ({
    isOpen,
    modName,
    currentUrl,
    onOpenUrl,
    onDownloadFromGameBanana,
    onUpdateFromFile,
    onUpdateFromFolder,
    onCancel,
}) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Actualizar Mod</AlertDialogTitle>
                    <AlertDialogDescription>
                        Hay una actualización disponible para "{modName}". ¿Cómo
                        deseas actualizarlo?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3 py-4">
                    {currentUrl && (
                        <>
                            <Button
                                onClick={() => onOpenUrl(currentUrl)}
                                variant="outline"
                                className="w-full justify-start"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Ir a la página del mod (GameBanana)
                            </Button>
                            {onDownloadFromGameBanana && (
                                <Button
                                    onClick={onDownloadFromGameBanana}
                                    variant="default"
                                    className="w-full justify-start bg-primary"
                                >
                                    <CloudDownload className="mr-2 h-4 w-4" />
                                    Descargar desde GameBanana
                                </Button>
                            )}
                        </>
                    )}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                O actualizar manualmente
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={onUpdateFromFile}
                        className="w-full justify-start"
                    >
                        <File className="mr-2 h-4 w-4" />
                        Seleccionar archivo ZIP
                    </Button>
                    <Button
                        onClick={onUpdateFromFolder}
                        variant="secondary"
                        className="w-full justify-start"
                    >
                        <Folder className="mr-2 h-4 w-4" />
                        Seleccionar Carpeta
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        Cancelar
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
