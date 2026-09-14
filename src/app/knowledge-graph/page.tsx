import { ComingSoonPage } from "@/components/coming-soon-page";
import { EvidenceChat } from "@/components/evidence-chat";
import { pageMetadataForRoute } from "@/lib/navigation";

interface KnowledgeGraphPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export const metadata = pageMetadataForRoute("/knowledge-graph");

export default async function KnowledgeGraphPage({
  searchParams,
}: KnowledgeGraphPageProps) {
  if (process.env.NEXT_PUBLIC_KG_CHAT_ENABLED !== "true") {
    return (
      <ComingSoonPage
        title="Evidence library"
        description="Ask questions grounded in reviewed PubMed and PMC Open Access literature as the Atlas research workspace moves toward release."
      />
    );
  }
  const params = await searchParams;
  const selected =
    typeof params.conversation === "string" ? params.conversation : undefined;
  return (
    <main className="knowledge-workspace">
      <EvidenceChat initialConversationId={selected} />
    </main>
  );
}
