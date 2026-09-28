import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  personaAudienceById,
  personaTopicsForAudience,
} from "@/features/ux-lab/persona-gateway/content";
import { PersonaLanePage } from "@/features/ux-lab/persona-gateway/persona-lane";
import { UX_LAB_AUDIENCES } from "@/features/ux-lab/prototype-contract";

type PersonaAudiencePageProps = {
  params: Promise<{ audience: string }>;
};

export function generateStaticParams() {
  return UX_LAB_AUDIENCES.map((audience) => ({ audience }));
}

export async function generateMetadata({
  params,
}: PersonaAudiencePageProps): Promise<Metadata> {
  const audience = personaAudienceById((await params).audience);
  if (!audience) {
    return { title: "Persona Gateway" };
  }
  return {
    description: audience.cardSummary,
    robots: { follow: false, index: false },
    title: audience.title,
  };
}

export default async function Page({ params }: PersonaAudiencePageProps) {
  const audience = personaAudienceById((await params).audience);
  if (!audience) {
    notFound();
  }
  return (
    <PersonaLanePage
      audience={audience}
      topics={personaTopicsForAudience(audience.id)}
    />
  );
}
