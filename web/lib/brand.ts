/** The NovusOrbit mark as an SVG string (same artwork as app/icon.svg). */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="no-tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset="1" stop-color="#4338CA"/></linearGradient>
    <mask id="no-back" maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><rect x="-40" y="-40" width="80" height="80" fill="#fff"/><circle r="16" fill="#000"/></mask>
    <mask id="no-planet" maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><rect x="-40" y="-40" width="80" height="80" fill="#fff"/><path d="M -25 0 A 25 10 0 0 0 25 0" fill="none" stroke="#000" stroke-width="8"/></mask>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#no-tile)"/>
  <g transform="translate(32 33) rotate(-24)">
    <ellipse rx="25" ry="10" fill="none" stroke="#fff" stroke-width="4.5" opacity="0.5" mask="url(#no-back)"/>
    <circle r="12.5" fill="#fff" mask="url(#no-planet)"/>
    <path d="M -25 0 A 25 10 0 0 0 25 0" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
  </g>
  <circle cx="48.5" cy="16.5" r="5.5" fill="#FBBF24"/>
</svg>`;

export const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;
