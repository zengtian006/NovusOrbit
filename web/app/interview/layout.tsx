import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "AI Interview Prep",
  description: "Generate interview questions for a saved job at your chosen difficulty, with suggested answers drawn from your CV.",
  path: "/interview",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
