// Same stroke icons as sale-target (lucide paths).
type IconProps = { size?: number; className?: string };

const icon = (paths: string[]) =>
  function Icon({ size = 16, className = "" }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };

export const Search = icon(["m21 21-4.34-4.34", "M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"]);
export const Check = icon(["M20 6 9 17l-5-5"]);
export const Loader2 = icon(["M21 12a9 9 0 1 1-6.219-8.56"]);
export const AlertCircle = icon(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 8v4", "M12 16h.01"]);
export const ChevronDown = icon(["m6 9 6 6 6-6"]);
export const ChevronLeft = icon(["m15 18-6-6 6-6"]);
export const ChevronRight = icon(["m9 6 6 6-6 6"]);
export const RefreshCw = icon([
  "M3 12a9 9 0 0 1 15-6.7L21 8",
  "M21 3v5h-5",
  "M21 12a9 9 0 0 1-15 6.7L3 16",
  "M3 21v-5h5",
]);
export const LogOut = icon(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"]);
