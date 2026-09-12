import type { Metadata } from "next";
import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy | One Health Lyme Gap Atlas",
  description:
    "How One Health Lyme Gap Atlas handles user data and privacy choices.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-hero">
        <p className="eyebrow light">Your data and your choices</p>
        <h1>Privacy without the fine print.</h1>
        <p>
          Atlas is built to help people understand public-health evidence—not to
          turn its visitors into a data product. We do not sell user data, run
          ads, or use Atlas activity for advertising.
        </p>
        <Link
          className={buttonVariants({
            className: "cta-on-dark",
            variant: "ghost",
          })}
          href="/#atlas"
        >
          Return to the Atlas
        </Link>
      </section>
      <section
        className="privacy-content section"
        aria-labelledby="privacy-commitments"
      >
        <AtlasSectionHeader
          eyebrow="Our commitments"
          title="Use less data. Explain it clearly."
          titleId="privacy-commitments"
        />
        <div className="privacy-principles">
          <article>
            <h3>Public exploration stays public</h3>
            <p>
              You can browse, filter, compare, and download public Atlas results
              without an account.
            </p>
          </article>
          <article>
            <h3>No ads or data sales</h3>
            <p>
              We do not sell, rent, or share personal data for advertising,
              audience targeting, or commercial behavioral profiling.
            </p>
          </article>
          <article>
            <h3>Purpose before collection</h3>
            <p>
              We collect only what is needed to operate a feature, secure the
              service, or—when you choose—understand whether a feature is
              useful.
            </p>
          </article>
        </div>
        <div className="privacy-section">
          <h2>What Atlas does today</h2>
          <dl className="privacy-facts">
            <div>
              <dt>Product analytics</dt>
              <dd>
                After you allow optional analytics in Privacy settings, Atlas
                sends allowlisted product events to Amplitude using a
                session-only browser SDK. Events expire after 90 days. Atlas
                does not send chat content, prompts, health information, email
                addresses, or account identifiers to Amplitude.
              </dd>
            </div>
            <div>
              <dt>Public Atlas requests</dt>
              <dd>
                Your browser requests public Atlas data from the Atlas API so
                the site can display counties, scores, maps, and downloads.
                Service operations use redacted logs and server telemetry to
                keep the service reliable.
              </dd>
            </div>
            <div>
              <dt>Evidence chat</dt>
              <dd>
                If you use the optional evidence-chat feature, your question is
                sent to the Atlas API to answer it. Up to five conversations are
                stored in your browser for up to 30 days; you can clear that
                local history from the chat workspace.
              </dd>
            </div>
            <div>
              <dt>Accounts and feedback</dt>
              <dd>
                Optional accounts let you save a profile after you sign in.
                In-product feedback is not available yet. Saved workspaces are
                not launched. Account data never changes Atlas evidence, scores,
                or access.
              </dd>
            </div>
          </dl>
        </div>
        <div className="privacy-section">
          <h2>What we will not put in product analytics</h2>
          <p>
            Optional product analytics do not include private health
            information, medical history, diagnosis or treatment information,
            chat prompts or answers, feedback text, raw search text, email
            addresses, credentials, or tokens.
          </p>
          <p>
            Analytics are optional. You can decline or withdraw consent from
            Privacy settings. Declining analytics does not limit public Atlas
            exploration.
          </p>
        </div>
        <div className="privacy-section">
          <h2>Optional analytics choices</h2>
          <p>
            Optional analytics are off by default. You can allow them or keep
            them off from Privacy settings in the footer. We honor browser Do
            Not Track by keeping optional analytics off, and we will not show a
            consent wall or limit public Atlas exploration when you decline.
          </p>
          <p>
            A choice is stored only in your browser, expires after six months,
            and can be changed at any time. If Atlas cannot save that choice,
            optional analytics stay off.
          </p>
        </div>
        <div className="privacy-section">
          <h2>Your data controls</h2>
          <p>
            Signed-in users can start <strong>Export my data</strong> and{" "}
            <strong>Remove all data</strong> from account settings. Those
            controls cover the account profile connected to your sign-in. They
            do not include browser-only chat history, unlinked Amplitude
            sessions, in-product feedback (not launched), or saved workspaces
            (not launched). Completion is targeted within 30 days. Public Atlas
            datasets and methodology are unaffected. Deletion is irreversible.
          </p>
        </div>
        <div className="privacy-section privacy-contact">
          <h2>Questions or concerns</h2>
          <p>
            This is the Atlas privacy commitment and current data-use summary.
            The implementation inventory, retention policy, consent controls,
            and processor list are kept with the public notice so visitors can
            interpret optional analytics and account data rights.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
