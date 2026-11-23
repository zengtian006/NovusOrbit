import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "AI Job Suggestions",
  description: "Get live job listings from LinkedIn, Indeed, Glassdoor and company career sites, ranked against your CV, with an explanation for each match.",
  path: "/job-suggest",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
