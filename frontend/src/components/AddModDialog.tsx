import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Folder, File } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddModDialogProps {
    isOpen: boolean;
    selectedCharacter: string;
    newModName: string;
    newModPath: string;
    gameBananaUrl: string;
    autoNameEnabled: boolean;
    onNameChange: (val: string) => void;
    onPathChange: (val: string) => void;
    onUrlChange: (val: string) => void;
    onToggleAutoName: (val: boolean) => void;
    onSelectFile: () => void;
    onSelectFolder: () => void;
    onCancel: () => void;
    onConfirm: () => void;
}

export const AddModDialog: React.FC<AddModDialogProps> = ({
    isOpen,
    selectedCharacter,
    newModName,
    newModPath,
    gameBananaUrl,
    autoNameEnabled,
    onNameChange,
    onPathChange,
    onUrlChange,
    onToggleAutoName,
    onSelectFile,
    onSelectFolder,
    onCancel,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Agregar Nuevo Mod</CardTitle>
                    <CardDescription>Agrega un mod para {selectedCharacter}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="autoName">Auto-nombrar</Label>
                            <p className="text-xs text-muted-foreground">
                                Usar el nombre de la carpeta o archivo seleccionado
                            </p>
                        </div>
                        <Switch
                            id="autoName"
                            checked={autoNameEnabled}
                            onCheckedChange={onToggleAutoName}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="modName">Nombre del Mod</Label>
                        <Input
                            id="modName"
                            value={newModName}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="Ej: Skin Verano"
                            disabled={autoNameEnabled}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="modPath">Archivo o Carpeta del Mod</Label>
                        <div className="flex space-x-2">
                            <Input
                                id="modPath"
                                value={newModPath}
                                onChange={(e) => onPathChange(e.target.value)}
                                placeholder="Ruta al archivo .zip o carpeta"
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <Folder className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={onSelectFile}>
                                        <File className="mr-2 h-4 w-4" />
                                        Seleccionar Archivo (ZIP/RAR)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onSelectFolder}>
                                        <Folder className="mr-2 h-4 w-4" />
                                        Seleccionar Carpeta
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gameBananaUrl">URL de GameBanana (Opcional)</Label>
                        <Input
                            id="gameBananaUrl"
                            value={gameBananaUrl}
                            onChange={(e) => onUrlChange(e.target.value)}
                            placeholder="https://gamebanana.com/mods/..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Permite verificar actualizaciones automáticamente
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button onClick={onConfirm} disabled={!newModName || !newModPath}>
                        Agregar Mod
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
