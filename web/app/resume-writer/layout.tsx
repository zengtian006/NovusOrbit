import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "AI Resume Writer",
  description: "Rewrite, shorten or expand resume bullet points with AI, then export to Markdown or PDF.",
  path: "/resume-writer",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
