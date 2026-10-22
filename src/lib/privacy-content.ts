/**
 * Source of truth for the public Privacy policy.
 *
 * Update the version and last-updated date when substantive public-facing copy changes.
 */
export const privacyContent = {
  version: "1.0.0",
  lastUpdated: "2026-10-21",
  versionLabel: "Privacy policy version",
  versionPrefix: "Version",
  updatedPrefix: "Last updated",
  hero: {
    eyebrow: "Your data and your choices",
    title: "Privacy without the fine print.",
    lead: "One Health Atlas helps people understand public-health evidence. It is not built to turn its visitors into a data product. We collect only what we need to run Atlas, keep it secure, and, if you allow it, learn which features are useful. We do not sell personal information, run ads, or use your activity for advertising.",
    note: 'This policy covers onehealthatlas.org, the Atlas Assistant, Ask Atlas, Atlas accounts, and in-product feedback. One Health Atlas is a project of Caraway Labs. In this policy, "we" and "us" mean Caraway Labs.',
  },
  commitmentsIntro: {
    eyebrow: "Our commitments",
    title: "Use less data. Explain it clearly.",
  },
  commitments: [
    {
      title: "Public information stays public",
      text: "You can read about Atlas, its data sources, its methods, and this policy without an account. Signing in is required for the Atlas workspace, where you explore the map and compare counties.",
    },
    {
      title: "No ads or data sales",
      text: "We do not sell or rent personal information, and we do not share it for advertising, audience targeting, or behavioral profiling.",
    },
    {
      title: "Purpose before collection",
      text: "We collect information only to run a feature you are using, to keep the service secure and reliable, or, when you choose, to understand whether a feature is useful.",
    },
  ],
  collection: {
    title: "What we collect and why",
    intro:
      "Most of Atlas works without collecting anything about you. Here is what we handle and the reason for each.",
    facts: [
      {
        term: "Exploring public Atlas data.",
        text: "When you view maps, county profiles, scores, or downloads, your browser requests that public data from the Atlas service. We keep service logs and performance traces so we can keep Atlas reliable and secure. They record which feature was used and whether the request succeeded. They do not record your questions, feedback messages, email address, or sign-in tokens.",
      },
      {
        term: "Settings you share in a link.",
        text: "The county, filters, and score settings you choose are kept in the page address so you can bookmark or share a view. They stay in your browser unless you share the link.",
      },
      {
        term: "Optional product analytics.",
        text: "Only if you turn analytics on, Atlas sends basic usage events, such as which page or feature was used, to our analytics provider. Analytics run on public Atlas pages, Account, and sign-in. They never run in the signed-in professional workspace. Analytics are not linked to your account.",
      },
      {
        term: "Questions to the Atlas Assistant and Ask Atlas.",
        text: "Covered in the next section.",
      },
      {
        term: "Your account.",
        text: "If you create an account, we keep your sign-in email and any profile details you choose to save: your role, and optionally your state, organization, and job title. Your profile never changes Atlas evidence or scores.",
      },
      {
        term: "Feedback you send.",
        text: "When you use Feedback, we receive your message, the feedback category, the page you sent it from, and the county, filters, and settings you were viewing. An email address is optional and is used only to follow up on your report. If you are signed in, the report is linked to your account.",
      },
    ],
  },
  questionsAsked: {
    title: "Questions you ask Atlas",
    paragraphs: [
      "When you ask the Atlas Assistant or Ask Atlas a question, Atlas sends it to the Atlas service to find relevant published research and write an answer with citations. To do that, the question and the retrieved research passages are processed by our AI model provider, OpenAI.",
      "The Atlas service stores questions and answers for 30 days after a conversation's most recent message, then deletes them automatically. They are not linked to your account and are never used for analytics or advertising.",
      "Your browser also keeps your five most recent conversations for up to 30 days so you can pick up where you left off. You can clear this history at any time from the Atlas Assistant.",
      "Please do not include personal health information, or information about a specific patient, in your questions. Atlas answers research questions. It does not need personal details to do so.",
    ],
  },
  analytics: {
    title: "Your analytics choices",
    choice: {
      before: "Optional analytics are off until you turn them on. Open ",
      emphasis: "Privacy settings",
      after:
        " at the bottom of any page to allow them or keep them off, and change your choice at any time. Declining never limits what you can do in Atlas, and we will never block the site behind a consent banner.",
    },
    follow:
      "If your browser sends a Do Not Track signal, Atlas keeps optional analytics off, even if you allowed them earlier. Your choice is saved only in this browser and expires after six months. If Atlas cannot save your choice, analytics stay off.",
    exclusionsTitle: "What never goes into analytics",
    exclusions: [
      "Health information, medical history, diagnoses, or treatment details",
      "Questions you ask the Atlas Assistant or Ask Atlas, and the answers",
      "Feedback messages",
      "Search text",
      "Email addresses, passwords, or sign-in tokens",
      "Your IP address",
    ],
  },
  providers: {
    title: "Service providers we use",
    intro:
      "We rely on a small number of providers to run Atlas. Each one receives only what it needs to provide its service to us.",
    facts: [
      {
        term: "DigitalOcean (hosting).",
        text: "Runs the Atlas website and service, including the research library behind Ask Atlas, in the United States.",
      },
      {
        term: "Supabase (accounts and sign-in).",
        text: "Handles sign-in by email link or Google, and stores your account, your profile, and records of your privacy requests.",
      },
      {
        term: "Google (optional sign-in).",
        text: 'If you choose "Continue with Google", Google confirms your identity to Atlas.',
      },
      {
        term: "Snowflake (data platform).",
        text: "Stores public-health datasets, feedback reports, and Assistant and Ask Atlas conversations, which are kept for 30 days.",
      },
      {
        term: "OpenAI (AI model provider).",
        text: "Processes your questions and the relevant research passages to produce Atlas Assistant and Ask Atlas answers.",
      },
      {
        term: "Amplitude (optional analytics).",
        text: "Receives basic usage events only if you turn analytics on. Atlas tells Amplitude not to record your IP address, and the events are not linked to your account.",
      },
    ],
  },
  retention: {
    title: "How long we keep information",
    facts: [
      {
        term: "Assistant and Ask Atlas conversations (Atlas service):",
        text: "30 days after the most recent message, then deleted automatically.",
      },
      {
        term: "Recent conversations in your browser:",
        text: "Up to five conversations for up to 30 days. You can clear them at any time.",
      },
      {
        term: "Analytics events:",
        text: "90 days.",
      },
      {
        term: "Your analytics choice:",
        text: "Six months, in your browser only.",
      },
      {
        term: "Account and profile:",
        text: "Until you remove your data from Account or Settings.",
      },
      {
        term: "Data export file:",
        text: "Available to download for one hour after it is ready.",
      },
      {
        term: "Feedback:",
        text: "Kept to help us improve Atlas. If you remove your data, your contact email and the link to your account are deleted. The message itself is kept, without your contact details or account link.",
      },
      {
        term: "Privacy request records:",
        text: "A minimal record that an export or deletion was requested and completed. It is kept for security and accountability and contains no copy of your data.",
      },
      {
        term: "Service logs and performance traces:",
        text: "Kept only as long as needed to operate and secure Atlas.",
      },
    ],
  },
  rights: {
    title: "Your rights and controls",
    account: {
      before: "If you have an account, you can use ",
      first: "Export my data",
      between: " and ",
      second: "Remove all data",
      after:
        " from Account or professional Settings. You can update your profile details at any time. An export gives you a copy of your account data. Removing your data deletes your account and profile, removes your contact details and account link from any feedback you sent, and signs you out. Removal cannot be undone, and it never changes public Atlas datasets or methods.",
    },
    completion:
      "We complete export and deletion requests within 30 days, and usually right away.",
    unlinked:
      "Some information is not tied to your account, so it is not part of an export or deletion: conversations saved in your browser, which you can clear yourself, and analytics events, which are never linked to you.",
    request: {
      before:
        "We offer these choices to everyone, wherever you live. Depending on where you live, including California and other U.S. states, the European Union, and the United Kingdom, you may have additional rights to access, correct, delete, or object to the use of your personal information. To make a request we have not covered here, use ",
      emphasis: "Feedback",
      after:
        " at the bottom of this page and tell us how to reach you. We will not treat you differently for exercising your privacy rights.",
    },
  },
  security: {
    title: "How we protect information",
    paragraphs: [
      "All connections to Atlas are encrypted. Access to account, feedback, and conversation data is limited to the people and services that need it. Atlas keeps only a scrambled, one-way form of the code that lets a conversation continue, and before an export or deletion runs we ask you to sign in again.",
      "No system is perfectly secure, but we design Atlas to collect less, keep it for less time, and keep sensitive content out of logs and analytics.",
    ],
  },
  children: {
    title: "Children",
    before:
      "Atlas is built for public-health professionals, researchers, and other adults. It is not directed to children under 13, and we do not knowingly collect personal information from children. If you believe a child has given us personal information, let us know through ",
    emphasis: "Feedback",
    after: " and we will delete it.",
  },
  international: {
    title: "Visitors outside the United States",
    text: "Atlas is hosted in the United States. If you use Atlas from another country, your information will be processed in the United States and wherever our service providers operate.",
  },
  changes: {
    title: "Changes to this policy",
    text: "When we change this policy, we update the version and date at the bottom of this page. If a change significantly affects how we handle your information, we will say so clearly on this page before the change takes effect.",
  },
  questions: {
    title: "Questions and requests",
    before:
      "If you have a question about this policy or want to make a privacy request, use ",
    emphasis: "Feedback",
    between:
      " at the bottom of this page and include an email address if you would like a reply. We review every report. You can also read how Atlas uses ",
    links: [
      {
        href: "/ai-ethics",
        label: "AI and machine learning",
      },
      {
        href: "/about/caraway-labs",
        label: "about Caraway Labs",
      },
    ],
    conjunction: " and ",
    closing: ".",
  },
  actions: {
    returnLabel: "Return to the Atlas",
  },
} as const;
