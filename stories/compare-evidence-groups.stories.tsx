import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { alignCompareCountyProfiles } from "@/features/ux-reset/compare/compare-county-profile";
import { CompareCountyProfileSection } from "@/features/ux-reset/compare/compare-county-profile-section";

import { compareCountyDetail } from "../tests/fixtures/compare-api-fixtures";

import "@/features/ux-reset/ux-reset.css";

function CompareEvidenceGroupsStory() {
  const denver = compareCountyDetail("08001");
  denver.county = "Denver";
  const boulder = compareCountyDetail("08013");
  const alignment = alignCompareCountyProfiles({
    left: { detail: denver, status: "ready" },
    leftFips: denver.fips,
    right: { detail: boulder, status: "ready" },
    rightFips: boulder.fips,
  });
  return (
    <div className="ux-reset-compare">
      <p className="type-small">
        Synthetic Denver and Boulder records for layout review. These values are
        not a governed release.
      </p>
      <CompareCountyProfileSection
        alignment={alignment}
        error={null}
        leftLabel="Denver, Colorado (08001)"
        loading={false}
        onRetry={() => {}}
        period="2023-01-01"
        retrying={false}
        rightLabel="Boulder, Colorado (08013)"
      />
    </div>
  );
}

const meta = {
  title: "Data and Evidence/Compare evidence groups",
  component: CompareEvidenceGroupsStory,
  parameters: {
    docs: {
      description: {
        component:
          "Grouped two-county evidence cards. The fixture is synthetic and does not call the Atlas API.",
      },
    },
  },
} satisfies Meta<typeof CompareEvidenceGroupsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PopulatedPair: Story = {};
