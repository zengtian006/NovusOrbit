# NovusOrbit launch kit

Ready-to-post copy and a checklist for launching www.novusorbit.com. Edit anything that doesn't sound like you before posting: people respond to a real person, not polished marketing copy.

| File | What it's for |
|---|---|
| [show-hn.md](show-hn.md) | Hacker News "Show HN" post and first comment |
| [product-hunt.md](product-hunt.md) | Product Hunt listing, maker comment and gallery plan |
| [reddit.md](reddit.md) | Posts for r/SideProject, r/opensource, r/webdev, and rules for career subreddits |
| [linkedin.md](linkedin.md) | Launch post and four follow-up posts |
| [chinese-channels.md](chinese-channels.md) | 小红书, V2EX and 知乎 posts (Chinese) |
| [directories.md](directories.md) | AI and SaaS directories to submit to, with copy-paste descriptions |
| [outreach.md](outreach.md) | Emails to career centers, bootcamps and career coaches |
| [utm-links.md](utm-links.md) | Tagged links for every channel |

## Facts to keep consistent

- **One-liner:** A free AI career assistant that reads your CV once, then preps you for interviews, rewrites your resume and finds matching jobs.
- **What it does:** interview questions and personalized answers for a saved job; AI resume editing with Markdown/PDF export; job matches from live Indeed and LinkedIn listings, ranked and explained; a job application tracker; career chat grounded in your CV, with optional web search.
- **Price:** free. Sign in with Google for the AI tools.
- **Languages:** English and Chinese UI.
- **Open source:** AGPL-3.0, https://github.com/zengtian006/NovusOrbit
- **Origin:** built on [HKUDS/OpenTutor](https://github.com/HKUDS/OpenTutor), an open-source AI learning assistant, and reworked into a career tool. Say so when asked, and in technical posts: HN readers will look at the commit history.
- **Limits:** per-user daily limits apply (see `src/services/rate_limit.py`). If someone hits one during launch, that's the reason.

## Launch checklist

### Before launch week
- [ ] Merge the launch-readiness PR (usage limits) and deploy.
- [ ] Set a monthly spending limit in your OpenAI account (Settings → Limits). This is the real safety net; the app's limits only slow usage down.
- [ ] Google Search Console set up and sitemap submitted.
- [ ] Take signed-in screenshots for the gallery (see [product-hunt.md](product-hunt.md#gallery)) and record a 30 to 60 second demo video.
- [ ] Add the best screenshot to the top of the repo README.
- [ ] Test the full flow in a fresh browser: sign in → upload CV → save job → interview prep → job suggestions.
- [ ] Submit to 5 to 10 directories from [directories.md](directories.md). They take days to weeks to publish.
- [ ] Line up 10 to 20 people (friends, colleagues) who'll try it on launch day and leave honest feedback.

### Launch week (pick Tuesday to Thursday)
- [ ] **Day 1:** Show HN at 8 to 10am US Eastern. Stay in the comments all day.
- [ ] **Day 2:** Product Hunt at 12:01am Pacific. LinkedIn launch post the same morning.
- [ ] **Day 3:** Reddit: r/SideProject, then r/opensource or r/webdev, a few hours apart.
- [ ] **Day 4:** 小红书 and V2EX.
- [ ] Every day: check admin analytics and logs, answer every comment, fix bugs fast.

### After launch
- [ ] Post a "what I learned launching" write-up on LinkedIn and Indie Hackers one week later.
- [ ] One new guide a week, based on Search Console queries.
- [ ] Two or three genuinely helpful answers a week on Reddit, Quora or 知乎, linking a guide only when it answers the question.
- [ ] Send 5 outreach emails a week from [outreach.md](outreach.md).
- [ ] Ask happy users for a short testimonial with their real name, and add it to `/features`.

## What to measure

The number that matters is **users who uploaded a CV and used at least one AI tool**, not visitors. Check it in Admin → Analytics after each channel and compare channels using the UTM tags.
