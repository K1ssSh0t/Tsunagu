import { Loader2 } from "lucide-react";
import type React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface LoadingOverlayProps {
    message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            role="status"
            aria-live="polite"
        >
            <Card className="w-[300px] shadow-lg">
                <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Loader2
                        className="h-10 w-10 animate-spin text-primary"
                        aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-center">{message}</p>
                </CardContent>
            </Card>
        </div>
    );
};
