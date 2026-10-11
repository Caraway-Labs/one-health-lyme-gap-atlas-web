import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AboutCarawayLabsPage from "@/app/about/caraway-labs/page";
import { AiEthicsPage } from "@/app/ai-ethics/page";
import PrivacyPage from "@/app/privacy/page";
import { aiEthicsContent } from "@/lib/ai-ethics-content";

const STATUS_LABELS = {
  current: "What Atlas does today",
  "approved-architecture": "Approved direction; release pending",
  "pending-decision": "Commitment in development",
} as const;

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
        "Atlas is built to help people understand public-health evidence—not to turn its visitors into a data product. We do not sell user data, run ads, or use Atlas activity for advertising.",
        "Our commitments",
        "Use less data. Explain it clearly.",
        "Public exploration stays public",
        "You can browse, filter, compare, and download public Atlas results without an account. The professional workspace requires sign-in. This Privacy page stays public either way.",
        "No ads or data sales",
        "We do not sell, rent, or share personal data for advertising, audience targeting, or commercial behavioral profiling.",
        "Purpose before collection",
        "We collect only what is needed to operate a feature, secure the service, or—when you choose—understand whether a feature is useful.",
        "What Atlas does today",
        "Product analytics",
        "After you allow optional analytics in Privacy settings, Atlas sends allowlisted product events to Amplitude using a session-only browser SDK. Events expire after 90 days. Atlas does not send chat content, prompts, health information, email addresses, or account identifiers to Amplitude. Those events come from pages that use the analytical shell, including the public Atlas, Account, and sign-in. The signed-in professional workspace does not start that analytics SDK. A choice saved in Privacy settings still applies when you return to those pages.",
        "Public Atlas requests",
        "Your browser requests public Atlas data from the Atlas API so the site can display counties, scores, maps, and downloads. Service operations use redacted logs and server telemetry to keep the service reliable.",
        "Assistant and Ask Atlas",
        "When reviewed-literature chat is enabled, a question from the public Atlas Assistant or from Ask Atlas in the professional workspace is sent to the Atlas API to answer it. Up to five conversations are stored in this browser for up to 30 days. You can clear that local history from the Atlas Assistant workspace. Ask Atlas uses that same browser store and does not keep a separate saved-chat library. When literature chat is not enabled, Ask Atlas does not send a question. This page does not state how long the API keeps a question.",
        "Accounts and feedback",
        "Sign-in is required for the professional workspace. You can save an optional profile after you sign in, from Account or from professional Settings. Profile details do not change Atlas evidence or scores, and they do not change who can read public Atlas results. In-product feedback is available from the Atlas header, the geographic explorer, and this privacy page footer. Optional contact email is only for follow-up on that report. Account deletion removes feedback contact fields and account linkage while retaining the submitted message text. The professional workspace does not store saved views, saved investigations, or an artifact library.",
        "What we will not put in product analytics",
        "Optional product analytics do not include private health information, medical history, diagnosis or treatment information, chat prompts or answers, feedback text, raw search text, email addresses, credentials, or tokens.",
        "Analytics are optional. You can decline or withdraw consent from Privacy settings. Declining analytics does not limit public Atlas exploration.",
        "Optional analytics choices",
        "Optional analytics are off by default. You can allow them or keep them off from Privacy settings in the footer. We honor browser Do Not Track by keeping optional analytics off, and we will not show a consent wall or limit public Atlas exploration when you decline.",
        "A choice is stored only in your browser, expires after six months, and can be changed at any time. If Atlas cannot save that choice, optional analytics stay off.",
        "Your data controls",
        "Signed-in users can start Export my data and Remove all data from Account and from professional Settings. Those controls cover the account profile connected to your sign-in. Account deletion also removes feedback contact fields and account linkage for that account while retaining submitted feedback text. They do not include browser-only chat history or unlinked Amplitude sessions. The professional workspace does not store saved views, saved investigations, or an artifact library. Completion is targeted within 30 days. Public Atlas datasets and methodology are unaffected. Deletion is irreversible.",
        "Questions or concerns",
        "This is the Atlas privacy commitment and current data-use summary. The implementation inventory, retention policy, consent controls, and processor list are kept with the public notice so visitors can interpret optional analytics and account data rights.",
        "Return to the Atlas",
      ].join(" ")
    );
  });

  it("renders every AI Ethics source string and status in text", () => {
    render(<AiEthicsPage />);
    const main = document.querySelector("main");
    const parts = [
      "Trust, evidence, and accountability",
      aiEthicsContent.introduction.title,
      aiEthicsContent.introduction.summary,
      aiEthicsContent.introduction.audienceNote,
      "Clear about the status of our work",
      "What is true today, planned, and undecided",
    ];
    for (const statement of aiEthicsContent.statements) {
      parts.push(
        STATUS_LABELS[statement.status],
        statement.title,
        statement.summary,
        "Technical detail and source",
        statement.detail,
        `Basis: ${statement.evidence}`
      );
    }
    parts.push("What Atlas AI is not for", ...aiEthicsContent.boundaries);
    parts.push(
      "Open questions",
      "Commitments in development",
      "These questions are public on purpose. They are not policies or promises until product decisions are reviewed and recorded."
    );
    for (const commitment of aiEthicsContent.openCommitments) {
      parts.push(commitment.topic, commitment.question);
    }
    parts.push("Related trust work");
    for (const work of aiEthicsContent.relatedWork) {
      parts.push(work.topic, work.detail);
    }
    parts.push(
      `Version ${aiEthicsContent.version} · Last updated September 7, 2026`,
      aiEthicsContent.maintenance.review,
      aiEthicsContent.maintenance.updateRule,
      "Return to the Atlas"
    );
    const statuses = [
      ...(main?.querySelectorAll<HTMLElement>(
        "[data-slot='badge'][data-status]"
      ) ?? []),
    ];
    expect(main).toBeInstanceOf(HTMLElement);
    expect(compact(main as HTMLElement)).toBe(parts.join(" "));
    expect({
      labels: statuses.map((status) => status.textContent),
      slots: statuses.map((status) => status.dataset.slot),
      statuses: statuses.map((status) => status.dataset.status),
      uniqueLabels: new Set(statuses.map((status) => status.textContent)).size,
    }).toStrictEqual({
      labels: [
        STATUS_LABELS.current,
        STATUS_LABELS["approved-architecture"],
        STATUS_LABELS["pending-decision"],
      ],
      slots: ["badge", "badge", "badge"],
      statuses: ["current", "approved-architecture", "pending-decision"],
      uniqueLabels: 3,
    });
  });

  it("opens each AI Ethics disclosure from the keyboard without hiding its text", () => {
    render(<AiEthicsPage />);
    const details = [...document.querySelectorAll("details")];
    expect(details).toHaveLength(aiEthicsContent.statements.length);

    for (const [index, detail] of details.entries()) {
      const statement = aiEthicsContent.statements[index];
      const summary = detail.querySelector("summary");
      expect({
        detail: detail.textContent?.includes(statement?.detail ?? ""),
        evidence: detail.textContent?.includes(statement?.evidence ?? ""),
        open: detail.open,
        role: summary?.getAttribute("role") ?? null,
        tabIndex: (summary?.tabIndex ?? -1) >= 0,
      }).toStrictEqual({
        detail: true,
        evidence: true,
        open: false,
        role: null,
        tabIndex: true,
      });

      summary?.focus();
      fireEvent.keyDown(summary as HTMLElement, { key: "Enter" });
      fireEvent.click(summary as HTMLElement);
      expect({
        active: document.activeElement,
        basis: detail.textContent?.includes("Basis:"),
        open: detail.open,
      }).toStrictEqual({
        active: summary,
        basis: true,
        open: true,
      });
    }
  });
});
