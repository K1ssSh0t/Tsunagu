import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { character, mod } from "../../wailsjs/go/models";

type SortOption = "name" | "mods-asc" | "mods-desc";

const SORT_STORAGE_KEY = "tsunagu-character-sort";

interface SidebarProps {
    characters: character.Character[];
    selectedCharacter: string;
    updates: mod.ModUpdate[];
    onSelectCharacter: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    characters,
    selectedCharacter,
    updates,
    onSelectCharacter,
}) => {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [sortBy, setSortBy] = React.useState<SortOption>(() => {
        const saved = localStorage.getItem(SORT_STORAGE_KEY);
        return (saved as SortOption) || "name";
    });

    const handleSortChange = (value: SortOption) => {
        setSortBy(value);
        localStorage.setItem(SORT_STORAGE_KEY, value);
    };

    const filteredCharacters = characters.filter((char) =>
        char.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedCharacters = React.useMemo(() => {
        const result = [...filteredCharacters];

        switch (sortBy) {
            case "mods-desc":
                result.sort((a, b) => (b.mods?.length || 0) - (a.mods?.length || 0));
                break;
            case "mods-asc":
                result.sort((a, b) => (a.mods?.length || 0) - (b.mods?.length || 0));
                break;
            case "name":
            default:
                result.sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    }, [filteredCharacters, sortBy]);

    return (
        <Card className="md:col-span-1 h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Personajes</CardTitle>
                <div className="space-y-2">
                    <Input
                        placeholder="Buscar..."
                        className="h-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Select value={sortBy} onValueChange={handleSortChange}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">
                                <div className="flex items-center gap-2">
                                    <ArrowUpDown className="h-3 w-3" />
                                    <span>Nombre (A-Z)</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="mods-desc">
                                <div className="flex items-center gap-2">
                                    <ArrowDown className="h-3 w-3" />
                                    <span>Más mods primero</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="mods-asc">
                                <div className="flex items-center gap-2">
                                    <ArrowUp className="h-3 w-3" />
                                    <span>Menos mods primero</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
                <ScrollArea className="h-full pr-4">
                    <div className="space-y-1">
                        {sortedCharacters.map((char) => {
                            // Check for updates in main character folder
                            const hasCharUpdate = updates.some(
                                (u) => u.characterName === char.name
                            );
                            
                            // Check for updates in any of the character's skins
                            const hasSkinUpdate = char.skins && char.skins.some((skin) =>
                                updates.some((u) => u.characterName === skin.folder)
                            );
                            
                            const hasAnyUpdate = hasCharUpdate || hasSkinUpdate;
                            
                            return (
                                <Button
                                    key={char.name}
                                    variant={
                                        selectedCharacter === char.name ? "secondary" : "ghost"
                                    }
                                    className="w-full justify-start capitalize relative"
                                    onClick={() => onSelectCharacter(char.name)}
                                >
                                    <span className="truncate">{char.name}</span>
                                    <div className="ml-auto flex items-center gap-2">
                                        {hasAnyUpdate && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                        )}
                                        {(char.hasFolder || (char.mods && char.mods.length > 0)) && (
                                            <Badge variant="outline" className="text-xs">
                                                {char.mods ? char.mods.length : 0}
                                            </Badge>
                                        )}
                                    </div>
                                </Button>
                            );
                        })}
                        {sortedCharacters.length === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                                {searchQuery ? "No se encontraron personajes" : "No hay personajes"}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
