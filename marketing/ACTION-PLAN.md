# Paid marketing action plan

Started: 2026-11-26. Goal: find the channel with the lowest **cost per CV upload** (spend ÷ users who uploaded a CV), not the most clicks.

## Step 1: Check tracking works (10 minutes, do first)

- [ ] Open https://www.novusorbit.com in a private/incognito window and sign in with Google.
- [ ] Click around: open Upload CV, Saved Jobs and Ask.
- [ ] In your normal window, go to https://www.novusorbit.com/admin/analytics.
- [ ] In the recent events list, look for events with action **"funnel"**. If they're there, tracking works. If not, fix this before spending money.

## Step 2: Set up two ads ($300 total)

### Reddit ($150)

- [ ] Go to **ads.reddit.com** and create an account.
- [ ] Create a campaign with objective **Traffic**, budget **$10/day for 15 days**.
- [ ] Targeting → **Communities**: r/resumes, r/jobs, r/cscareerquestions, r/careerguidance.
- [ ] Ad text: *"Free AI tool: paste your resume, pick a job, get a tailored version in seconds. Open source, no paywall."*
- [ ] Destination URL (copy exactly):
  `https://www.novusorbit.com/features/tailor-resume-to-job-description?utm_source=reddit&utm_medium=paid&utm_campaign=tailor-test1`

### Google Search ($150)

- [ ] Go to **ads.google.com** and create an account. If it pushes "Smart campaign", switch to **Expert mode**.
- [ ] Create a **Search** campaign, budget **$10/day for 15 days**.
- [ ] Keywords, typed exactly with the quotes:
  - `"tailor resume to job description"`
  - `"tailor resume to job description free"`
  - `"ai resume tailoring"`
- [ ] Negative keywords: `jobs near me`, `hiring`, `salary`.
- [ ] Final URL:
  `https://www.novusorbit.com/features/tailor-resume-to-job-description?utm_source=google&utm_medium=paid&utm_campaign=tailor-search1`

## Step 3: After 2 weeks, decide where the rest goes ($200)

- [ ] Open Admin → Analytics, set the range to the last 14 days, find **Funnel by Channel**.
- [ ] For each ad: spend ÷ **"CV uploaded"** = cost per activated user (e.g. $150 ÷ 15 = $10).
- [ ] Put the remaining **$200** into the cheaper channel.
- [ ] If either costs more than about **$15 per CV upload**, stop it and try a career newsletter or YouTube creator sponsorship instead (link format in `utm-links.md`).
- [ ] If real users hit the site-wide AI cap, raise `RATE_LIMIT_GLOBAL_DAILY` (default 3000/day).

## Alongside, for free

- [ ] Post on **Product Hunt** (draft: `product-hunt.md`).
- [ ] Post a **Show HN** on Hacker News (draft: `show-hn.md`).
- [ ] Answer 2–3 resume questions a week on r/resumes, mentioning the tool where it genuinely helps.

## Results log

| Channel | Dates | Spend | Sign-ups | CV uploads | Cost per CV upload | Decision |
|---|---|---|---|---|---|---|
| Reddit / tailor-test1 | | | | | | |
| Google / tailor-search1 | | | | | | |

More tagged links and the reasoning behind this plan: `utm-links.md`.
