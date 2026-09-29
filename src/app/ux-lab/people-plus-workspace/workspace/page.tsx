import type { Metadata } from "next";

import { PeopleWorkspaceTeaser } from "@/features/ux-lab/people-plus-workspace/workspace-teaser";

export const metadata: Metadata = {
  title: "Atlas for Public Health",
};

export default function PeopleWorkspacePlaceholderPage() {
  return <PeopleWorkspaceTeaser />;
}
