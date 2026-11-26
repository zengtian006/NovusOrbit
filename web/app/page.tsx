import { auth } from "@/lib/auth";
import { HomeDashboard, HomeLanding } from "@/components/HomeContent";

/**
 * Home: a job-search dashboard when signed in, a landing page otherwise.
 * Decided on the server so the landing page's content is in the initial HTML.
 */
export default async function HomePage() {
  const session = await auth().catch(() => null);
  if (!session?.user) return <HomeLanding />;
  return <HomeDashboard firstName={session.user.name?.split(" ")[0] ?? ""} />;
}
