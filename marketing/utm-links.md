# Tagged links

Use these so Admin → Analytics (and Google Search Console / any analytics you add later) can tell which channel brought each visitor. Format: `utm_source` = where, `utm_medium` = type, `utm_campaign` = which push.

| Channel | Link |
|---|---|
| Hacker News | https://www.novusorbit.com/?utm_source=hackernews&utm_medium=social&utm_campaign=launch |
| Product Hunt | https://www.novusorbit.com/?utm_source=producthunt&utm_medium=social&utm_campaign=launch |
| Reddit r/SideProject | https://www.novusorbit.com/?utm_source=reddit&utm_medium=social&utm_campaign=sideproject |
| Reddit r/opensource | https://www.novusorbit.com/?utm_source=reddit&utm_medium=social&utm_campaign=opensource |
| LinkedIn launch | https://www.novusorbit.com/?utm_source=linkedin&utm_medium=social&utm_campaign=launch |
| LinkedIn guide post | https://www.novusorbit.com/guides/star-method-interview-answers?utm_source=linkedin&utm_medium=social&utm_campaign=guide |
| GitHub README | https://www.novusorbit.com/?utm_source=github&utm_medium=referral&utm_campaign=readme |
| Directories | https://www.novusorbit.com/?utm_source=DIRECTORY_NAME&utm_medium=directory&utm_campaign=listing |
| Outreach email | https://www.novusorbit.com/features?utm_source=email&utm_medium=outreach&utm_campaign=ORG_NAME |

Pages keep their canonical URL without the parameters, so tagged links don't create duplicate pages in Google.

## Paid tests

Send each ad to the page that matches what it promises, not the homepage. Use `utm_medium=paid` and one `utm_campaign` per test, so Admin → Analytics → **Funnel by Channel** shows each test on its own row. Compare tests on **cost per CV upload** (spend ÷ the "CV uploaded" count), not on clicks.

| Test | Link |
|---|---|
| Reddit: tailor resume | https://www.novusorbit.com/features/tailor-resume-to-job-description?utm_source=reddit&utm_medium=paid&utm_campaign=tailor-test1 |
| Reddit: interview prep | https://www.novusorbit.com/features/ai-interview-prep?utm_source=reddit&utm_medium=paid&utm_campaign=interview-test1 |
| Google Search: tailor resume | https://www.novusorbit.com/features/tailor-resume-to-job-description?utm_source=google&utm_medium=paid&utm_campaign=tailor-search1 |
| Google Search: interview prep | https://www.novusorbit.com/features/ai-interview-prep?utm_source=google&utm_medium=paid&utm_campaign=interview-search1 |
| Newsletter / creator sponsorship | https://www.novusorbit.com/features/tailor-resume-to-job-description?utm_source=CREATOR_NAME&utm_medium=sponsor&utm_campaign=YYYY-MM |

Budget plan for the first test (about $500 over 4 weeks):

1. Weeks 1–2: $150 Reddit (r/resumes, r/jobs, r/cscareerquestions, r/careerguidance) and $150 Google Search (exact/phrase match only, e.g. "tailor resume to job description free", "ai interview practice free"; add negatives such as "jobs near me", "hiring").
2. Weeks 3–4: move $200 to whichever test had the lower cost per CV upload, or into one creator/newsletter placement.
3. Stop any test whose cost per CV upload is more than about 3× the best one.

Existing cost guards (`src/services/rate_limit.py`) cap AI use per user and site-wide per day (`RATE_LIMIT_GLOBAL_DAILY`, default 3000). Raise the site-wide cap before a paid push if real users start hitting it.
