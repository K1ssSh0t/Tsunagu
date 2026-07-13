import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { utils } from "../../wailsjs/go/models";

interface ZipModalProps {
    isOpen: boolean;
    zipStructure: utils.ZipFile[];
    selectedRoot: string;
    onSelectRoot: (path: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}

export const ZipModal: React.FC<ZipModalProps> = ({
    isOpen,
    zipStructure,
    selectedRoot,
    onSelectRoot,
    onCancel,
    onConfirm,
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
        new Set(),
    );

    // Initialize expanded folders when structure changes (handled in parent usually, but we can do it here too if we pass initial expanded)
    // For now we'll manage local expansion state here or receive it.
    // The original app managed it in App.tsx. Let's manage it here for encapsulation if possible,
    // but the original app passed `expandedFolders` state.
    // To simplify, let's manage it locally here.

    React.useEffect(() => {
        if (isOpen && zipStructure.length > 0) {
            const initialExpanded = new Set<string>();
            const traverse = (files: utils.ZipFile[]) => {
                files.forEach((f) => {
                    if (f.isDir) {
                        initialExpanded.add(f.path);
                        if (f.children) traverse(f.children);
                    }
                });
            };
            traverse(zipStructure);
            setExpandedFolders(initialExpanded);
        }
    }, [isOpen, zipStructure]);

    const toggleFolder = (path: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedFolders(newExpanded);
    };

    const ZipFileTree: React.FC<{ files: utils.ZipFile[]; level: number }> = ({
        files,
        level,
    }) => {
        if (!files || files.length === 0) {
            return (
                <div className="text-gray-500 text-sm p-2">
                    No hay archivos para mostrar
                </div>
            );
        }

        return (
            <div key={`zip-tree-${level}-${Date.now()}`}>
                {files.map((file) => (
                    <div
                        key={`${file.path}-${file.isDir}`}
                        style={{ paddingLeft: `${level * 20}px` }}
                    >
                        {/* biome-ignore lint/a11y/useSemanticElements: contiene un botón anidado, un <button> real sería HTML inválido */}
                        <div
                            className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                selectedRoot === file.path
                                    ? "bg-blue-100 dark:bg-blue-900"
                                    : ""
                            }`}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                if (file.isDir) {
                                    onSelectRoot(file.path);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (
                                    (e.key === "Enter" || e.key === " ") &&
                                    file.isDir
                                ) {
                                    e.preventDefault();
                                    onSelectRoot(file.path);
                                }
                            }}
                        >
                            {file.isDir && (
                                <button
                                    type="button"
                                    className="mr-1 p-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFolder(file.path);
                                    }}
                                >
                                    {expandedFolders.has(file.path) ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                            {file.isDir ? (
                                <Folder className="w-4 h-4 mr-2 text-blue-500" />
                            ) : (
                                <File className="w-4 h-4 mr-2 text-gray-500" />
                            )}
                            <span className="text-sm">{file.name}</span>
                            {file.isDir && (
                                <span className="ml-2 text-xs text-gray-500">
                                    ({file.children ? file.children.length : 0}{" "}
                                    items)
                                </span>
                            )}
                        </div>
                        {file.isDir &&
                            expandedFolders.has(file.path) &&
                            file.children &&
                            file.children.length > 0 && (
                                <ZipFileTree
                                    files={file.children}
                                    level={level + 1}
                                />
                            )}
                    </div>
                ))}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl h-[80vh] flex flex-col">
                <CardHeader>
                    <CardTitle>Estructura del ZIP</CardTitle>
                    <CardDescription>
                        Selecciona la carpeta raíz del mod dentro del archivo
                        comprimido. Busca la carpeta que contiene los archivos
                        .ini y .dds
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full border rounded-md p-2">
                        <ZipFileTree files={zipStructure} level={0} />
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground truncate max-w-[50%]">
                        Seleccionado: {selectedRoot || "Ninguno (Raíz del ZIP)"}
                    </div>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={onCancel}>
                            Cancelar
                        </Button>
                        <Button onClick={onConfirm}>Confirmar Selección</Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};
