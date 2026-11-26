import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Ask Your AI Career Coach",
  description: "Ask career questions and get answers grounded in your own CV: how to pitch yourself, what to learn next, salary and company research.",
  path: "/ask",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
