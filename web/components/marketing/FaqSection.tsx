import type { Faq } from "@/lib/seo-content";

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section aria-labelledby="faq">
      <h2 id="faq" className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Frequently asked questions
      </h2>
      <div className="divide-y divide-slate-200 dark:divide-slate-700 border-y border-slate-200 dark:border-slate-700">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4" open>
            <summary className="cursor-pointer font-medium text-slate-900 dark:text-slate-100 list-none">
              {f.q}
            </summary>
            <p className="mt-2 text-slate-600 dark:text-slate-300">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
