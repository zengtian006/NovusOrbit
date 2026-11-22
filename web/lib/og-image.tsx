import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared 1200x630 social preview card used for og:image and twitter:image. */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="15" fill="url(#g)" />
            <circle cx="16" cy="16" r="10" fill="none" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <path
              d="M 16 6 L 17 13 L 24 13 L 18.5 17.5 L 21 24 L 16 20 L 11 24 L 13.5 17.5 L 8 13 L 15 13 Z"
              fill="white"
              opacity="0.9"
            />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700 }}>NovusOrbit</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>
            Your free AI career assistant
          </div>
          <div style={{ fontSize: 32, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.35 }}>
            Interview prep, resume rewrites and job matches, personalized from your CV.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#a5b4fc" }}>
          www.novusorbit.com
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
