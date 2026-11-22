import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Admin",
  description: "NovusOrbit administration.",
  path: "/admin",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
