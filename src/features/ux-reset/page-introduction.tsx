import { AtlasSectionHeader } from "@/components/atlas-section-header";
import {
  PAGE_INTRODUCTION_COPY,
  type PageIntroductionId,
} from "@/features/ux-reset/page-introduction-copy";

export function PageIntroduction({ page }: { page: PageIntroductionId }) {
  if (page === "explorer") {
    const copy = PAGE_INTRODUCTION_COPY.explorer;
    return (
      <header
        className="ux-reset-page-introduction ux-reset-explorer-introduction"
        data-page={page}
        data-testid="page-introduction-explorer"
      >
        <div className="ux-reset-explorer-introduction-copy">
          <p className="eyebrow light">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p>{copy.supporting}</p>
          <p>
            <strong>{copy.instructionLead}</strong> {copy.instruction}
          </p>
        </div>
        <div className="ux-reset-explorer-introduction-score">
          <h2>{copy.scoreHeading}</h2>
          <p>{copy.scoreBody}</p>
        </div>
      </header>
    );
  }

  const copy = PAGE_INTRODUCTION_COPY.compare;
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
    </header>
  );
}
