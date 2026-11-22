import Link from "next/link";
import { PageShell } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy",
  description: "What NovusOrbit stores, why, who processes it, and how to delete it.",
  path: "/privacy",
});

const UPDATED = "2026-11-22";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{title}</h2>
      <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <PageShell crumbs={[{ name: "Privacy", path: "/privacy" }]}>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">Privacy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Last updated <time dateTime={UPDATED}>22 November 2026</time>
        </p>
      </header>

      <p className="mb-8 text-lg text-slate-700 dark:text-slate-300">
        NovusOrbit helps you with your career using documents you choose to upload. This page explains, in plain
        language, what we store, why, and how you can remove it.
      </p>

      <Section title="What we store">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Your Google account basics</strong> when you sign in: name, email address and profile picture, used
            to identify your account.
          </li>
          <li>
            <strong>Documents you upload</strong> to My Portfolio (for example your CV), plus the search index built from
            them so the tools can find relevant parts of your experience.
          </li>
          <li>
            <strong>What you create in the app</strong>: saved jobs and their status, chat conversations, interview prep
            sessions, job suggestion results and resume writer history.
          </li>
          <li>
            <strong>Usage events</strong> when you are signed in, such as which tools you open, and how you first found
            the site (for example a link from a search engine or another website). We use this to improve the product.
          </li>
          <li>
            <strong>Feedback</strong> you send through the feedback form.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>
          Only to provide and improve NovusOrbit: to personalize answers, interview questions, resume edits and job
          matches to your experience, to keep your work saved, and to understand which features are useful. We do not
          sell your data and we do not use it for advertising.
        </p>
      </Section>

      <Section title="Who processes it">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>AI providers (OpenAI)</strong>: when you use an AI feature, the relevant parts of your documents and
            your request are sent to the AI provider to generate the answer.
          </li>
          <li>
            <strong>Web search provider</strong>: when you turn on web search or look for jobs, search queries are sent
            to a search service. Job suggestions also read public job listings on Indeed and LinkedIn.
          </li>
          <li>
            <strong>Hosting</strong>: the app and your files run on Amazon Web Services in the United States; account
            and usage data are stored in a MongoDB database.
          </li>
          <li>
            <strong>Google</strong>: handles sign-in. We never see your Google password.
          </li>
        </ul>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can delete portfolios (including uploaded documents and their index) in My Portfolio, job boards and jobs
          in Interested Jobs, and past sessions in History. To delete your whole account and everything linked to it,
          send a request through the <strong>Send Feedback</strong> button in the app and we will remove it.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          NovusOrbit is open source, so you can see exactly how your data is handled, or run it yourself, at{" "}
          <a
            href="https://github.com/zengtian006/NovusOrbit"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            github.com/zengtian006/NovusOrbit
          </a>
          .
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Use the <strong>Send Feedback</strong> button in the app. See also{" "}
          <Link href="/features" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            what NovusOrbit does
          </Link>
          .
        </p>
      </Section>
    </PageShell>
  );
}
