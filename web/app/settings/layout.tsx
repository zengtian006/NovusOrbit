import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Settings",
  description: "NovusOrbit settings.",
  path: "/settings",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
