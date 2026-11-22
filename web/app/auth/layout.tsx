import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to NovusOrbit with Google.",
  path: "/auth/signin",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
