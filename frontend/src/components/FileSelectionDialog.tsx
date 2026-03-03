import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { FileArchive, Download } from "lucide-react";

export interface ModFile {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  md5Checksum: string;
  description: string;
  fileId: number;
  dateAdded: string;
}

interface FileSelectionDialogProps {
  open: boolean;
  files: ModFile[];
  onSelectFile: (file: ModFile) => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${formatted} (${timeAgo(date)})`;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (days > 0) {
    const remainingHours = Math.floor((diffMs - days * 86400000) / 3600000);
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h ago`;
    }
    return `${days}d ago`;
  }
  if (hours > 0) {
    const remainingMinutes = Math.floor((diffMs - hours * 3600000) / 60000);
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function FileSelectionDialog({ open, files, onSelectFile, onCancel }: FileSelectionDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const handleSelect = () => {
    if (selectedIndex !== null && files[selectedIndex]) {
      onSelectFile(files[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select File to Download</DialogTitle>
          <DialogDescription>
            Choose which file you want to download for this mod update.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {files.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No files available for download
            </div>
          ) : (
            <RadioGroup
              value={selectedIndex.toString()}
              onValueChange={(value) => setSelectedIndex(parseInt(value))}
              className="space-y-3"
            >
              {files.map((file, index) => (
                <div
                  key={file.fileId || index}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <RadioGroupItem value={index.toString()} id={`file-${index}`} className="mt-1" />
                  <Label
                    htmlFor={`file-${index}`}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <FileArchive className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">{file.fileName}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{formatBytes(file.fileSize)}</span>
                      {formatDate(file.dateAdded) && (
                        <>
                          <span>•</span>
                          <span>{formatDate(file.dateAdded)}</span>
                        </>
                      )}
                      {file.description && (
                        <>
                          <span>•</span>
                          <span className="line-clamp-1">{file.description}</span>
                        </>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={files.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
