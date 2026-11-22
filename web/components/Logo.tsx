import { useId } from "react";

/**
 * NovusOrbit mark: a planet rising out of its orbit, with an amber "satellite".
 * Same artwork as app/icon.svg; ids are per-instance so several marks can
 * share a page.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <mask id={`${id}-back`} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80">
          <rect x="-40" y="-40" width="80" height="80" fill="#fff" />
          <circle r="16" fill="#000" />
        </mask>
        <mask id={`${id}-planet`} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80">
          <rect x="-40" y="-40" width="80" height="80" fill="#fff" />
          <path d="M -25 0 A 25 10 0 0 0 25 0" fill="none" stroke="#000" strokeWidth="8" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />
      <g transform="translate(32 33) rotate(-24)">
        <ellipse rx="25" ry="10" fill="none" stroke="#fff" strokeWidth="4.5" opacity="0.5" mask={`url(#${id}-back)`} />
        <circle r="12.5" fill="#fff" mask={`url(#${id}-planet)`} />
        <path d="M -25 0 A 25 10 0 0 0 25 0" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      </g>
      <circle cx="48.5" cy="16.5" r="5.5" fill="#FBBF24" />
    </svg>
  );
}

/** Mark plus "NovusOrbit" wordmark. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-slate-900 dark:text-white text-[17px]">
        Novus<span className="text-indigo-600 dark:text-indigo-400">Orbit</span>
      </span>
    </span>
  );
}
