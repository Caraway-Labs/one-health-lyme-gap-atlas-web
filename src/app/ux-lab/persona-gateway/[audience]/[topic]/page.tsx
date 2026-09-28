import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  personaAudienceById,
  personaTopicById,
  personaTopicsForAudience,
} from "@/features/ux-lab/persona-gateway/content";
import { PersonaTopicPage } from "@/features/ux-lab/persona-gateway/persona-lane";
import { UX_LAB_AUDIENCES } from "@/features/ux-lab/prototype-contract";

type PersonaTopicPageProps = {
  params: Promise<{ audience: string; topic: string }>;
};

export function generateStaticParams() {
  return UX_LAB_AUDIENCES.flatMap((audience) =>
    personaTopicsForAudience(audience).map((topic) => ({
      audience,
      topic: topic.id,
    }))
  );
}

export async function generateMetadata({
  params,
}: PersonaTopicPageProps): Promise<Metadata> {
  const { audience: audienceId, topic: topicId } = await params;
  const audience = personaAudienceById(audienceId);
  const topic = audience ? personaTopicById(audience.id, topicId) : undefined;
  if (!(audience && topic)) {
    return { title: "Persona Gateway" };
  }
  return {
    description: topic.summary,
    robots: { follow: false, index: false },
    title: `${topic.title} · ${audience.title}`,
  };
}

export default async function Page({ params }: PersonaTopicPageProps) {
  const { audience: audienceId, topic: topicId } = await params;
  const audience = personaAudienceById(audienceId);
  const topic = audience ? personaTopicById(audience.id, topicId) : undefined;
  if (!(audience && topic)) {
    notFound();
  }
  return <PersonaTopicPage audience={audience} topic={topic} />;
}
