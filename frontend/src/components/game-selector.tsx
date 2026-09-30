import { Check, ChevronDown, Gamepad2 } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GameSelectorProps {
    selectedGame: string;
    onGameSelect: (game: string) => void;
    gamesConfig?: Record<string, { modsPath?: string }>;
    showStatus?: boolean;
    ariaLabel?: string;
}

export const GameSelector: React.FC<GameSelectorProps> = ({
    selectedGame,
    onGameSelect,
    gamesConfig,
    showStatus = false,
    ariaLabel = "Seleccionar juego",
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
                <Button
                    variant="outline"
                    aria-label={ariaLabel}
                    className="min-w-[200px] max-w-full justify-between"
                >
                    <div className="flex items-center min-w-0">
                        <Gamepad2 className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{currentGame.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[200px]">
                {games.map((game) => {
                    const configured = Boolean(
                        gamesConfig?.[game.id]?.modsPath,
                    );
                    const isCurrent = game.id === selectedGame;
                    return (
                        <DropdownMenuItem
                            key={game.id}
                            onClick={() => onGameSelect(game.id)}
                            aria-current={isCurrent ? "true" : undefined}
                            className="cursor-pointer"
                        >
                            {showStatus && (
                                <span
                                    aria-hidden="true"
                                    className={`mr-2 h-2 w-2 rounded-[1px] flex-shrink-0 ${
                                        configured
                                            ? "bg-green-600 dark:bg-green-400"
                                            : "bg-muted-foreground/30"
                                    }`}
                                />
                            )}
                            <span className="flex-1">{game.name}</span>
                            {isCurrent && (
                                <Check className="ml-2 h-4 w-4 flex-shrink-0" />
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
