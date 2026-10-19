import {
  reviewRationaleFor,
  type ReviewRationaleItem,
} from "@/features/ux-reset/review/review-rationale";
import type { CountyDetail } from "@/generated/models";

function RationaleItem({ item }: { item: ReviewRationaleItem }) {
  return (
    <li data-testid={`review-rationale-${item.number}`}>
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
      aria-label="County evidence"
      className="ux-reset-review-rationale"
      data-testid="review-rationale"
    >
      <h3>Surveillance evidence</h3>
      <ol>
        {surveillance.map((item) => (
          <RationaleItem item={item} key={item.number} />
        ))}
      </ol>
      <h3>Community context</h3>
      <ol start={4}>
        {community.map((item) => (
          <RationaleItem item={item} key={item.number} />
        ))}
      </ol>
    </section>
  );
}
