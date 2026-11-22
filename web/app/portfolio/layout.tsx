import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "My Career Portfolio: Upload Your CV",
  description: "Upload your CV and career documents once. NovusOrbit indexes them so every tool, from interview prep to job matching, gives advice specific to you.",
  path: "/portfolio",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
