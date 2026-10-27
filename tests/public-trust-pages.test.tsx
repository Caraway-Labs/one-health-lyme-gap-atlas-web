import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AboutCarawayLabsPage from "@/app/about/caraway-labs/page";
import { AiEthicsPage } from "@/app/ai-ethics/page";
import PrivacyPage from "@/app/privacy/page";
import { aiEthicsContent } from "@/lib/ai-ethics-content";

function compact(element: HTMLElement) {
  const parts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.textContent?.replaceAll(/\s+/g, " ").trim();
    if (value) {
      parts.push(value);
    }
    node = walker.nextNode();
  }
  return parts.join(" ");
}

function assertReferenceIds(root: HTMLElement) {
  const ids = [...root.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);

  for (const attribute of ["aria-labelledby", "aria-describedby"] as const) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const references = element.getAttribute(attribute)?.split(/\s+/) ?? [];
      expect(references.length).toBeGreaterThan(0);
      for (const id of references) {
        expect(root.ownerDocument.querySelector(`#${id}`)).toBeTruthy();
      }
    }
  }
}

function assertSingleHeadingAndMain(root: HTMLElement) {
  const headings = within(root).getAllByRole("heading");
  expect({
    backLink: within(root).queryByRole("link", { name: /Back to Atlas/ }),
    h1Count: headings.filter((heading) => heading.tagName === "H1").length,
    heroes: root.querySelector(".privacy-hero, .ethics-hero"),
    tabIndex: root.querySelector("[tabindex]"),
    tag: root.tagName,
  }).toStrictEqual({
    backLink: null,
    h1Count: 1,
    heroes: null,
    tabIndex: null,
    tag: "MAIN",
  });
}

describe("public trust page family", () => {
  afterEach(cleanup);

  it("keeps one h1, resolved names, and no back-link on every page", () => {
    const pages = [AboutCarawayLabsPage, PrivacyPage, AiEthicsPage] as const;
    expect(pages).toHaveLength(3);
    for (const Page of pages) {
      const { container } = render(<Page />);
      const main = container.querySelector("main");
      expect(main).toBeInstanceOf(HTMLElement);
      assertSingleHeadingAndMain(main as HTMLElement);
      assertReferenceIds(main as HTMLElement);
      cleanup();
    }
  });

  it("preserves the About page copy in reading order", () => {
    render(<AboutCarawayLabsPage />);
    const main = document.querySelector("main");
    expect(main).toBeInstanceOf(HTMLElement);
    expect(compact(main as HTMLElement)).toBe(
      [
        "About Caraway Labs",
        "Building practical tools for better decisions.",
        "Caraway Labs develops software experiences that help people work with complex information and make more informed decisions.",
        "One Health Atlas",
        "One Health Atlas is a Caraway Labs project focused on helping public-health professionals investigate vector-borne disease evidence, starting with Lyme disease.",
        "The Atlas brings different evidence systems into a common workflow: human surveillance, vectors and pathogens, environmental conditions, and community context. Its aim is to make it easier to explore what the available data shows, where important gaps remain, and what deserves closer investigation.",
        "How we approach the work",
        "Evidence before certainty.",
        "Show sources, observation periods and limitations so users can understand what supports an interpretation.",
        "Connected perspectives.",
        "One Health means examining relationships among human health, vectors, animals and the environment without assuming causation from correlation.",
        "Practical decision support.",
        "Build tools to help researchers and public-health teams investigate and prioritize questions, not replace expert judgment.",
        "One Health Atlas is an independent Caraway Labs project. It is not an official public-health agency service, and its information is not medical advice.",
        "Return to One Health Atlas",
        "Privacy",
      ].join(" ")
    );
  });

  it("preserves the Privacy policy copy in reading order", () => {
    render(<PrivacyPage />);
    const main = document.querySelector("main");
    expect(main).toBeInstanceOf(HTMLElement);
    expect(compact(main as HTMLElement)).toBe(
      [
        "Your data and your choices",
        "Privacy without the fine print.",
        "One Health Atlas helps people understand public-health evidence. It is not built to turn its visitors into a data product. We collect only what we need to run Atlas, keep it secure, and, unless you turn optional analytics off, learn which features are useful. We do not sell personal information, run ads, or use your activity for advertising.",
        'This policy covers onehealthatlas.org, the Atlas Assistant, Ask Atlas, Atlas accounts, and in-product feedback. One Health Atlas is a project of Caraway Labs. In this policy, "we" and "us" mean Caraway Labs.',
        "Our commitments",
        "Use less data. Explain it clearly.",
        "Public information stays public",
        "You can read about Atlas, its data sources, its methods, and this policy without an account. Signing in is required for the Atlas workspace, where you explore the map and compare counties.",
        "No ads or data sales",
        "We do not sell or rent personal information, and we do not share it for advertising, audience targeting, or behavioral profiling.",
        "Purpose before collection",
        "We collect information only to run a feature you are using, to keep the service secure and reliable, or, unless you turn optional analytics off, to understand whether a feature is useful.",
        "What we collect and why",
        "Atlas collects only what each feature needs. Here is what we handle and the reason for each.",
        "Exploring public Atlas data.",
        "When you view maps, county profiles, scores, or downloads, your browser requests that public data from the Atlas service. We keep service logs and performance traces so we can keep Atlas reliable and secure. They record which feature was used and whether the request succeeded. They do not record your questions, feedback messages, email address, or sign-in tokens.",
        "Settings you share in a link.",
        "The county, filters, and score settings you choose are kept in the page address so you can bookmark or share a view. They stay in your browser unless you share the link.",
        "Optional product analytics.",
        "Atlas sends basic usage events, such as which page or feature was used, to our analytics provider. Optional analytics are on by default on public Atlas pages, Account, sign-in, and the signed-in professional workspace. They are not linked to your account.",
        "Questions to the Atlas Assistant and Ask Atlas.",
        "Covered in the next section.",
        "Your account.",
        "If you create an account, we keep your sign-in email and any profile details you choose to save: your role, and optionally your state, organization, and job title. Your profile never changes Atlas evidence or scores.",
        "Feedback you send.",
        "When you use Feedback, we receive your message, the feedback category, the page you sent it from, and the county, filters, and settings you were viewing. An email address is optional and is used only to follow up on your report. If you are signed in, the report is linked to your account.",
        "Questions you ask Atlas",
        "When you ask the Atlas Assistant or Ask Atlas a question, Atlas sends it to the Atlas service to find relevant published research and write an answer with citations. To do that, the question and the retrieved research passages are processed by our AI model provider, OpenAI.",
        "The Atlas service stores questions and answers for 30 days after a conversation's most recent message, then deletes them automatically. They are not linked to your account and are never used for analytics or advertising.",
        "Your browser also keeps your five most recent conversations for up to 30 days so you can pick up where you left off. You can clear this history at any time from the Atlas Assistant.",
        "Please do not include personal health information, or information about a specific patient, in your questions. Atlas answers research questions. It does not need personal details to do so.",
        "Your analytics choices",
        "Optional analytics are on by default. Open Privacy settings at the bottom of any public page, or from the signed-in workspace footer, to turn them off or allow them again. Turning them off never limits what you can do in Atlas, and we will never block the site behind a consent banner.",
        "If your browser sends a Do Not Track signal, Atlas keeps optional analytics off, even if you allowed them earlier. A choice to turn analytics off or allow them is saved only in this browser and expires after six months. After it expires, analytics return to the default unless Do Not Track is on. If Atlas cannot save your choice, analytics stay off.",
        "What never goes into analytics",
        "Health information, medical history, diagnoses, or treatment details",
        "Questions you ask the Atlas Assistant or Ask Atlas, and the answers",
        "Feedback messages",
        "Search text",
        "Email addresses, passwords, or sign-in tokens",
        "Your IP address",
        "Service providers we use",
        "We rely on a small number of providers to run Atlas. Each one receives only what it needs to provide its service to us.",
        "DigitalOcean (hosting).",
        "Runs the Atlas website and service, including the research library behind Ask Atlas, in the United States.",
        "Supabase (accounts and sign-in).",
        "Handles sign-in by email link or Google, and stores your account, your profile, and records of your privacy requests.",
        "Google (optional sign-in).",
        'If you choose "Continue with Google", Google confirms your identity to Atlas.',
        "Snowflake (data platform).",
        "Stores public-health datasets, feedback reports, and Assistant and Ask Atlas conversations, which are kept for 30 days.",
        "OpenAI (AI model provider).",
        "Processes your questions and the relevant research passages to produce Atlas Assistant and Ask Atlas answers.",
        "Amplitude (optional analytics).",
        "Receives basic usage events while optional analytics are on. They are on by default, and they stop if you turn analytics off or your browser sends Do Not Track. Atlas tells Amplitude not to record your IP address, and the events are not linked to your account.",
        "How long we keep information",
        "Assistant and Ask Atlas conversations (Atlas service):",
        "30 days after the most recent message, then deleted automatically.",
        "Recent conversations in your browser:",
        "Up to five conversations for up to 30 days. You can clear them at any time.",
        "Analytics events:",
        "90 days.",
        "Your analytics choice:",
        "Six months, in your browser only.",
        "Account and profile:",
        "Until you remove your data from Account or Settings.",
        "Data export file:",
        "Available to download for one hour after it is ready.",
        "Feedback:",
        "Kept to help us improve Atlas. If you remove your data, your contact email and the link to your account are deleted. The message itself is kept, without your contact details or account link.",
        "Privacy request records:",
        "A minimal record that an export or deletion was requested and completed. It is kept for security and accountability and contains no copy of your data.",
        "Service logs and performance traces:",
        "Kept only as long as needed to operate and secure Atlas.",
        "Your rights and controls",
        "If you have an account, you can use Export my data and Remove all data from Account or professional Settings. You can update your profile details at any time. An export gives you a copy of your account data. Removing your data deletes your account and profile, removes your contact details and account link from any feedback you sent, and signs you out. Removal cannot be undone, and it never changes public Atlas datasets or methods.",
        "We complete export and deletion requests within 30 days, and usually right away.",
        "Some information is not tied to your account, so it is not part of an export or deletion: conversations saved in your browser, which you can clear yourself, and analytics events, which are never linked to you.",
        "We offer these choices to everyone, wherever you live. Depending on where you live, including California and other U.S. states, the European Union, and the United Kingdom, you may have additional rights to access, correct, delete, or object to the use of your personal information. To make a request we have not covered here, use Feedback at the bottom of this page and tell us how to reach you. We will not treat you differently for exercising your privacy rights.",
        "How we protect information",
        "All connections to Atlas are encrypted. Access to account, feedback, and conversation data is limited to the people and services that need it. Atlas keeps only a scrambled, one-way form of the code that lets a conversation continue, and before an export or deletion runs we ask you to sign in again.",
        "No system is perfectly secure, but we design Atlas to collect less, keep it for less time, and keep sensitive content out of logs and analytics.",
        "Children",
        "Atlas is built for public-health professionals, researchers, and other adults. It is not directed to children under 13, and we do not knowingly collect personal information from children. If you believe a child has given us personal information, let us know through Feedback and we will delete it.",
        "Visitors outside the United States",
        "Atlas is hosted in the United States. If you use Atlas from another country, your information will be processed in the United States and wherever our service providers operate.",
        "Changes to this policy",
        "When we change this policy, we update the version and date at the bottom of this page. If a change significantly affects how we handle your information, we will say so clearly on this page before the change takes effect.",
        "Questions and requests",
        "If you have a question about this policy or want to make a privacy request, use Feedback at the bottom of this page and include an email address if you would like a reply. We review every report. You can also read how Atlas uses AI and machine learning and about Caraway Labs .",
        "Version 1.1.0 · Last updated October 25, 2026",
        "Return to the Atlas",
      ].join(" ")
    );
  });

  it("renders the approved AI Ethics copy in reading order", () => {
    render(<AiEthicsPage />);
    const main = document.querySelector("main");
    const { feedback } = aiEthicsContent;
    const [methods, access, privacy] = feedback.links;
    const parts: string[] = [
      aiEthicsContent.hero.eyebrow,
      aiEthicsContent.hero.title,
      aiEthicsContent.hero.lead,
      aiEthicsContent.hero.note,
      aiEthicsContent.approach.eyebrow,
      aiEthicsContent.approach.title,
      aiEthicsContent.approach.intro,
    ];
    for (const pillar of aiEthicsContent.pillars) {
      parts.push(pillar.name, pillar.title, pillar.does, pillar.matters);
    }
    parts.push(
      aiEthicsContent.otherCapabilitiesIntro.title,
      aiEthicsContent.otherCapabilitiesIntro.intro
    );
    for (const capability of aiEthicsContent.otherCapabilities) {
      parts.push(capability.term, capability.description);
    }
    parts.push(
      aiEthicsContent.architecture.title,
      aiEthicsContent.architecture.intro
    );
    for (const layer of aiEthicsContent.architectureLayers) {
      parts.push(layer.term, layer.description);
    }
    parts.push(aiEthicsContent.architecture.closing);
    parts.push(
      aiEthicsContent.commitmentsIntro.eyebrow,
      aiEthicsContent.commitmentsIntro.title
    );
    for (const commitment of aiEthicsContent.commitments) {
      parts.push(commitment.title, commitment.text);
    }
    parts.push(
      aiEthicsContent.limitationsIntro.title,
      aiEthicsContent.limitationsIntro.intro,
      ...aiEthicsContent.limitations,
      feedback.title,
      feedback.before.trim(),
      feedback.emphasis,
      feedback.between.trim(),
      methods.label,
      ",",
      access.label,
      ", and",
      privacy.label,
      ".",
      `Version ${aiEthicsContent.version} · Last updated October 21, 2026`,
      "Return to the Atlas"
    );
    expect(main).toBeInstanceOf(HTMLElement);
    expect({
      badges: main?.querySelector("[data-slot='badge']"),
      details: main?.querySelector("details"),
      h1: main?.querySelectorAll("h1").length,
      h3: main?.querySelectorAll("h3").length,
      text: compact(main as HTMLElement),
    }).toStrictEqual({
      badges: null,
      details: null,
      h1: 1,
      h3: aiEthicsContent.pillars.length + aiEthicsContent.commitments.length,
      text: parts.join(" "),
    });
  });
});
