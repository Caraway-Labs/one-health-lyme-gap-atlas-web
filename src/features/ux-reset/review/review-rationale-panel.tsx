import type { CountyDetail } from "@/generated/models";

import {
  REVIEW_RATIONALE_INTRO,
  REVIEW_RATIONALE_SCORE_NOTE,
  reviewRationaleFor,
  type ReviewRationaleItem,
} from "@/features/ux-reset/review/review-rationale";

function RationaleItem({ item }: { item: ReviewRationaleItem }) {
  return (
    <li>
      <span>{item.number}</span>
      <div>
        <h4>
          {item.number === 3 ? (
            <>
              <em>Borrelia burgdorferi</em> detection
            </>
          ) : (
            item.label
          )}
        </h4>
        <p>{item.text}</p>
      </div>
    </li>
  );
}

export function ReviewRationalePanel({ detail }: { detail: CountyDetail }) {
  const items = reviewRationaleFor(detail);
  const surveillance = items.filter((item) => item.group === "surveillance");
  const community = items.filter((item) => item.group === "community");
  return (
    <section
      aria-label="Review rationale"
      className="ux-reset-review-rationale"
      data-testid="review-rationale"
    >
      <p className="eyebrow">Review rationale</p>
      <h3>Why it surfaced</h3>
      <p className="ux-reset-review-rationale-intro">{REVIEW_RATIONALE_INTRO}</p>
      <p className="ux-reset-review-rationale-note">{REVIEW_RATIONALE_SCORE_NOTE}</p>
      <h4>Surveillance evidence</h4>
      <ol>
        {surveillance.map((item) => (
          <RationaleItem item={item} key={item.number} />
        ))}
      </ol>
      <h4>Community context</h4>
      <ol start={4}>
        {community.map((item) => (
          <RationaleItem item={item} key={item.number} />
        ))}
      </ol>
    </section>
  );
}
