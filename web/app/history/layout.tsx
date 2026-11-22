import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "History",
  description: "Your past chat, interview prep and job suggestion sessions.",
  path: "/history",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
