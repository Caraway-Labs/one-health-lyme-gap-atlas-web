"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedEntry } from "@/generated/models/feedEntry";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import {
  FEED_ABSTRACT_NOT_PROVIDED_MESSAGE,
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  FEED_ITEM_MISSING_MESSAGE,
  FEED_ITEM_UNAVAILABLE_MESSAGE,
  FEED_NCBI_COPYRIGHT_HREF,
  feedItemTitle,
  feedPanelAbstract,
  feedPanelDescription,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
} from "./feed-presentation";

export type FeedDetailView =
  | { entry: FeedEntry; status: "ready" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "unavailable" };

function FeedPublicationDateText({ entry }: { entry: FeedEntry }) {
  const date = feedPublicationDate(entry);
  if (date.kind === "present") {
    return <time dateTime={date.iso}>{date.text}</time>;
  }
  return date.text;
}

function FeedExternalAnchor({
  children,
  controlId,
  href,
}: {
  children: string;
  controlId:
    | "feed_item_open"
    | "feed_item_pubmed_open"
    | "feed_ncbi_copyright_open";
  href: string;
}) {
  return (
    <a
      {...analyticsControlAttributes(controlId)}
      href={href}
      rel={FEED_EXTERNAL_LINK_REL}
      target={FEED_EXTERNAL_LINK_TARGET}
    >
      {children}
      <ExternalLink aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function FeedDetailReady({ entry }: { entry: FeedEntry }) {
  const title = feedItemTitle(entry);
  const href = feedPublisherHref(entry.canonical_url);
  const description = feedPanelDescription(entry);
  const abstract = feedPanelAbstract(entry);
  const pubmedHref = feedPublisherHref(entry.pubmed_url);
  const showPubMedNotices = entry.source_family === "pubmed";
  return (
    <>
      <DialogHeader className="ux-reset-feed-item">
        <DialogTitle className="type-card">
          {href ? (
            <FeedExternalAnchor controlId="feed_item_open" href={href}>
              {title}
            </FeedExternalAnchor>
          ) : (
            title
          )}
        </DialogTitle>
        <DialogDescription className="ux-reset-feed-attribution">
          {entry.attribution}
        </DialogDescription>
        <dl className="ux-reset-feed-meta">
          <div>
            <dt>Source family</dt>
            <dd data-testid="feed-source-family">
              {entry.source_family_label}
            </dd>
          </div>
        </dl>
      </DialogHeader>
      <dl className="ux-reset-feed-meta">
        <div>
          <dt>Publisher</dt>
          <dd>{feedPublisherLabel(entry)}</dd>
        </div>
        <div>
          <dt>Publication date</dt>
          <dd>
            <FeedPublicationDateText entry={entry} />
          </dd>
        </div>
      </dl>
      {description ? (
        <div>
          {description.authorsLabel ? (
            <p className="type-small ux-reset-feed-kicker">Authors</p>
          ) : null}
          <p
            className="ux-reset-feed-summary-text"
            data-testid="feed-description"
          >
            {description.text}
          </p>
        </div>
      ) : null}
      {abstract.kind === "text" ? (
        <div>
          <p className="ux-reset-feed-summary-text" data-testid="feed-abstract">
            {abstract.text}
          </p>
          {abstract.copyrightLine === null ? null : (
            <p
              className="type-small ux-reset-feed-copyright"
              data-testid="feed-abstract-copyright"
            >
              {abstract.copyrightLine}
            </p>
          )}
        </div>
      ) : null}
      {abstract.kind === "not_provided" ? (
        <p>{FEED_ABSTRACT_NOT_PROVIDED_MESSAGE}</p>
      ) : null}
      {entry.authors.length > 0 ? (
        <dl className="ux-reset-feed-meta">
          <div>
            <dt>Authors</dt>
            <dd>{entry.authors.join(", ")}</dd>
          </div>
        </dl>
      ) : null}
      {entry.tags.length > 0 ? (
        <ul className="ux-reset-feed-chips">
          {entry.tags.map((tag, index) => (
            <li key={`${tag}:${index}`}>
              <Badge
                className="h-auto max-w-full whitespace-normal"
                variant="outline"
              >
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {showPubMedNotices ? (
        <p className="ux-reset-feed-detail-links">
          {pubmedHref ? (
            <FeedExternalAnchor
              controlId="feed_item_pubmed_open"
              href={pubmedHref}
            >
              View on PubMed
            </FeedExternalAnchor>
          ) : null}
          <FeedExternalAnchor
            controlId="feed_ncbi_copyright_open"
            href={FEED_NCBI_COPYRIGHT_HREF}
          >
            NCBI copyright and disclaimers
          </FeedExternalAnchor>
        </p>
      ) : null}
      {entry.limitations.length > 0 ? (
        <ul className="ux-reset-feed-limitations">
          {entry.limitations.map((limitation, index) => (
            <li key={`${limitation}:${index}`}>{limitation}</li>
          ))}
        </ul>
      ) : null}
      <p className="type-small ux-reset-feed-provenance">
        Provenance: {entry.source.source_id}, registry version{" "}
        {entry.source.registry_version}
      </p>
    </>
  );
}

export function FeedItemDetailDialog({
  onOpenChange,
  onRetry,
  open,
  view,
}: {
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
  view: FeedDetailView;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="ux-reset-feed-detail inset-y-0 right-0 left-auto h-dvh max-h-none w-full max-w-full translate-none rounded-none max-md:inset-x-0 max-md:w-full sm:max-w-full md:w-[480px] md:max-w-[480px]"
        showCloseButton={false}
      >
        {view.status === "loading" ? (
          <div aria-busy="true" className="ux-reset-feed-detail-skeleton">
            <DialogHeader>
              <DialogTitle className="sr-only">Loading this item</DialogTitle>
              <DialogDescription className="sr-only">
                Loading this item
              </DialogDescription>
            </DialogHeader>
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {view.status === "missing" ? (
          <>
            <DialogHeader>
              <DialogTitle>{FEED_ITEM_MISSING_MESSAGE}</DialogTitle>
              <DialogDescription className="sr-only">
                {FEED_ITEM_MISSING_MESSAGE}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mx-0 mb-0 w-full flex-col sm:flex-col">
              <Button
                {...analyticsControlAttributes("feed_item_details_close")}
                onClick={() => {
                  onOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {view.status === "unavailable" ? (
          <>
            <DialogHeader>
              <DialogTitle>{FEED_ITEM_UNAVAILABLE_MESSAGE}</DialogTitle>
              <DialogDescription className="sr-only">
                {FEED_ITEM_UNAVAILABLE_MESSAGE}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mx-0 mb-0 w-full flex-col sm:flex-col">
              <Button
                {...analyticsControlAttributes("feed_item_details_retry")}
                onClick={onRetry}
                type="button"
                variant="outline"
              >
                Retry
              </Button>
              <Button
                {...analyticsControlAttributes("feed_item_details_close")}
                onClick={() => {
                  onOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {view.status === "ready" ? (
          <>
            <FeedDetailReady entry={view.entry} />
            <DialogFooter className="mx-0 mb-0 w-full flex-col sm:flex-col">
              <Button
                {...analyticsControlAttributes("feed_item_details_close")}
                onClick={() => {
                  onOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
