import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Job Application Tracker",
  description: "Save job listings and track each application from interested to applied, interviewing, offered or rejected. Free and connected to AI interview prep.",
  path: "/jobs",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
