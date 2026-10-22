import { cn } from "@/lib/utils";

interface TsunaguMarkProps {
    className?: string;
    /** When provided, the mark is exposed as an image with this label. */
    title?: string;
}

const MARK_PATH =
    "M8 5H56Q59 5 59 8V56Q59 59 56 59H8Q5 59 5 56V8Q5 5 8 5Z M10.75 10.75H53.25V53.25H10.75Z M12.25 12.25H51.75V51.75H12.25Z M16 18.5H48V27H36.25V45.5H27.75V27H16Z";

/**
 * Tsunagu's brand mark: a solid hanko-style seal with a T cut out of it and
 * a hairline inner rule. It is drawn with `currentColor` so it follows the
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
            <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
        </svg>
    );
}
