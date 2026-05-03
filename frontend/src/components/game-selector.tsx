import React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Gamepad2, ChevronDown } from "lucide-react";

interface GameSelectorProps {
    selectedGame: string;
    onGameSelect: (game: string) => void;
}

export const GameSelector: React.FC<GameSelectorProps> = ({
    selectedGame,
    onGameSelect,
}) => {
    const games = [
        { id: "genshin", name: "Genshin Impact" },
        { id: "wuwa", name: "Wuthering Waves" },
        { id: "hsr", name: "Honkai: Star Rail" },
        { id: "zzz", name: "Zenless Zone Zero" },
        { id: "endfield", name: "Arknights: Endfield" },
    ];


    const currentGame = games.find((g) => g.id === selectedGame) || games[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between">
                    <div className="flex items-center">
                        <Gamepad2 className="mr-2 h-4 w-4" />
                        {currentGame.name}
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
                {games.map((game) => (
                    <DropdownMenuItem
                        key={game.id}
                        onClick={() => onGameSelect(game.id)}
                        className="cursor-pointer"
                    >
                        {game.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
