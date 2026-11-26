/**
 * Content for the public, server-rendered SEO pages (/features and /guides).
 *
 * The app screens themselves are client-rendered tools with very little text,
 * so these pages are what search engines index and rank. Keep claims factual:
 * describe what the product actually does.
 */

export interface Faq {
  q: string;
  a: string;
}

export interface Feature {
  slug: string;
  /** Short name used in navigation and cards. */
  name: string;
  /** <title> and og:title. Lead with the search phrase. */
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** The app screen this feature lives on. */
  appPath: string;
  appLabel: string;
  requiresSignIn: boolean;
  steps: { title: string; body: string }[];
  benefits: { title: string; body: string }[];
  faqs: Faq[];
  relatedGuides: string[];
}

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  metaDescription: string;
  /** ISO date (YYYY-MM-DD). */
  published: string;
  updated: string;
  readingMinutes: number;
  summary: string;
  sections: GuideSection[];
  relatedFeature: string;
}

export const FEATURES: Feature[] = [
  {
    slug: "ai-interview-prep",
    name: "AI Interview Prep",
    metaTitle: "AI Interview Prep: Questions and Answers Tailored to Your CV",
    metaDescription:
      "Generate interview questions for a specific job at the difficulty you choose, with suggested answers written from your own CV and experience. Free AI interview preparation.",
    h1: "AI interview preparation built around the job and your CV",
    intro:
      "Generic question lists don't tell you what this interviewer will ask, or how your own experience answers it. NovusOrbit reads the job you saved and the CV in your portfolio, then generates the questions you're likely to face and suggested answers that draw on things you've actually done.",
    appPath: "/interview",
    appLabel: "Start interview prep",
    requiresSignIn: true,
    steps: [
      {
        title: "Upload your CV",
        body: "Add your CV and any supporting documents to My Portfolio. They're indexed so the AI can quote your real projects and results.",
      },
      {
        title: "Pick a saved job",
        body: "Choose a listing from your job tracker. The job description sets the role, seniority and skills the questions focus on.",
      },
      {
        title: "Choose a difficulty",
        body: "Warm up with easier questions or go straight to hard technical and behavioral ones.",
      },
      {
        title: "Practice with personalized answers",
        body: "Each question comes with a suggested answer drawn from your portfolio. Use it as a starting point and rewrite it in your own words.",
      },
    ],
    benefits: [
      {
        title: "Questions specific to the role",
        body: "Questions come from the job description you're applying to, not a generic top-50 list.",
      },
      {
        title: "Answers grounded in your experience",
        body: "Suggested answers reference your own projects, so you rehearse stories you can tell with confidence.",
      },
      {
        title: "Saved sessions",
        body: "Every prep session is kept in History so you can review it again the night before the interview.",
      },
    ],
    faqs: [
      {
        q: "Is the AI interview prep free?",
        a: "Yes. You need to sign in with Google so your sessions and portfolio are saved to your account.",
      },
      {
        q: "What kinds of questions does it generate?",
        a: "A mix of behavioral, situational and role-specific technical questions, based on the job description and the difficulty you pick.",
      },
      {
        q: "Will the suggested answers sound like me?",
        a: "They're built from the documents in your portfolio, so they use your real experience. Treat them as drafts: rehearse them out loud and adjust the wording until it sounds natural.",
      },
      {
        q: "Do I need to upload a CV?",
        a: "You can generate questions without one, but the answers are much more useful when the AI can draw on your CV.",
      },
    ],
    relatedGuides: ["star-method-interview-answers", "how-to-prepare-for-a-job-interview"],
  },
  {
    slug: "ai-resume-writer",
    name: "AI Resume Writer",
    metaTitle: "AI Resume Writer: Rewrite and Improve Resume Bullet Points",
    metaDescription:
      "Rewrite, shorten or expand resume bullet points with AI that knows your background. Edit in place and export your resume to Markdown or PDF. Free to use.",
    h1: "An AI resume writer that edits your resume in place",
    intro:
      "Select a line of your resume and ask the AI to rewrite it, tighten it, or expand it into a stronger achievement statement. It can pull details from the rest of your portfolio, so the result stays accurate to what you actually did.",
    appPath: "/resume-writer",
    appLabel: "Open the resume writer",
    requiresSignIn: true,
    steps: [
      {
        title: "Paste or write your resume",
        body: "Start from your current resume text in the editor.",
      },
      {
        title: "Select text and choose an action",
        body: "Rewrite for impact, shorten to fit, or expand a thin bullet into a full achievement.",
      },
      {
        title: "Review the suggestion",
        body: "Accept, tweak or discard each change. You stay in control of every word.",
      },
      {
        title: "Export",
        body: "Download the finished resume as Markdown or PDF.",
      },
    ],
    benefits: [
      {
        title: "Edits in context",
        body: "Change one bullet at a time without regenerating the whole document.",
      },
      {
        title: "Uses your real details",
        body: "With your portfolio connected, the AI can add specifics such as tools, scale and outcomes from your other documents.",
      },
      {
        title: "Ready to send",
        body: "Markdown and PDF export, plus optional text-to-speech to hear how your resume reads.",
      },
    ],
    faqs: [
      {
        q: "Can the AI write my whole resume from scratch?",
        a: "It works best on an existing draft. Paste what you have, even rough notes, and improve it section by section.",
      },
      {
        q: "Will it invent achievements?",
        a: "It's designed to work from your text and portfolio documents. Always check numbers and claims before sending: you have to stand behind everything on your resume.",
      },
      {
        q: "Is my resume private?",
        a: "Your documents are stored in your own account and used only to personalize your results.",
      },
    ],
    relatedGuides: ["how-to-tailor-resume-to-job-description"],
  },
  {
    slug: "ai-job-matching",
    name: "AI Job Matching",
    metaTitle: "AI Job Matching: Find Jobs That Fit Your Resume",
    metaDescription:
      "NovusOrbit analyzes your CV, searches live listings on LinkedIn, Indeed, Glassdoor, ZipRecruiter and company career sites, then ranks the matches and explains why each one fits. Free AI job search.",
    h1: "Find jobs that match your resume, ranked and explained",
    intro:
      "Instead of scrolling job boards with keyword filters, let the AI read your portfolio, work out which roles you're a strong fit for, search live listings on the job sites you choose, and rank what it finds against each job's actual requirements, with a short explanation for each match.",
    appPath: "/job-suggest",
    appLabel: "Get job suggestions",
    requiresSignIn: true,
    steps: [
      {
        title: "Build your portfolio",
        body: "Upload your CV so the AI understands your skills, seniority and experience.",
      },
      {
        title: "Set your preferences",
        body: "Tell it the role, location and how recent the postings should be, whether you want remote only, and which job sites to search: LinkedIn, Indeed, Glassdoor, ZipRecruiter, company career pages or all of them.",
      },
      {
        title: "Review ranked matches",
        body: "Real listings sorted by fit, each showing which site it came from, why it matches and the gaps to address, with a direct link to apply.",
      },
      {
        title: "Save the ones you like",
        body: "Add promising jobs to your tracker, then generate interview prep for them later.",
      },
    ],
    benefits: [
      {
        title: "Real listings",
        body: "Matches come from current postings, not a fixed internal database.",
      },
      {
        title: "Explained rankings",
        body: "See why a job fits and where your profile is thin before you spend time applying.",
      },
      {
        title: "Connected workflow",
        body: "Save a match to your tracker, then go straight to interview prep for it.",
      },
    ],
    faqs: [
      {
        q: "Where do the job listings come from?",
        a: "NovusOrbit searches live listings from LinkedIn, Indeed, Glassdoor, ZipRecruiter, company career pages and other job sites at the time you run a search. You can limit a search to the sites you prefer.",
      },
      {
        q: "How is the match ranked?",
        a: "The AI compares each listing's requirements with the skills and experience in your portfolio, then orders them by fit and explains its reasoning.",
      },
      {
        q: "Does NovusOrbit apply to jobs for me?",
        a: "No. It finds and explains matches. You decide where to apply and apply on the employer's site.",
      },
    ],
    relatedGuides: ["how-to-track-job-applications", "how-to-tailor-resume-to-job-description"],
  },
  {
    slug: "job-application-tracker",
    name: "Job Application Tracker",
    metaTitle: "Free Job Application Tracker: Organize Your Job Search",
    metaDescription:
      "Save job listings and track every application from interested to applied, interviewing, offered or rejected. A free job search tracker connected to AI interview prep.",
    h1: "A free job application tracker for your whole search",
    intro:
      "Keep every job you're considering in one place and move it through your pipeline: interested, applied, interviewing, offered or rejected. When an interview comes up, prep for that exact job in one click.",
    appPath: "/jobs",
    appLabel: "Open the job tracker",
    requiresSignIn: false,
    steps: [
      {
        title: "Save a job",
        body: "Add a listing with its title, company, link and description, or save one from your AI job matches.",
      },
      {
        title: "Update its status",
        body: "Move it from interested to applied, interviewing, offered or rejected as things progress.",
      },
      {
        title: "Prepare when it counts",
        body: "Open interview prep for any saved job and get questions based on its description.",
      },
    ],
    benefits: [
      {
        title: "One pipeline",
        body: "See at a glance how many applications are out, and which ones need a follow-up.",
      },
      {
        title: "Keeps the job description",
        body: "Postings get taken down. Saving the description means you still have it when the interview comes.",
      },
      {
        title: "Free",
        body: "No spreadsheet to maintain and nothing to pay.",
      },
    ],
    faqs: [
      {
        q: "Do I need an account to use the job tracker?",
        a: "You can open it without signing in. Sign in with Google to keep your boards saved to your account.",
      },
      {
        q: "What statuses can I track?",
        a: "Interested, applied, interviewing, offered and rejected.",
      },
    ],
    relatedGuides: ["how-to-track-job-applications"],
  },
  {
    slug: "ai-career-coach",
    name: "AI Career Coach",
    metaTitle: "AI Career Coach That Knows Your CV",
    metaDescription:
      "Chat with an AI career coach that has read your CV. Ask about career changes, which roles to target, salary negotiation or resume gaps, and get advice specific to you.",
    h1: "An AI career coach that has read your CV",
    intro:
      "Upload your CV and documents to My Portfolio, then ask career questions in plain language. The assistant searches your portfolio and, when you allow it, the web, so its answers are specific to your background rather than generic advice.",
    appPath: "/portfolio",
    appLabel: "Build your portfolio",
    requiresSignIn: false,
    steps: [
      {
        title: "Create a portfolio",
        body: "Upload your CV, cover letters, certificates or project write-ups.",
      },
      {
        title: "Ask a question",
        body: "For example: \"Which of my projects best fit a product manager role?\" or \"What skills am I missing for a senior position?\"",
      },
      {
        title: "Turn on web search when you need it",
        body: "Combine what's in your portfolio with current information from the web, with sources linked.",
      },
    ],
    benefits: [
      {
        title: "Personal, not generic",
        body: "Answers cite your own experience instead of repeating general career tips.",
      },
      {
        title: "Current information",
        body: "Optional web search brings in up-to-date context such as company or industry news.",
      },
    ],
    faqs: [
      {
        q: "Is NovusOrbit a replacement for a human career coach?",
        a: "No. It's a fast way to get personalized first answers, drafts and practice at any hour. For big decisions, talk it through with people you trust too.",
      },
      {
        q: "What can I upload to my portfolio?",
        a: "Your CV plus supporting documents such as cover letters, certificates and project descriptions.",
      },
    ],
    relatedGuides: ["how-to-tailor-resume-to-job-description", "how-to-prepare-for-a-job-interview"],
  },
];

export const GUIDES: Guide[] = [
  {
    slug: "how-to-tailor-resume-to-job-description",
    title: "How to Tailor Your Resume to a Job Description (Step by Step)",
    metaDescription:
      "A practical, step-by-step method to tailor your resume to any job description: pull out the requirements, match your evidence, rewrite bullets and pass ATS keyword checks.",
    published: "2026-11-22",
    updated: "2026-11-22",
    readingMinutes: 7,
    summary:
      "Recruiters spend seconds on a first pass, and many companies filter applications with keyword-matching software. A resume tailored to the posting gets past both. Here is a repeatable process that takes about 30 minutes per application.",
    sections: [
      {
        heading: "1. Break the job description into requirements",
        paragraphs: [
          "Copy the posting into a document and highlight three things: hard skills (tools, languages, certifications), responsibilities (what you'll do every week), and outcomes (what success looks like). Ignore boilerplate about culture and benefits for now.",
          "Rank what you highlighted. Requirements that appear in the title, the first bullets, or more than once matter most.",
        ],
      },
      {
        heading: "2. Map each requirement to evidence",
        paragraphs: [
          "For each top requirement, write down one specific thing you did that proves it: a project, a metric, a tool you used in production. If you can't find evidence for a must-have requirement, that's a signal to address it in your cover letter or reconsider the application.",
        ],
      },
      {
        heading: "3. Rewrite bullets as achievements",
        paragraphs: [
          "A strong bullet follows the pattern action + context + result. Compare:",
        ],
        bullets: [
          "Weak: \"Responsible for the reporting dashboard.\"",
          "Strong: \"Rebuilt the sales reporting dashboard in Looker, cutting weekly report preparation from 6 hours to 30 minutes for a team of 12.\"",
          "Lead with a strong verb: built, led, reduced, launched, automated.",
          "Quantify where you honestly can: time saved, revenue, users, error rates, team size.",
        ],
      },
      {
        heading: "4. Use the employer's language",
        paragraphs: [
          "If the posting says \"stakeholder management\" and your resume says \"worked with business partners\", use their phrase where it's accurate. Applicant tracking systems (ATS) and recruiters both scan for the exact terms in the posting.",
          "Put the most important keywords in your summary, your skills section and at least one bullet each. Don't paste keyword lists in white text; modern ATS and recruiters catch it.",
        ],
      },
      {
        heading: "5. Reorder, then cut",
        paragraphs: [
          "Move the most relevant role, project or bullet to the top of each section. Then remove anything that doesn't support this application. One focused page beats two unfocused ones for most roles under ten years of experience.",
        ],
      },
      {
        heading: "6. Final checks",
        bullets: [
          "Job title in your summary matches or closely mirrors the posting.",
          "Every must-have requirement is visible within the top half of page one.",
          "Standard section headings (Experience, Education, Skills) so ATS can parse them.",
          "Export to PDF and check that the text is selectable, not an image.",
          "Every number and claim is something you can explain in an interview.",
        ],
      },
      {
        heading: "Speed this up with AI",
        paragraphs: [
          "NovusOrbit's resume writer lets you select a bullet and rewrite, shorten or expand it, using details from the rest of your portfolio. Save the posting to your job tracker first so you always have the description to tailor against.",
        ],
      },
    ],
    relatedFeature: "ai-resume-writer",
  },
  {
    slug: "star-method-interview-answers",
    title: "STAR Method Interview Answers: Framework and Examples",
    metaDescription:
      "How to answer behavioral interview questions with the STAR method (Situation, Task, Action, Result), with worked examples and common mistakes to avoid.",
    published: "2026-11-22",
    updated: "2026-11-22",
    readingMinutes: 6,
    summary:
      "Behavioral questions such as \"Tell me about a time you disagreed with your manager\" are designed to predict how you'll act from how you've acted before. The STAR method gives every answer a clear shape so you stay concise and end on a result.",
    sections: [
      {
        heading: "What STAR stands for",
        bullets: [
          "Situation: the context, in one or two sentences. Where were you and what was going on?",
          "Task: your specific responsibility or the problem you had to solve.",
          "Action: what you did, step by step. This is the longest part, and it should say \"I\", not \"we\".",
          "Result: the outcome, ideally measurable, and what you learned.",
        ],
      },
      {
        heading: "Example: \"Tell me about a time you missed a deadline\"",
        paragraphs: [
          "Situation: \"Our team was migrating the billing service to a new database, with a hard cutover date before the quarter close.\"",
          "Task: \"I owned the data migration scripts, and two weeks out I realized our test data didn't reflect production edge cases.\"",
          "Action: \"I flagged the risk to my manager the same day with a revised estimate, proposed moving the cutover by one week, and set up a daily validation run against a production snapshot so we could see progress.\"",
          "Result: \"We cut over one week late but with zero billing errors, versus the dozens a rushed migration would likely have caused. Since then I build production-like test data into the plan from day one.\"",
        ],
      },
      {
        heading: "How to prepare your stories",
        paragraphs: [
          "You don't need a new story for every question. Prepare six to eight strong stories that cover the common themes, then adapt them:",
        ],
        bullets: [
          "Leadership or taking initiative",
          "Conflict or disagreement",
          "Failure or a mistake",
          "Working under pressure or a tight deadline",
          "Influencing without authority",
          "A result you're proud of",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Spending most of the answer on the Situation. Keep context to about 15% of your time.",
          "Saying \"we\" throughout. The interviewer is hiring you, so make your contribution clear.",
          "No result, or a vague one. End with what changed, using a number if you have one.",
          "Answers longer than two minutes. Practice out loud and time yourself.",
          "Choosing a \"failure\" that is really a humble-brag. Pick a real mistake and show what you learned.",
        ],
      },
      {
        heading: "Practice with questions for your target job",
        paragraphs: [
          "NovusOrbit's interview prep generates behavioral and technical questions from the job description you saved, with suggested answers drawn from your own CV. Use them as raw material for your STAR stories, then rehearse them in your own words.",
        ],
      },
    ],
    relatedFeature: "ai-interview-prep",
  },
  {
    slug: "how-to-prepare-for-a-job-interview",
    title: "How to Prepare for a Job Interview: A Checklist That Works",
    metaDescription:
      "A complete job interview preparation checklist: research the company, decode the job description, prepare stories and questions, and handle the day itself.",
    published: "2026-11-22",
    updated: "2026-11-22",
    readingMinutes: 6,
    summary:
      "Good interview preparation is less about memorizing answers and more about knowing three things cold: what the role needs, what evidence you have, and what you want to learn about them. Use this checklist in the days before your interview.",
    sections: [
      {
        heading: "A week before: research",
        bullets: [
          "Re-read the job description and list its top five requirements.",
          "Read the company's recent news, product updates and, for public companies, the last earnings summary.",
          "Look up your interviewers on LinkedIn: their role, how long they've been there, what they've posted.",
          "Understand the business model: who pays them, and for what?",
        ],
      },
      {
        heading: "Three to five days before: prepare your evidence",
        bullets: [
          "Match each top requirement to a specific story from your experience.",
          "Write six to eight STAR stories that cover leadership, conflict, failure, pressure and impact.",
          "Prepare a 60 to 90 second answer to \"Tell me about yourself\": present, past, and why this role next.",
          "For technical roles, review fundamentals and practice problems in the format they use.",
        ],
      },
      {
        heading: "Prepare your own questions",
        paragraphs: [
          "Asking good questions shows judgment and helps you decide if you want the job. Prepare at least five, so you still have some after others are answered during the interview.",
        ],
        bullets: [
          "\"What would success look like in the first 90 days?\"",
          "\"What's the biggest challenge the team is facing this year?\"",
          "\"How does the team decide what to work on?\"",
          "\"What do people who do well here have in common?\"",
        ],
      },
      {
        heading: "The day before",
        bullets: [
          "Do a full mock interview out loud, ideally with someone else or a recording.",
          "Test your camera, microphone and connection for video interviews.",
          "Plan your route and aim to arrive 10 minutes early for in-person interviews.",
          "Have a copy of your resume and the job description open or printed.",
        ],
      },
      {
        heading: "After the interview",
        bullets: [
          "Send a short thank-you note within 24 hours that mentions something specific from the conversation.",
          "Write down the questions you were asked while you still remember them.",
          "Update the status in your job tracker and note when to follow up.",
        ],
      },
      {
        heading: "Use AI to practice",
        paragraphs: [
          "NovusOrbit generates likely interview questions for the specific job you saved, at the difficulty you choose, with answers drawn from your CV. It's a fast way to find gaps in your preparation before the real thing.",
        ],
      },
    ],
    relatedFeature: "ai-interview-prep",
  },
  {
    slug: "how-to-track-job-applications",
    title: "How to Track Job Applications (and Why It Gets You More Offers)",
    metaDescription:
      "How to organize your job search: what to track for each application, a simple status pipeline, follow-up timing, and the numbers that show what's working.",
    published: "2026-11-22",
    updated: "2026-11-22",
    readingMinutes: 5,
    summary:
      "Once you're past a dozen applications, it's easy to lose track of who you've applied to, which version of your resume you sent, and when to follow up. A simple tracking system fixes that and tells you which part of your search to improve.",
    sections: [
      {
        heading: "What to record for every application",
        bullets: [
          "Company, job title and a link to the posting.",
          "The full job description (postings get taken down, often right before your interview).",
          "Date applied and how you applied: referral, company site or job board.",
          "Which resume version you sent.",
          "Contacts: recruiter, hiring manager, referrer.",
          "Current status and the next action, with a date.",
        ],
      },
      {
        heading: "Use a simple status pipeline",
        paragraphs: [
          "Five stages are enough for most searches: Interested, Applied, Interviewing, Offered and Rejected. Move every application forward or close it. An application with no next step is a decision you haven't made yet.",
        ],
      },
      {
        heading: "When to follow up",
        bullets: [
          "After applying: if you have a contact, follow up after about one week.",
          "After an interview: send a thank-you within 24 hours, then follow up if you haven't heard back by the date they gave you.",
          "After a rejection: a short, gracious reply keeps the door open for future roles.",
        ],
      },
      {
        heading: "Read your numbers",
        paragraphs: [
          "Once you have 20 or more applications, look at your conversion between stages. It tells you where the problem is:",
        ],
        bullets: [
          "Few responses to applications: tailor your resume more closely, or target roles that fit better.",
          "Screens but few later rounds: work on your story and your interview answers.",
          "Final rounds but no offers: practice for the final round, and ask for feedback.",
        ],
      },
      {
        heading: "Track it in NovusOrbit",
        paragraphs: [
          "NovusOrbit's free job tracker stores each listing with its description and moves it through exactly these stages. When an interview is booked, you can generate interview prep for that job straight from the tracker.",
        ],
      },
    ],
    relatedFeature: "job-application-tracker",
  },
];

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
