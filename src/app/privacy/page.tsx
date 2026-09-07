import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

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
        <Link className="button ghost" href="/#atlas">
          Return to the Atlas
        </Link>
      </section>
      <section
        className="privacy-content section"
        aria-labelledby="privacy-commitments"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Our commitments</p>
            <h2 id="privacy-commitments">Use less data. Explain it clearly.</h2>
          </div>
        </div>
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
                Atlas does not currently use a third-party product-analytics
                service or browser tracking SDK.
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
                Optional accounts, personalized workspaces, and in-product
                feedback are not available yet. Their data practices will be
                published before those features launch.
              </dd>
            </div>
          </dl>
        </div>
        <div className="privacy-section">
          <h2>What we will not put in product analytics</h2>
          <p>
            When optional product analytics are introduced, they will not
            include private health information, medical history, diagnosis or
            treatment information, chat prompts or answers, feedback text, raw
            search text, email addresses, credentials, or tokens.
          </p>
          <p>
            Any future analytics integration will be optional, governed by a
            public explanation and an accessible choice to decline or withdraw
            consent. Declining analytics will not limit public Atlas
            exploration.
          </p>
        </div>
        <div className="privacy-section">
          <h2>Optional analytics choices</h2>
          <p>
            Optional analytics are off by default. If they are introduced, you
            will be able to allow them or keep them off from Privacy settings in
            the footer. We honor browser Do Not Track by keeping optional
            analytics off, and we will not show a consent wall or limit public
            Atlas exploration when you decline.
          </p>
          <p>
            A choice is stored only in your browser, expires after six months,
            and can be changed at any time. If Atlas cannot save that choice,
            optional analytics stay off.
          </p>
        </div>
        <div className="privacy-section">
          <h2>Your future data controls</h2>
          <p>
            When optional accounts are available, account settings will include{" "}
            <strong>Export my data</strong> and <strong>Remove all data</strong>
            . Those controls will cover the account and personalization
            information connected to your account, along with any linked
            analytics data where applicable. We will publish the request
            process, timing, and any limited exceptions before launch.
          </p>
        </div>
        <div className="privacy-section privacy-contact">
          <h2>Questions or concerns</h2>
          <p>
            This is the Atlas privacy commitment and current data-use summary. A
            fuller implementation inventory, retention policy, consent controls,
            and processor list are being completed before optional analytics,
            feedback capture, or accounts are released.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
