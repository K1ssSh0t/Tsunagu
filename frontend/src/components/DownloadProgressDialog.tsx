import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";
import { Download } from "lucide-react";

interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: string;
}

interface DownloadProgressDialogProps {
  open: boolean;
  fileName: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
}

export function DownloadProgressDialog({ open, fileName }: DownloadProgressDialogProps) {
  const [progress, setProgress] = useState<DownloadProgress>({
    percentage: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    speed: "0 MB/s",
  });

  useEffect(() => {
    if (!open) {
      // Reset progress when dialog closes
      setProgress({
        percentage: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        speed: "0 MB/s",
      });
      return;
    }

    // Listen for progress events from Go backend
    const handleProgress = (data: DownloadProgress) => {
      setProgress(data);
    };

    // Subscribe to download:progress events
    // Using window.runtime.EventsOn from Wails
    if (window.runtime && window.runtime.EventsOn) {
      const unsubscribe = window.runtime.EventsOn("download:progress", handleProgress);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {/* Prevent closing during download */}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 animate-pulse" />
            Downloading Update
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{fileName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={progress.percentage} className="h-2" />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="font-mono font-medium">{progress.percentage.toFixed(1)}%</span>
            <span className="font-mono">
              {formatBytes(progress.bytesDownloaded)}
              {progress.totalBytes > 0 && ` / ${formatBytes(progress.totalBytes)}`}
            </span>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <span className="font-mono">{progress.speed}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Extend window interface for Wails runtime
declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (data: any) => void) => () => void;
    };
  }
}
