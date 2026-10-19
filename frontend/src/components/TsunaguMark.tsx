import { cn } from "@/lib/utils";

interface TsunaguMarkProps {
    className?: string;
    /** When provided, the mark is exposed as an image with this label. */
    title?: string;
}

/**
 * Tsunagu's brand mark: two cords coming from opposite corners and meeting
 * in a square seal. It is drawn with `currentColor` so it follows the
 * theme (ink on paper, or paper on ink in dark mode).
 *
 * The same geometry lives in build/appicon.svg (app icon); keep both in
 * sync when changing it.
 */
export function TsunaguMark({ className, title }: TsunaguMarkProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            className={cn("shrink-0", className)}
            role={title ? "img" : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <g
                fill="none"
                stroke="currentColor"
                strokeWidth={6}
                strokeLinecap="butt"
                strokeLinejoin="miter"
            >
                <path d="M 10 58 C 22 58 24 40 32 32 C 40 24 42 6 54 6" />
                <path d="M 10 6 C 22 6 24 24 32 32 C 40 40 42 58 54 58" />
            </g>
            <rect x="23" y="23" width="18" height="18" fill="currentColor" />
        </svg>
    );
}
