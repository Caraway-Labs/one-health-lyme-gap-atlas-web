import { AtlasSectionHeader } from "@/components/atlas-section-header";
import {
  PAGE_INTRODUCTION_COPY,
  type PageIntroductionId,
} from "@/features/ux-reset/page-introduction-copy";

export function PageIntroduction({ page }: { page: PageIntroductionId }) {
  const copy = PAGE_INTRODUCTION_COPY[page];
  return (
    <header
      className="ux-reset-page-introduction"
      data-page={page}
      data-testid={`page-introduction-${page}`}
    >
      <AtlasSectionHeader
        className="ux-reset-page-introduction-heading"
        description={copy.supporting}
        headingLevel="h1"
        title={copy.headline}
      />
      <div className="ux-reset-page-introduction-strip">
        <h2 className="ux-reset-page-introduction-strip-heading">
          {copy.stripHeading}
        </h2>
        <p>{copy.stripBody}</p>
      </div>
    </header>
  );
}
