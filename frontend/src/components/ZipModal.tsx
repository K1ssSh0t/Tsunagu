import { ChevronDown, ChevronRight, File, Folder, Wand2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

function collectDirs(files: utils.ZipFile[], out: utils.ZipFile[] = []) {
    for (const f of files || []) {
        if (f.isDir) {
            out.push(f);
            if (f.children) collectDirs(f.children, out);
        }
    }
    return out;
}

function dirHasIni(dir: utils.ZipFile) {
    return (dir.children || []).some(
        (c) => !c.isDir && /\.ini$/i.test(c.name || c.path),
    );
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

    const candidates = useMemo(() => {
        const dirs = collectDirs(zipStructure);
        return new Set(dirs.filter(dirHasIni).map((d) => d.path));
    }, [zipStructure]);

    React.useEffect(() => {
        if (isOpen && zipStructure.length > 0) {
            const initial = new Set<string>();
            const expandCandidates = (files: utils.ZipFile[]) => {
                for (const f of files) {
                    if (!f.isDir) continue;
                    if (candidates.has(f.path)) {
                        initial.add(f.path);
                    }
                    if (f.children && f.children.length > 0) {
                        const hasCandidateBelow = collectDirs(f.children).some(
                            (d) => candidates.has(d.path),
                        );
                        if (
                            hasCandidateBelow ||
                            f.path.split("/").length <= 2
                        ) {
                            initial.add(f.path);
                        }
                        expandCandidates(f.children);
                    }
                }
            };
            const topLevel = zipStructure.filter((f) => f.isDir);
            if (candidates.size === 0) {
                for (const f of topLevel.slice(0, 3)) initial.add(f.path);
            } else {
                expandCandidates(zipStructure);
            }
            setExpandedFolders(initial);
        }
    }, [isOpen, zipStructure, candidates]);

    const toggleFolder = (path: string) => {
        const next = new Set(expandedFolders);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpandedFolders(next);
    };

    const firstCandidate = useMemo(() => {
        const dirs = collectDirs(zipStructure);
        return dirs.find((d) => candidates.has(d.path))?.path || "";
    }, [zipStructure, candidates]);

    const isValidSelection =
        Boolean(selectedRoot) && selectedRoot !== "." && selectedRoot !== "";

    const ZipFileTree: React.FC<{ files: utils.ZipFile[]; level: number }> = ({
        files,
        level,
    }) => {
        if (!files || files.length === 0) {
            return (
                <div className="text-muted-foreground text-sm p-2">
                    No hay archivos para mostrar
                </div>
            );
        }

        return (
            <div key={`zip-tree-level-${level}`}>
                {files.map((file) => {
                    const isCandidate = file.isDir && candidates.has(file.path);
                    const isSelected = selectedRoot === file.path;
                    const expanded = expandedFolders.has(file.path);
                    return (
                        <div
                            key={`${file.path}-${file.isDir ? "d" : "f"}`}
                            style={{ paddingLeft: `${level * 16}px` }}
                        >
                            <div
                                className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-accent focus-within:bg-accent ${
                                    isSelected
                                        ? "bg-accent border border-primary/40"
                                        : "border border-transparent"
                                }`}
                            >
                                {file.isDir ? (
                                    <button
                                        type="button"
                                        aria-label={
                                            expanded
                                                ? `Contraer ${file.name}`
                                                : `Expandir ${file.name}`
                                        }
                                        aria-expanded={expanded}
                                        className="p-1 rounded hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolder(file.path);
                                        }}
                                    >
                                        {expanded ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                    </button>
                                ) : (
                                    <span className="w-6" aria-hidden="true" />
                                )}
                                <button
                                    type="button"
                                    disabled={!file.isDir}
                                    aria-pressed={
                                        file.isDir ? isSelected : undefined
                                    }
                                    onClick={() => {
                                        if (file.isDir) onSelectRoot(file.path);
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            (e.key === "Enter" ||
                                                e.key === " ") &&
                                            file.isDir
                                        ) {
                                            e.preventDefault();
                                            onSelectRoot(file.path);
                                        }
                                    }}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left rounded focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                                >
                                    {file.isDir ? (
                                        <Folder
                                            className={`w-4 h-4 flex-shrink-0 ${isCandidate ? "text-green-600 dark:text-green-400" : "text-blue-500"}`}
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <File
                                            className="w-4 h-4 mr-0 text-muted-foreground flex-shrink-0"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="text-sm truncate">
                                        {file.name}
                                    </span>
                                    {file.isDir && (
                                        <span className="ml-1 text-xs text-muted-foreground flex-shrink-0">
                                            (
                                            {file.children
                                                ? file.children.length
                                                : 0}
                                            )
                                        </span>
                                    )}
                                    {isCandidate && (
                                        <Badge
                                            variant="outline"
                                            className="ml-1 h-5 px-1.5 text-[10px] border-green-500/50 text-green-700 dark:text-green-400 bg-green-500/10 flex-shrink-0"
                                        >
                                            Contiene .ini
                                        </Badge>
                                    )}
                                </button>
                            </div>
                            {file.isDir &&
                                expanded &&
                                file.children &&
                                file.children.length > 0 && (
                                    <ZipFileTree
                                        files={file.children}
                                        level={level + 1}
                                    />
                                )}
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl h-[80vh] flex flex-col">
                <CardHeader>
                    <CardTitle className="display-ink text-xl">
                        Estructura del ZIP
                    </CardTitle>
                    <CardDescription>
                        Elige la carpeta que contiene el .ini del mod
                        {candidates.size > 0
                            ? ` — detectamos ${candidates.size} candidata${candidates.size === 1 ? "" : "s"}.`
                            : ". Busca archivos .ini y .dds."}
                    </CardDescription>
                    {firstCandidate && (
                        <div className="pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSelectRoot(firstCandidate)}
                            >
                                <Wand2 className="mr-2 h-4 w-4" />
                                Seleccionar detectado
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden min-h-0">
                    <ScrollArea className="h-full border rounded-md p-2">
                        <ZipFileTree files={zipStructure} level={0} />
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center border-t pt-4">
                    <div
                        className="text-sm text-muted-foreground truncate max-w-full sm:max-w-[50%]"
                        role="status"
                    >
                        {selectedRoot
                            ? `Seleccionado: ${selectedRoot}`
                            : "Sin selección — elige una carpeta con .ini"}
                    </div>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={onCancel}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={!isValidSelection}
                            title={
                                isValidSelection
                                    ? "Confirmar carpeta raíz"
                                    : "Elige una carpeta válida primero"
                            }
                        >
                            Confirmar Selección
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};
