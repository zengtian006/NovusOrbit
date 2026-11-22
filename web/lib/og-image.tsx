import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/brand";

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_DATA_URI} width={72} height={72} alt="" />
          <div style={{ fontSize: 44, fontWeight: 700, display: "flex" }}>Novus<span style={{ color: "#a5b4fc" }}>Orbit</span></div>
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
