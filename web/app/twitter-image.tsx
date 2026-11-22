import { renderOgImage } from "@/lib/og-image";

export const alt = "NovusOrbit: free AI career assistant for interview prep, resumes and job search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderOgImage();
}
