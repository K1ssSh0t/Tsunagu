import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { character } from "../../wailsjs/go/models";
import { MoveRight } from "lucide-react";

interface MoveModDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modName: string;
  currentCharacter: string;
  characters: character.Character[];
  onMove: (targetCharacter: string) => void;
}

export const MoveModDialog: React.FC<MoveModDialogProps> = ({
  open,
  onOpenChange,
  modName,
  currentCharacter,
  characters,
  onMove,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>("");

  const handleMove = () => {
    if (selectedTarget) {
      onMove(selectedTarget);
      setSelectedTarget("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedTarget("");
    onOpenChange(false);
  };

  // Build list of possible targets (characters and their skins)
  const buildTargetOptions = () => {
    const options: { value: string; label: string; isIndented: boolean }[] = [];

    characters.forEach((char) => {
      // Skip the current character (we'll add it with its skins if it has any)
      const isCurrentChar =
        char.name.toLowerCase() === currentCharacter.toLowerCase();

      // Add main character option
      options.push({
        value: char.name,
        label: `${char.name} (Default)`,
        isIndented: false,
      });

      // Add skin options if available
      if (char.skins && char.skins.length > 0) {
        char.skins.forEach((skin) => {
          options.push({
            value: skin.folder,
            label: `${char.name} - ${skin.name}`,
            isIndented: true,
          });
        });
      }
    });

    // Filter out the exact current location
    return options.filter(
      (opt) => opt.value.toLowerCase() !== currentCharacter.toLowerCase(),
    );
  };

  const targetOptions = buildTargetOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveRight className="h-5 w-5" />
            Mover Mod
          </DialogTitle>
          <DialogDescription>
            Selecciona el personaje o skin de destino para el mod "{modName}"
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget}>
            <div className="space-y-2">
              {targetOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center space-x-2 ${
                    option.isIndented ? "pl-6" : ""
                  }`}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`target-${option.value}`}
                  />
                  <Label
                    htmlFor={`target-${option.value}`}
                    className="flex-1 cursor-pointer text-sm font-normal capitalize"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} className="m-2">
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedTarget}
            className="m-2"
          >
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
