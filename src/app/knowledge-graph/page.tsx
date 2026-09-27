import { redirect } from "next/navigation";

interface LegacyKnowledgeGraphPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function LegacyKnowledgeGraphPage({
  searchParams,
}: LegacyKnowledgeGraphPageProps) {
  const params = await searchParams;
  const conversation =
    typeof params.conversation === "string" ? params.conversation : undefined;
  redirect(
    conversation
      ? `/assistant?conversation=${encodeURIComponent(conversation)}`
      : "/assistant"
  );
}
