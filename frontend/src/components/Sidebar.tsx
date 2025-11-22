import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { character, mod } from "../../wailsjs/go/models";

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
    return (
        <Card className="md:col-span-1 h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Personajes</CardTitle>
                <div className="relative">
                    <Input placeholder="Buscar..." className="h-8" />
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
                <ScrollArea className="h-full pr-4">
                    <div className="space-y-1">
                        {characters.map((char) => {
                            const hasCharUpdate = updates.some(
                                (u) => u.characterName === char.name
                            );
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
                                        {hasCharUpdate && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                        )}
                                        {char.hasFolder && (
                                            <Badge variant="outline" className="text-xs">
                                                {char.mods ? char.mods.length : 0}
                                            </Badge>
                                        )}
                                    </div>
                                </Button>
                            );
                        })}
                        {characters.length === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                                No hay personajes
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
